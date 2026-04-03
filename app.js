export function showSpinner() {
  document.getElementById("spinner")?.classList.add("active");
}
export function hideSpinner() {
  document.getElementById("spinner")?.classList.remove("active");
}

export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

export function formatPrice(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function statusBadge(status) {
  const colors = {
    pending: "#f59e0b", accepted: "#10b981", rejected: "#ef4444",
    completed: "#6366f1", approved: "#10b981", active: "#10b981"
  };
  const color = colors[status] || "#94a3b8";
  return `<span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${status}</span>`;
}

// Emergency hide spinner after 5 seconds
setTimeout(() => {
  const sp = document.getElementById("spinner");
  if (sp && sp.classList.contains("active")) {
    sp.classList.remove("active");
    console.warn("Spinner force hidden");
  }
}, 5000);