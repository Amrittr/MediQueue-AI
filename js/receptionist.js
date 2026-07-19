import { subscribe, registerPatient, checkInPatient, emergencyOverride, assignDoctor } from './state.js';
import { initLayout } from './components.js';
import { showToast } from './toast.js';

// Initialize navbar and sidebar
initLayout("receptionist.html");

// Modal DOM elements
const registerModal = document.getElementById("register-modal");
const scannerModal = document.getElementById("scanner-modal");
const overrideModal = document.getElementById("override-modal");

// Action buttons to open modals
const openScannerBtn = document.getElementById("open-scanner-btn");
const openRegisterBtn = document.getElementById("open-register-btn");

// Close buttons listeners
document.querySelectorAll("[data-close]").forEach(el => {
  el.addEventListener("click", () => {
    const modalId = el.getAttribute("data-close");
    closeModal(document.getElementById(modalId));
  });
});

function openModal(modal) {
  modal.classList.add("active");
  if (modal === scannerModal) {
    startScanner();
  }
}

function closeModal(modal) {
  modal.classList.remove("active");
  if (modal === scannerModal) {
    stopScanner();
  }
}

openRegisterBtn.addEventListener("click", () => openModal(registerModal));
openScannerBtn.addEventListener("click", () => openModal(scannerModal));

// Dropdowns and cache lists
let cachedDoctors = [];
let cachedDepts = [];
let cachedPatientMap = null;
let cachedPatientsList = [];

// Handle dynamic doctor options based on selected department in Forms
const regDeptSelect = document.getElementById("reg-dept");
const regDocSelect = document.getElementById("reg-doc");
const overrideDeptSelect = document.getElementById("override-dept");
const overrideDocSelect = document.getElementById("override-doc");

function setupDeptDoctorDropdownMapping(deptSelect, docSelect) {
  deptSelect.addEventListener("change", () => {
    const deptVal = deptSelect.value;
    if (!deptVal) {
      docSelect.innerHTML = `<option value="">Select Doctor</option>`;
      return;
    }
    // Filter doctors assigned to this department
    const filteredDocs = cachedDoctors.filter(d => d.department === deptVal && d.availability);
    docSelect.innerHTML = `<option value="">Select Doctor</option>` + 
      filteredDocs.map(d => `<option value="${d.doctorId}">Dr. ${d.name} (${d.specialization})</option>`).join("");
  });
}

setupDeptDoctorDropdownMapping(regDeptSelect, regDocSelect);
setupDeptDoctorDropdownMapping(overrideDeptSelect, overrideDocSelect);

// Dynamic search/filter caching
const searchInput = document.getElementById("search-input");
const filterDept = document.getElementById("filter-dept");
const filterStatus = document.getElementById("filter-status");

let searchTerm = "";
let deptFilter = "";
let statusFilter = "";

const handleFilterChange = () => {
  searchTerm = searchInput.value.toLowerCase().trim();
  deptFilter = filterDept.value;
  statusFilter = filterStatus.value;
  renderPatientsTable();
};

searchInput.addEventListener("input", handleFilterChange);
filterDept.addEventListener("change", handleFilterChange);
filterStatus.addEventListener("change", handleFilterChange);

// Subscriptions
subscribe((state) => {
  if (state.loading || !state.userData) return;

  cachedDoctors = state.doctors;
  cachedPatientMap = state.patientMap;
  cachedPatientsList = state.patients;

  // Populate filter department select once
  if (JSON.stringify(cachedDepts) !== JSON.stringify(state.departments)) {
    cachedDepts = state.departments;
    
    const deptOpts = state.departments.map(d => `<option value="${d.departmentName}">${d.departmentName}</option>`).join("");
    
    filterDept.innerHTML = `<option value="">All Departments</option>` + deptOpts;
    regDeptSelect.innerHTML = `<option value="">Select Department</option>` + deptOpts;
    overrideDeptSelect.innerHTML = `<option value="">Select Department</option>` + deptOpts;
  }

  // Populate Patient List
  renderPatientsTable();
});

function renderPatientsTable() {
  const tableBody = document.getElementById("patient-table-body");
  if (!tableBody) return;

  const filtered = cachedPatientsList.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm) ||
      p.patientId.toLowerCase().includes(searchTerm) ||
      (p.phone && p.phone.includes(searchTerm));
    
    const matchesDept = deptFilter === "" || p.department === deptFilter;
    const matchesStatus = statusFilter === "" || p.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-light);">No patient files found matching filters.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(p => {
    const docObj = cachedDoctors.find(d => d.doctorId === p.doctorAssigned);
    
    // Select status badge class
    let statusClass = "badge-low";
    if (p.status === "CheckedIn") statusClass = "badge-checked-in";
    else if (p.status === "InConsultation") statusClass = "badge-medium";
    else if (p.status === "Completed") statusClass = "badge-low";
    else if (p.status === "Skipped") statusClass = "badge-critical";

    // Select emergency badge class
    let emergencyClass = "badge-low";
    if (p.emergencyLevel === "Critical") emergencyClass = "badge-critical";
    else if (p.emergencyLevel === "High") emergencyClass = "badge-high";
    else if (p.emergencyLevel === "Medium") emergencyClass = "badge-medium";

    // Action buttons display
    let checkInBtn = "";
    if (p.status === "Registered") {
      checkInBtn = `
        <button class="btn btn-success checkin-manual-btn" data-id="${p.patientId}" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
          Check In
        </button>
      `;
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--color-text-dark);">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-light);">ID: ${p.patientId} • Age: ${p.age} • Gen: ${p.gender}</div>
        </td>
        <td>
          <div style="font-weight: 500; color: var(--color-text-medium);">${p.department || 'Unassigned'}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-light);">${docObj ? `Dr. ${docObj.name}` : 'Pending assignment'}</div>
        </td>
        <td>
          <span class="badge ${statusClass}">${p.status === 'CheckedIn' ? 'Checked In' : p.status}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge ${emergencyClass}">${p.emergencyLevel}</span>
            <span style="font-weight: bold; font-size: 0.75rem; color: var(--color-text-medium);">Score: ${p.priorityScore || 0}</span>
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 0.5rem; align-items: center;">
            ${checkInBtn}
            <button class="btn btn-secondary edit-file-btn" data-id="${p.patientId}" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
              Edit File
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Attach button event listeners
  document.querySelectorAll(".checkin-manual-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pId = btn.getAttribute("data-id");
      handleManualCheckIn(pId);
    });
  });

  document.querySelectorAll(".edit-file-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pId = btn.getAttribute("data-id");
      openEditModal(pId);
    });
  });
}

