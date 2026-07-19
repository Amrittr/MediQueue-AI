export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let iconName = "info";
  if (type === "success") iconName = "check_circle";
  else if (type === "error") iconName = "error";
  else if (type === "warning") iconName = "warning";

  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-icons-outlined" style="font-size: 1.25rem;">${iconName}</span>
    </div>
    <div style="flex-1;">${message}</div>
    <button class="toast-close" style="font-size: 1.1rem; border: none; background: none; color: var(--color-text-light); cursor: pointer;">&times;</button>
  `;

  container.appendChild(toast);

  // Close event listener
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  });

  // Auto-expire
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }
  }, 4000);
}
