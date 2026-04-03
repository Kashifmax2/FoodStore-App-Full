import { db, auth } from "./firebase.js";
import { requireAuth, handleLogout } from "./auth.js";
import { showToast, hideSpinner, formatPrice, formatDate, statusBadge } from "./app.js";
import { collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser, currentUserData;
let cart = JSON.parse(localStorage.getItem("fs_cart") || "[]");

requireAuth(["user"], (user, userData) => {
  currentUser = user;
  currentUserData = userData;
  document.getElementById("user-name").textContent = userData.name || "Customer";
  hideSpinner();
  updateCartCount();
  loadSection("menu");
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
  const map = { menu: renderMenu, cart: renderCart, orders: renderOrders };
  (map[section] || renderMenu)(content);
}

async function renderMenu(content) {
  const snap = await getDocs(query(collection(db, "dishes"), orderBy("createdAt", "desc")));
  const dishes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  content.innerHTML = `
    <div class="section-header"><h2>🍔 Our Menu</h2><p>Fresh dishes made by our talented chefs</p></div>
    <div class="search-bar-wrap"><input type="text" id="search-input" class="search-bar" placeholder="Search dishes…"></div>
    <div class="food-grid" id="menu-grid">
      ${dishes.length ? dishes.map(dishCard).join("") : `<p class="empty-msg">No dishes available yet. Check back soon!</p>`}
    </div>`;
  document.getElementById("search-input").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    content.querySelectorAll(".food-card").forEach(card => {
      const name = card.querySelector("h4").textContent.toLowerCase();
      card.style.display = name.includes(q) ? "" : "none";
    });
  });
  content.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", () => addToCart(dishes.find(d => d.id === btn.dataset.id)));
  });
}

function dishCard(dish) {
  return `<div class="food-card"><div class="food-img-wrap"><img src="${dish.imageUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop'}" alt="${dish.name}" onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop'"></div><div class="food-info"><h4>${dish.name}</h4><p class="food-chef">👨‍🍳 ${dish.chefName}</p><div class="food-footer"><span class="food-price">${formatPrice(dish.price)}</span><button class="btn btn-primary btn-sm add-to-cart" data-id="${dish.id}">+ Add</button></div></div></div>`;
}

function addToCart(dish) {
  const existing = cart.find(i => i.id === dish.id);
  if (existing) existing.qty++;
  else cart.push({ id: dish.id, name: dish.name, price: dish.price, qty: 1 });
  localStorage.setItem("fs_cart", JSON.stringify(cart));
  updateCartCount();
  showToast(`${dish.name} added to cart! 🛒`, "success");
}

function updateCartCount() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = total || "";
}

function renderCart(content) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  content.innerHTML = `<div class="section-header"><h2>🛒 Your Cart</h2><p>${cart.length} item type(s) in cart</p></div>
    ${cart.length ? `<div class="cart-list">${cart.map(item => `<div class="cart-item"><div class="cart-item-info"><span class="cart-item-name">${item.name}</span><span class="cart-item-price">${formatPrice(item.price)} each</span></div><div class="cart-controls"><button class="qty-btn" data-action="dec" data-id="${item.id}">−</button><span class="qty-num">${item.qty}</span><button class="qty-btn" data-action="inc" data-id="${item.id}">+</button><button class="btn btn-sm btn-danger remove-item" data-id="${item.id}">✕</button></div></div>`).join("")}<div class="cart-total"><strong>Total: ${formatPrice(total)}</strong></div><button class="btn btn-primary btn-block" id="place-order-btn">🚀 Place Order</button></div>` : `<p class="empty-msg">Your cart is empty. Browse the menu to add items!</p>`}`;
  content.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = cart.find(i => i.id === btn.dataset.id);
      if (!item) return;
      if (btn.dataset.action === "inc") item.qty++;
      else item.qty = Math.max(1, item.qty - 1);
      localStorage.setItem("fs_cart", JSON.stringify(cart));
      updateCartCount();
      renderCart(content);
    });
  });
  content.querySelectorAll(".remove-item").forEach(btn => {
    btn.addEventListener("click", () => {
      cart = cart.filter(i => i.id !== btn.dataset.id);
      localStorage.setItem("fs_cart", JSON.stringify(cart));
      updateCartCount();
      renderCart(content);
    });
  });
  document.getElementById("place-order-btn")?.addEventListener("click", placeOrder);
}

async function placeOrder() {
  if (!cart.length) return showToast("Cart is empty!", "error");
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  try {
    await addDoc(collection(db, "orders"), {
      userId: currentUser.uid, userName: currentUserData.name,
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      total, status: "pending", chefId: null, chefName: null,
      createdAt: new Date().toISOString()
    });
    cart = []; localStorage.removeItem("fs_cart"); updateCartCount();
    showToast("Order placed! A chef will accept it soon. 🎉", "success");
    loadSection("orders");
  } catch { showToast("Failed to place order.", "error"); }
}

async function renderOrders(content) {
  const snap = await getDocs(query(collection(db, "orders"), where("userId", "==", currentUser?.uid), orderBy("createdAt", "desc")));
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  content.innerHTML = `<div class="section-header"><h2>📦 My Orders</h2><p>${orders.length} order(s) placed</p></div><div class="orders-list">${orders.length ? orders.map(o => `<div class="order-card"><div class="order-header"><div><span class="order-id">Order #${o.id.slice(0,8)}</span>${o.chefName ? `<span class="order-customer">Chef: ${o.chefName}</span>` : ""}</div><div>${statusBadge(o.status)}</div></div><div class="order-items">${(o.items || []).map(i => `<div class="order-item"><span>${i.name}</span><span>×${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join("")}</div><div class="order-footer"><strong>Total: ${formatPrice(o.total || 0)}</strong><span>${formatDate(o.createdAt)}</span></div></div>`).join("") : `<p class="empty-msg">You haven't placed any orders yet.</p>`}</div>`;
}