// Action: Handle manual check in click
async function handleManualCheckIn(patientId) {
  try {
    const receptionistName = "Receptionist Staff"; // Fallback name
    await checkInPatient(patientId, receptionistName);
    showToast("Patient Checked In successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Check-in failed.", "error");
  }
}

// Modal Form Action: Patient registration submit
const registerForm = document.getElementById("patient-register-form");
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value;
  const age = document.getElementById("reg-age").value;
  const gender = document.getElementById("reg-gender").value;
  const phone = document.getElementById("reg-phone").value;
  const symptoms = document.getElementById("reg-symptoms").value;
  const department = regDeptSelect.value;
  const doctorAssigned = regDocSelect.value;
  const emergencyLevel = document.getElementById("reg-emergency").value;

  try {
    const pId = await registerPatient({
      name,
      age,
      gender,
      phone,
      symptoms,
      department,
      doctorAssigned,
      emergencyLevel,
      registeredBy: "Receptionist Desk"
    });

    showToast(`Patient registered successfully! ID: ${pId}`, "success");
    closeModal(registerModal);
    registerForm.reset();
    regDocSelect.innerHTML = `<option value="">Select Doctor</option>`;
  } catch (err) {
    console.error(err);
    showToast("Registration failed.", "error");
  }
});

// Modal Actions: Edit File / Triage override modal setup
function openEditModal(patientId) {
  const p = cachedPatientsList.find(p => p.patientId === patientId);
  if (!p) return;

  document.getElementById("override-patient-id").value = p.patientId;
  document.getElementById("override-patient-id-display").innerText = `${p.name} (${p.patientId})`;
  document.getElementById("override-emergency").value = p.emergencyLevel;
  overrideDeptSelect.value = p.department || "";
  
  // Trigger department doctors list load
  const event = new Event('change');
  overrideDeptSelect.dispatchEvent(event);
  overrideDocSelect.value = p.doctorAssigned || "";

  openModal(overrideModal);
}

const overrideForm = document.getElementById("patient-override-form");
overrideForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const patientId = document.getElementById("override-patient-id").value;
  const p = cachedPatientsList.find(p => p.patientId === patientId);
  if (!p) return;

  const newEmergency = document.getElementById("override-emergency").value;
  const newDept = overrideDeptSelect.value;
  const newDoc = overrideDocSelect.value;

  try {
    const performedBy = "Receptionist Desk";
    
    // Save emergency level if changed
    if (newEmergency !== p.emergencyLevel) {
      await emergencyOverride(patientId, newEmergency, performedBy);
    }

    // Save doctor/department assignments if changed
    if (newDept !== p.department || newDoc !== p.doctorAssigned) {
      await assignDoctor(patientId, newDept, newDoc, performedBy);
    }

    showToast("Patient file updated successfully!", "success");
    closeModal(overrideModal);
  } catch (err) {
    console.error(err);
    showToast("Failed to update patient file.", "error");
  }
});

// QR Pass Scanner Implementation
let html5QrcodeScanner = null;

function startScanner() {
  try {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "qr-reader", 
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
  } catch (err) {
    console.error("Scanner failed to start:", err);
    showToast("Camera access error. Please check camera connection and permission.", "error");
    const container = document.getElementById("qr-reader");
    if (container) {
      container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--color-danger); font-weight: 600;">Camera Connection Error or Permission Denied.</div>`;
    }
  }
}

function stopScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(err => console.error("Error clearing scanner", err));
    html5QrcodeScanner = null;
  }
}

async function onScanSuccess(scannedUid) {
  // Check key in manual hash map
  if (!cachedPatientMap || !cachedPatientMap.has(scannedUid)) {
    showToast("Invalid pass! No patient profile linked to this ID.", "error");
    return;
  }

  try {
    const receptionistName = "Receptionist Desk Scanner";
    await checkInPatient(scannedUid, receptionistName);
    showToast("Patient Checked In successfully!", "success");
    closeModal(scannerModal);
  } catch (err) {
    console.error(err);
    showToast("Failed to check in patient via QR.", "error");
  }
}

function onScanFailure(errorMessage) {
  // Suppress logs for continuous frame failure to avoid clogging logs
}
