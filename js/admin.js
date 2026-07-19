import { db } from './firebase-config.js';
import { subscribe, logAction } from './state.js';
import { initLayout } from './components.js';
import { showToast } from './toast.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize navbar and sidebar layout
initLayout("admin.html");

// Tab state and DOM elements
let activeTab = "analytics";
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-content-panel");

// Global chart instances
let deptChartInstance = null;
let emergencyChartInstance = null;

// Setup Tab Toggling
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    switchTab(targetTab);
  });
});

function switchTab(tabName) {
  activeTab = tabName;
  
  // Update button active state
  tabButtons.forEach(btn => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update panels display
  tabPanels.forEach(panel => {
    const id = panel.getAttribute("id");
    if (id === `tab-${tabName}`) {
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  });

  // Sync state parameters to URL
  const newUrl = `${window.location.pathname}?tab=${tabName}`;
  window.history.pushState({ path: newUrl }, '', newUrl);

  // Trigger state refresh to draw charts if switched to analytics
  triggerCurrentStateRefresh();
}

// Read URL params on load to set active tab
const urlParams = new URLSearchParams(window.location.search);
const initialTab = urlParams.get("tab");
if (initialTab) {
  switchTab(initialTab);
}

// Form logic elements
const addDoctorForm = document.getElementById("add-doctor-form");
const addDeptForm = document.getElementById("add-dept-form");

// Global cache for departments list to populate doctor form dropdown
let cachedDepts = [];

// Recursive rendering function for Graph ADT Adjacency List structure
function createGraphNodeHTML(node) {
  const isRoot = node.type === "hospital";
  const isDept = node.type === "department";
  const isDoc = node.type === "doctor";
  const isPat = node.type === "patient";

  let nodeClass = "graph-node-patient";
  if (isRoot) nodeClass = "graph-node-hospital";
  else if (isDept) nodeClass = "graph-node-department";
  else if (isDoc) nodeClass = "graph-node-doctor";
  else if (isPat && node.emergencyLevel === "Critical") nodeClass = "graph-node-patient critical";

  let badgeHtml = "";
  if (isDoc) {
    badgeHtml = `<span style="font-size: 0.65rem; color: var(--color-text-medium); margin-left: 0.25rem;">(${node.availability ? "Online" : "Offline"})</span>`;
  } else if (isPat) {
    badgeHtml = `<span style="font-size: 0.65rem; color: var(--color-danger); margin-left: 0.25rem; font-weight: 700;">(${node.emergencyLevel})</span>`;
  }

  const hasChildren = node.children && node.children.length > 0;
  
  return `
    <div class="graph-node-wrapper">
      <div class="graph-node ${nodeClass}">
        <span class="graph-node-type">[${node.type}]</span>
        <span>${node.name}</span>
        ${badgeHtml}
      </div>
      ${hasChildren ? `
        <div class="graph-node-children">
          ${node.children.map(child => createGraphNodeHTML(child)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

// Global reference to the current state for redraw triggers
let latestState = null;
function triggerCurrentStateRefresh() {
  if (latestState) renderPage(latestState);
}

// Subscribe to state changes and drive the DOM elements
subscribe((state) => {
  if (state.loading || !state.userData) return;
  latestState = state;
  renderPage(state);
});

function renderPage(state) {
  // Update Metrics
  const totalPatients = state.patients.length;
  const onlineDocs = state.doctors.filter(d => d.availability).length;
  const emergencyCount = state.patients.filter(p => p.status === "CheckedIn" && p.emergencyLevel === "Critical").length;
  const waitingPatientsCount = state.patients.filter(p => p.status === "CheckedIn").length;
  const avgWaitTime = waitingPatientsCount > 0
    ? Math.floor(state.patients.filter(p => p.status === "CheckedIn").reduce((acc, curr) => acc + (curr.waitingMinutes || 0), 0) / waitingPatientsCount)
    : 0;

  document.getElementById("metric-total-patients").innerText = totalPatients;
  document.getElementById("metric-online-docs").innerText = onlineDocs;
  document.getElementById("metric-emergency-count").innerText = emergencyCount;
  document.getElementById("metric-avg-waiting").innerHTML = `${avgWaitTime} <span style="font-size: 0.85rem; font-weight: 500; color: var(--color-text-medium);">mins</span>`;

  // Draw Charts
  if (activeTab === "analytics") {
    drawCharts(state);
  }

  // Populate Doctor Department select dropdown
  const docDeptSelect = document.getElementById("doc-dept");
  if (docDeptSelect && JSON.stringify(cachedDepts) !== JSON.stringify(state.departments)) {
    cachedDepts = state.departments;
    docDeptSelect.innerHTML = `<option value="">Select Department</option>` + 
      state.departments.map(d => `<option value="${d.departmentName}">${d.departmentName}</option>`).join("");
  }

  // Render Doctors Table
  const doctorsBody = document.getElementById("doctors-list-body");
  if (doctorsBody) {
    if (state.doctors.length === 0) {
      doctorsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-light);">No doctors added yet.</td></tr>`;
    } else {
      doctorsBody.innerHTML = state.doctors.map(docObj => `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--color-text-dark);">${docObj.name}</div>
            <div style="font-size: 0.75rem; color: var(--color-text-light);">${docObj.email}</div>
          </td>
          <td>${docObj.department}</td>
          <td>${docObj.experience} (${docObj.specialization})</td>
          <td>
            <span class="badge ${docObj.availability ? 'badge-checked-in' : 'badge-low'}">
              ${docObj.availability ? 'Available' : 'Unavailable'}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-danger delete-doc-btn" data-id="${docObj.doctorId}" data-name="${docObj.name}" data-dept="${docObj.department}" style="padding: 0.35rem 0.65rem;">
              <span class="material-icons-outlined" style="font-size: 1rem;">delete</span>
            </button>
          </td>
        </tr>
      `).join("");

      // Bind delete doctor buttons
      document.querySelectorAll(".delete-doc-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const docId = btn.getAttribute("data-id");
          const docName = btn.getAttribute("data-name");
          const docDeptName = btn.getAttribute("data-dept");
          if (confirm(`Are you sure you want to delete profile for ${docName}?`)) {
            handleDeleteDoctor(docId, docDeptName);
          }
        });
      });
    }
  }

  // Render Departments Table
  const deptsBody = document.getElementById("depts-list-body");
  if (deptsBody) {
    if (state.departments.length === 0) {
      deptsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-light);">No departments created yet.</td></tr>`;
    } else {
      deptsBody.innerHTML = state.departments.map(d => `
        <tr>
          <td>${d.departmentId}</td>
          <td style="font-weight: 600;">${d.departmentName}</td>
          <td>${(d.doctorIds || []).length} Doctors assigned</td>
          <td style="text-align: right;">
            <button class="btn btn-danger delete-dept-btn" data-id="${d.departmentId}" data-name="${d.departmentName}" style="padding: 0.35rem 0.65rem;">
              <span class="material-icons-outlined" style="font-size: 1rem;">delete</span>
            </button>
          </td>
        </tr>
      `).join("");

      // Bind delete department buttons
      document.querySelectorAll(".delete-dept-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const deptId = btn.getAttribute("data-id");
          const deptName = btn.getAttribute("data-name");
          if (confirm(`Are you sure you want to delete department: ${deptName}?`)) {
            handleDeleteDept(deptId);
          }
        });
      });
    }
  }

  // Render Graph Tree
  const graphContainer = document.getElementById("graph-visual-container");
  if (graphContainer && state.hospitalGraph) {
    const treeStructure = state.hospitalGraph.getTreeStructure();
    if (treeStructure.length === 0) {
      graphContainer.innerHTML = `<div style="text-align: center; color: var(--color-text-light); padding: 2rem;">Graph structure empty.</div>`;
    } else {
      graphContainer.innerHTML = treeStructure.map(node => createGraphNodeHTML(node)).join("");
    }
  }

  // Render Logs Table
  const logsBody = document.getElementById("logs-list-body");
  if (logsBody) {
    if (state.systemLogs.length === 0) {
      logsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-light);">No activity audit logs found.</td></tr>`;
    } else {
      logsBody.innerHTML = state.systemLogs.map(log => `
        <tr>
          <td style="font-size: 0.75rem; color: var(--color-text-light); font-variant-numeric: tabular-nums;">
            ${new Date(log.timestamp).toLocaleString()}
          </td>
          <td style="font-weight: 600;">${log.action}</td>
          <td>${log.performedBy}</td>
          <td style="font-size: 0.8rem; color: var(--color-text-medium);">${log.details}</td>
        </tr>
      `).join("");
    }
  }
}

