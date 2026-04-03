import { db, auth } from "./firebase.js";
import { requireAuth, handleLogout } from "./auth.js";
import { showToast, hideSpinner, formatPrice, formatDate, statusBadge } from "./app.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentChef, currentChefData;

requireAuth(["chef"], (user, userData) => {
  if (userData.status !== "approved") return window.location.href = userData.status === "rejected" ? "rejected.html" : "pending.html";
  currentChef = user; currentChefData = userData;
  document.getElementById("chef-name").textContent = userData.name || "Chef";
  hideSpinner();
  loadSection("orders");
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
  const map = { orders: renderOrders, dishes: renderDishes, add: renderAddDish };
  (map[section] || renderOrders)(content);
}

async function renderOrders(content) {
  const allSnap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  const orders = allSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.status === "pending" || o.chefId === currentChef.uid);
  content.innerHTML = `<div class="section-header"><h2>Incoming Orders</h2><p>${orders.length} order(s) visible to you</p></div><div class="orders-list">${orders.length ? orders.map(orderCard).join("") : `<p class="empty-msg">No orders right now. 🍽️</p>`}</div>`;
  content.querySelectorAll(".accept-order").forEach(btn => btn.addEventListener("click", () => handleOrderAction(btn.dataset.id, "accepted")));
  content.querySelectorAll(".reject-order").forEach(btn => btn.addEventListener("click", () => handleOrderAction(btn.dataset.id, "rejected")));
  content.querySelectorAll(".complete-order").forEach(btn => btn.addEventListener("click", () => handleOrderAction(btn.dataset.id, "completed")));
}
function orderCard(order) {
  const isOwn = order.chefId === currentChef.uid;
  return `<div class="order-card"><div class="order-header"><div><span class="order-id">Order #${order.id.slice(0,8)}</span><span class="order-customer">by ${order.userName || "Customer"}</span></div><div>${statusBadge(order.status)}</div></div><div class="order-items">${(order.items || []).map(i => `<div class="order-item"><span>${i.name}</span><span>×${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join("")}</div><div class="order-footer"><strong>Total: ${formatPrice(order.total || 0)}</strong><span>${formatDate(order.createdAt)}</span></div><div class="order-actions">${order.status === "pending" ? `<button class="btn btn-success accept-order" data-id="${order.id}">✓ Accept</button><button class="btn btn-danger reject-order" data-id="${order.id}">✕ Reject</button>` : ""}${order.status === "accepted" && isOwn ? `<button class="btn btn-primary complete-order" data-id="${order.id}">✓ Mark Complete</button>` : ""}</div></div>`;
}
async function handleOrderAction(orderId, status) {
  const update = { status };
  if (status === "accepted") { update.chefId = currentChef.uid; update.chefName = currentChefData.name; }
  try { await updateDoc(doc(db, "orders", orderId), update); showToast(`Order ${status}!`, "success"); loadSection("orders"); } catch { showToast("Failed to update order.", "error"); }
}

async function renderDishes(content) {
  const snap = await getDocs(query(collection(db, "dishes"), where("chefId", "==", currentChef.uid)));
  const dishes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  content.innerHTML = `<div class="section-header"><h2>My Dishes</h2><p>${dishes.length} dish(es) on the menu</p></div><div class="food-grid" id="dishes-grid">${dishes.length ? dishes.map(dishCardChef).join("") : `<p class="empty-msg">You haven't added any dishes yet.</p>`}</div>`;
  content.querySelectorAll(".delete-dish").forEach(btn => btn.addEventListener("click", async () => { if (confirm("Delete this dish?")) { await deleteDoc(doc(db, "dishes", btn.dataset.id)); showToast("Dish deleted.", "info"); loadSection("dishes"); } }));
}
function dishCardChef(dish) { return `<div class="food-card"><div class="food-img-wrap"><img src="${dish.imageUrl || 'https://via.placeholder.com/300x200?text=🍽️'}" alt="${dish.name}" onerror="this.src='https://via.placeholder.com/300x200?text=🍽️'"></div><div class="food-info"><h4>${dish.name}</h4><p class="food-chef">by ${dish.chefName}</p><div class="food-footer"><span class="food-price">${formatPrice(dish.price)}</span><button class="btn btn-sm btn-danger delete-dish" data-id="${dish.id}">Delete</button></div></div></div>`; }

function renderAddDish(content) {
  content.innerHTML = `<div class="section-header"><h2>Add New Dish</h2><p>Create a new dish for the menu</p></div><div class="form-card"><div class="form-group"><label>Dish Name</label><input type="text" id="dish-name" placeholder="e.g. Spicy Burger" class="form-control"></div><div class="form-group"><label>Price ($)</label><input type="number" id="dish-price" placeholder="e.g. 12.99" min="0" step="0.01" class="form-control"></div><div class="form-group"><label>Image URL</label><input type="url" id="dish-image" placeholder="https://..." class="form-control"><small>Paste a direct image link</small></div><div id="img-preview-wrap" style="display:none;margin-bottom:1rem"><img id="img-preview" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px"></div><button class="btn btn-primary btn-block" id="add-dish-btn">🍴 Add Dish to Menu</button></div>`;
  document.getElementById("dish-image").addEventListener("input", e => { const url = e.target.value.trim(); const wrap = document.getElementById("img-preview-wrap"); const img = document.getElementById("img-preview"); if (url) { img.src = url; wrap.style.display = "block"; } else wrap.style.display = "none"; });
  document.getElementById("add-dish-btn").addEventListener("click", addDish);
}
async function addDish() {
  const name = document.getElementById("dish-name").value.trim();
  const price = parseFloat(document.getElementById("dish-price").value);
  const imageUrl = document.getElementById("dish-image").value.trim();
  if (!name || isNaN(price) || price <= 0) return showToast("Please fill in name and a valid price.", "error");
  try { await addDoc(collection(db, "dishes"), { name, price, imageUrl: imageUrl || "", chefId: currentChef.uid, chefName: currentChefData.name, createdAt: new Date().toISOString() }); showToast("Dish added to the menu! 🎉", "success"); loadSection("dishes"); } catch { showToast("Failed to add dish.", "error"); }
}