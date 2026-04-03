import { db } from "./firebase.js";
import { requireAuth, handleLogout } from "./auth.js";
import { showToast, hideSpinner, formatPrice, formatDate, statusBadge } from "./app.js";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

requireAuth(["admin"], (user, userData) => {
  document.getElementById("admin-name").textContent = userData.name || "Admin";
  hideSpinner();
  loadSection("overview");
});

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    loadSection(link.dataset.section);
  });
});
document.getElementById("logout-btn").addEventListener("click", handleLogout);

function loadSection(section) {
  const content = document.getElementById("main-content");
  content.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
  const map = { overview: renderOverview, users: renderUsers, chefs: renderChefs, orders: renderOrders };
  (map[section] || renderOverview)(content);
}

async function renderOverview(content) {
  const [usersSnap, ordersSnap, dishesSnap] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "orders")), getDocs(collection(db, "dishes"))]);
  const users = usersSnap.docs.map(d => d.data());
  const orders = ordersSnap.docs.map(d => d.data());
  const totalEarnings = orders.filter(o => o.status === "completed").reduce((s, o) => s + (o.total || 0), 0);
  const pendingChefs = users.filter(u => u.role === "chef" && u.status === "pending").length;
  content.innerHTML = `<div class="section-header"><h2>Overview</h2><p>Welcome to your command center</p></div><div class="stats-grid">${statCard("👥","Total Users",users.filter(u=>u.role==="user").length,"#6366f1")}${statCard("🧑‍🍳","Total Chefs",users.filter(u=>u.role==="chef").length,"#f59e0b")}${statCard("⏳","Pending Chefs",pendingChefs,"#ef4444")}${statCard("📦","Total Orders",orders.length,"#10b981")}${statCard("🍽️","Total Dishes",dishesSnap.size,"#8b5cf6")}${statCard("💰","Total Earnings",formatPrice(totalEarnings),"#14b8a6")}</div><div class="recent-section"><h3>Recent Orders</h3>${recentOrdersTable(orders.slice(-5).reverse())}</div>`;
}

function statCard(icon,label,value,color){return `<div class="stat-card" style="--accent:${color}"><div class="stat-icon">${icon}</div><div class="stat-info"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div></div>`;}
function recentOrdersTable(orders){if(!orders.length)return `<p class="empty-msg">No orders yet.</p>`;return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order ID</th><th>User</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>${orders.map(o=>`<tr><td><code>${o.id?.slice(0,8)||"—"}</code></td><td>${o.userName||"—"}</td><td>${formatPrice(o.total||0)}</td><td>${statusBadge(o.status)}</td><td>${formatDate(o.createdAt)}</td></tr>`).join("")}</tbody></table></div>`;}

async function renderUsers(content){
  const snap=await getDocs(query(collection(db,"users"),orderBy("createdAt","desc")));
  const users=snap.docs.filter(d=>d.data().role==="user").map(d=>({id:d.id,...d.data()}));
  content.innerHTML=`<div class="section-header"><h2>All Users</h2><p>${users.length} registered customers</p></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th></tr></thead><tbody>${users.length?users.map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td>${statusBadge(u.status)}</td><td>${formatDate(u.createdAt)}</td></tr>`).join(""):`<tr><td colspan="4" class="empty-msg">No users yet.</td></tr>`}</tbody></table></div>`;
}

async function renderChefs(content){
  const snap=await getDocs(collection(db,"users"));
  const chefs=snap.docs.filter(d=>d.data().role==="chef").map(d=>({id:d.id,...d.data()}));
  content.innerHTML=`<div class="section-header"><h2>Chef Management</h2><p>Approve or reject chef applications</p></div><div class="cards-grid" id="chefs-list">${chefs.length?chefs.map(chef=>chefCard(chef)).join(""):`<p class="empty-msg">No chef accounts yet.</p>`}</div>`;
  content.querySelectorAll(".approve-btn").forEach(btn=>btn.addEventListener("click",()=>updateChefStatus(btn.dataset.id,"approved")));
  content.querySelectorAll(".reject-btn").forEach(btn=>btn.addEventListener("click",()=>updateChefStatus(btn.dataset.id,"rejected")));
}
function chefCard(chef){return `<div class="chef-card" id="chef-${chef.id}"><div class="chef-avatar">${chef.name?.[0]?.toUpperCase()||"C"}</div><div class="chef-info"><h4>${chef.name}</h4><p>${chef.email}</p><p>Joined: ${formatDate(chef.createdAt)}</p>${statusBadge(chef.status)}</div><div class="chef-actions">${chef.status!=="approved"?`<button class="btn btn-success approve-btn" data-id="${chef.id}">✓ Approve</button>`:""}${chef.status!=="rejected"?`<button class="btn btn-danger reject-btn" data-id="${chef.id}">✕ Reject</button>`:""}</div></div>`;}
async function updateChefStatus(uid,status){try{await updateDoc(doc(db,"users",uid),{status});showToast(`Chef ${status}!`,"success");loadSection("chefs");}catch{showToast("Failed to update chef status.","error");}}

async function renderOrders(content){
  const snap=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc")));
  const orders=snap.docs.map(d=>({id:d.id,...d.data()}));
  const totalEarnings=orders.filter(o=>o.status==="completed").reduce((s,o)=>s+(o.total||0),0);
  content.innerHTML=`<div class="section-header"><h2>All Orders</h2><p>Total Earnings from completed orders: <strong>${formatPrice(totalEarnings)}</strong></p></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Chef</th><th>Date</th><th>Action</th></tr></thead><tbody>${orders.length?orders.map(o=>`<tr><td><code>${o.id.slice(0,8)}</code></td><td>${o.userName||"—"}</td><td>${(o.items||[]).map(i=>i.name).join(", ")}</td><td>${formatPrice(o.total||0)}</td><td>${statusBadge(o.status)}</td><td>${o.chefName||"Unassigned"}</td><td>${formatDate(o.createdAt)}</td><td>${o.status!=="completed"&&o.status!=="rejected"?`<button class="btn btn-sm btn-danger cancel-order" data-id="${o.id}">Cancel</button>`:"—"}</td></tr>`).join(""):`<tr><td colspan="8" class="empty-msg">No orders found.</td></tr>`}</tbody></table></div>`;
  content.querySelectorAll(".cancel-order").forEach(btn=>{btn.addEventListener("click",async()=>{if(confirm("Cancel this order?")){await updateDoc(doc(db,"orders",btn.dataset.id),{status:"rejected"});showToast("Order cancelled.","info");loadSection("orders");}})});
}