// Draw chart analytics using Chart.js CDN
function drawCharts(state) {
  const deptCtx = document.getElementById("dept-chart");
  const emergencyCtx = document.getElementById("emergency-chart");
  
  if (!deptCtx || !emergencyCtx) return;

  // A. Department Active Queues Load
  if (deptChartInstance) deptChartInstance.destroy();
  const deptCounts = {};
  state.departments.forEach(d => {
    deptCounts[d.departmentName] = 0;
  });
  state.patients.forEach(p => {
    if (p.status === "CheckedIn" || p.status === "InConsultation") {
      if (deptCounts[p.department] !== undefined) {
        deptCounts[p.department]++;
      }
    }
  });

  deptChartInstance = new Chart(deptCtx, {
    type: "bar",
    data: {
      labels: Object.keys(deptCounts),
      datasets: [{
        label: "Patients in Queue",
        data: Object.values(deptCounts),
        backgroundColor: "#2563EB",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  // B. Emergency levels distribution
  if (emergencyChartInstance) emergencyChartInstance.destroy();
  const emergencyCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  state.patients.forEach(p => {
    if (p.status === "CheckedIn") {
      if (emergencyCounts[p.emergencyLevel] !== undefined) {
        emergencyCounts[p.emergencyLevel]++;
      }
    }
  });

  emergencyChartInstance = new Chart(emergencyCtx, {
    type: "doughnut",
    data: {
      labels: Object.keys(emergencyCounts),
      datasets: [{
        data: Object.values(emergencyCounts),
        backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// Add Doctor submit form handler
addDoctorForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("doc-name").value;
  const email = document.getElementById("doc-email").value;
  const docDept = document.getElementById("doc-dept").value;
  const spec = document.getElementById("doc-spec").value;
  const exp = document.getElementById("doc-exp").value;

  if (!name || !email || !docDept) {
    showToast("Please fill in all fields.", "error");
    return;
  }

  const docId = "DOC-" + Math.floor(100000 + Math.random() * 900000);

  try {
    // Save details to doctors collection
    await setDoc(doc(db, "doctors", docId), {
      doctorId: docId,
      name,
      email,
      department: docDept,
      specialization: spec || "General Physician",
      experience: exp || "1 Year",
      availability: true,
      patientsCompletedToday: 0,
      queueLength: 0,
      status: "active",
      averageConsultationTime: 15
    });

    // Save profile for auth linkage
    await setDoc(doc(db, "users", docId), {
      uid: docId,
      name,
      email,
      role: "doctor",
      hospital: "MediQueue General Hospital",
      department: docDept,
      createdAt: new Date().toISOString()
    });

    // Update Department doctors list
    const dept = cachedDepts.find(d => d.departmentName === docDept);
    if (dept) {
      const docIds = dept.doctorIds || [];
      await setDoc(doc(db, "departments", dept.departmentId), {
        ...dept,
        doctorIds: [...docIds, docId]
      });
    }

    await logAction("Register Doctor Staff", latestState.userData?.name || "Admin", `Created doctor account for ${name} (${docId})`);
    showToast(`Doctor profile created for ${name}`, "success");
    addDoctorForm.reset();
  } catch (err) {
    console.error("Firestore doctor creation failed, falling back to local simulation:", err);
    
    // Offline local simulation fallback for demo resilience
    const newDoc = {
      doctorId: docId,
      name,
      email,
      department: docDept,
      specialization: spec || "General Physician",
      experience: exp || "1 Year",
      availability: true,
      patientsCompletedToday: 0,
      queueLength: 0,
      status: "active",
      averageConsultationTime: 15
    };
    latestState.doctors.push(newDoc);
    
    const dept = cachedDepts.find(d => d.departmentName === docDept);
    if (dept) {
      dept.doctorIds = [...(dept.doctorIds || []), docId];
    }
    
    await logAction("Register Doctor Staff", latestState.userData?.name || "Admin", `Created doctor account for ${name} (${docId})`);
    showToast(`Doctor profile created locally for ${name}`, "success");
    addDoctorForm.reset();
    triggerCurrentStateRefresh();
  }
});

// Delete Doctor handler
async function handleDeleteDoctor(docId, deptName) {
  try {
    await deleteDoc(doc(db, "doctors", docId));
    await deleteDoc(doc(db, "users", docId));
    
    // Remove doctor from Department list
    const dept = cachedDepts.find(d => d.departmentName === deptName);
    if (dept) {
      const docIds = (dept.doctorIds || []).filter(id => id !== docId);
      await setDoc(doc(db, "departments", dept.departmentId), {
        ...dept,
        doctorIds: docIds
      });
    }

    await logAction("Delete Doctor Profile", latestState.userData?.name || "Admin", `Removed doctor profile ${docId}`);
    showToast("Doctor profile deleted successfully.", "warning");
  } catch (err) {
    console.error("Firestore doctor delete failed, falling back to local simulation:", err);
    
    // Offline local simulation fallback
    latestState.doctors = latestState.doctors.filter(d => d.doctorId !== docId);
    const dept = cachedDepts.find(d => d.departmentName === deptName);
    if (dept) {
      dept.doctorIds = (dept.doctorIds || []).filter(id => id !== docId);
    }
    
    await logAction("Delete Doctor Profile", latestState.userData?.name || "Admin", `Removed doctor profile ${docId}`);
    showToast("Doctor profile deleted locally.", "warning");
    triggerCurrentStateRefresh();
  }
}

// Add Department submit form handler
addDeptForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const deptNameVal = document.getElementById("dept-name").value;
  if (!deptNameVal) return;

  const deptId = "DEP-" + Math.floor(100000 + Math.random() * 900000);

  try {
    await setDoc(doc(db, "departments", deptId), {
      departmentId: deptId,
      departmentName: deptNameVal,
      doctorIds: [],
      averageWaitingTime: 0,
      queueLength: 0
    });

    await logAction("Create Department", latestState.userData?.name || "Admin", `Created department ${deptNameVal} (${deptId})`);
    showToast(`Department "${deptNameVal}" created.`, "success");
    addDeptForm.reset();
  } catch (err) {
    console.error("Firestore department creation failed, falling back to local simulation:", err);
    
    // Offline local simulation fallback
    const newDept = {
      departmentId: deptId,
      departmentName: deptNameVal,
      doctorIds: [],
      averageWaitingTime: 0,
      queueLength: 0
    };
    latestState.departments.push(newDept);
    
    await logAction("Create Department", latestState.userData?.name || "Admin", `Created department ${deptNameVal} (${deptId})`);
    showToast(`Department "${deptNameVal}" created locally.`, "success");
    addDeptForm.reset();
    triggerCurrentStateRefresh();
  }
});

// Delete Department handler
async function handleDeleteDept(deptId) {
  try {
    await deleteDoc(doc(db, "departments", deptId));
    await logAction("Delete Department", latestState.userData?.name || "Admin", `Removed department ${deptId}`);
    showToast("Department deleted successfully.", "warning");
  } catch (err) {
    console.error("Firestore department delete failed, falling back to local simulation:", err);
    
    // Offline local simulation fallback
    latestState.departments = latestState.departments.filter(d => d.departmentId !== deptId);
    
    await logAction("Delete Department", latestState.userData?.name || "Admin", `Removed department ${deptId}`);
    showToast("Department deleted locally.", "warning");
    triggerCurrentStateRefresh();
  }
}
