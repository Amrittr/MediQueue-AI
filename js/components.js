import { subscribe, logoutUser } from './state.js';

export function initLayout(activePath) {
  const sidebarContainer = document.getElementById("sidebar-container");
  const navbarContainer = document.getElementById("navbar-container");

  // Subscribe to state to render sidebar and navbar dynamically
  subscribe((state) => {
    // If loading auth state, show a general loading wrapper or do nothing
    if (state.loading) {
      if (sidebarContainer) sidebarContainer.innerHTML = `<div class="sidebar" style="justify-content: center; align-items: center;"><div class="spinner"></div></div>`;
      if (navbarContainer) navbarContainer.innerHTML = `<div class="navbar" style="justify-content: center;"><div class="spinner"></div></div>`;
      return;
    }

    // Force redirection to login if not logged in
    if (!state.currentUser || !state.userData) {
      // Prevent infinite redirect loop if already on login or register page
      const currentFile = window.location.pathname.split("/").pop();
      if (currentFile !== "index.html" && currentFile !== "register.html" && currentFile !== "") {
        window.location.href = "index.html";
      }
      return;
    }

    const user = state.userData;
    
    // 1. Render Sidebar
    if (sidebarContainer) {
      let menuItems = [];
      if (user.role === "admin") {
        menuItems = [
          { label: "Dashboard", path: "admin.html", icon: "analytics" },
          { label: "Manage Doctors", path: "admin.html?tab=doctors", icon: "people" },
          { label: "Departments", path: "admin.html?tab=depts", icon: "local_hospital" },
          { label: "System Logs", path: "admin.html?tab=logs", icon: "history" }
        ];
      } else if (user.role === "receptionist") {
        menuItems = [
          { label: "Queue Dashboard", path: "receptionist.html", icon: "format_list_numbered" },
          { label: "Register Patient", path: "receptionist.html?tab=register", icon: "person_add" },
          { label: "Check In Scanner", path: "receptionist.html?tab=scanner", icon: "qr_code_scanner" }
        ];
      } else if (user.role === "doctor") {
        menuItems = [
          { label: "Consult Dashboard", path: "doctor.html", icon: "dashboard" },
          { label: "Queue Control", path: "doctor.html?tab=control", icon: "format_list_numbered" }
        ];
      } else if (user.role === "patient") {
        menuItems = [
          { label: "Patient Portal", path: "patient.html", icon: "person" },
          { label: "Book Appointment", path: "patient.html?tab=book", icon: "event_note" }
        ];
      }

      sidebarContainer.innerHTML = `
        <aside class="sidebar">
          <div>
            <div class="sidebar-brand">
              <div class="sidebar-logo">MQ</div>
              <div class="brand-text">
                <h1>MediQueue AI</h1>
                <span>Hospital System</span>
              </div>
            </div>

            <div class="sidebar-profile">
              <p class="profile-name" title="${user.name}">${user.name}</p>
              <p class="profile-role">${user.role}</p>
              ${user.department ? `<p class="profile-dept" title="${user.department}">${user.department}</p>` : ''}
            </div>

            <nav class="sidebar-nav">
              ${menuItems.map(item => {
                const isActive = activePath === item.path || (activePath + window.location.search) === item.path || (activePath === "admin.html" && item.path === "admin.html" && window.location.search === "") || (activePath === "receptionist.html" && item.path === "receptionist.html" && window.location.search === "") || (activePath === "doctor.html" && item.path === "doctor.html" && window.location.search === "") || (activePath === "patient.html" && item.path === "patient.html" && window.location.search === "");
                return `
                  <a href="${item.path}" class="nav-link ${isActive ? 'active' : ''}">
                    <span class="material-icons-outlined" style="font-size: 1.25rem;">${item.icon}</span>
                    <span>${item.label}</span>
                  </a>
                `;
              }).join("")}
            </nav>
          </div>

          <div class="sidebar-footer">
            <button id="signout-btn" class="nav-link" style="color: var(--color-danger); font-weight: 600;">
              <span class="material-icons-outlined" style="font-size: 1.25rem;">exit_to_app</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>
      `;

      // Attach sign out event
      const signoutBtn = document.getElementById("signout-btn");
      if (signoutBtn) {
        signoutBtn.addEventListener("click", async () => {
          try {
            await logoutUser();
          } catch (e) {
            console.error("Sign out failed", e);
          }
        });
      }
    }

    // 2. Render Navbar
    if (navbarContainer) {
      navbarContainer.innerHTML = `
        <header class="navbar">
          <div style="display: flex; align-items: center;">
            <h2>${user.hospital || "MediQueue General Hospital"}</h2>
            <div class="navbar-status">
              <span class="status-dot"></span>
              <span>Queue Engine Active</span>
            </div>
          </div>

          <div class="navbar-right">
            <div class="navbar-clock">
              <span class="material-icons-outlined" style="font-size: 1.15rem; color: var(--color-text-light);">access_time</span>
              <span id="nav-clock-time">Loading clock...</span>
            </div>
          </div>
        </header>
      `;

      // Start tick clock
      updateClock();
    }
  });
}

let clockInterval = null;
function updateClock() {
  const clockEl = document.getElementById("nav-clock-time");
  if (!clockEl) return;

  if (clockInterval) clearInterval(clockInterval);

  const tick = () => {
    const time = new Date();
    const dateStr = time.toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    clockEl.innerText = `${dateStr} • ${timeStr}`;
  };

  tick();
  clockInterval = setInterval(tick, 1000);
}
