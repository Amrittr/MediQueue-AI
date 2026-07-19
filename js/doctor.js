import { subscribe, toggleDoctorStatus, startConsultation, completeConsultation, skipPatient } from './state.js';
import { initLayout } from './components.js';
import { showToast } from './toast.js';

// Initialize navbar and sidebar layout
initLayout("doctor.html");

// Tab toggling DOM elements
let activeTab = "consult";
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-content-panel");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    switchTab(targetTab);
  });
});

function switchTab(tabName) {
  activeTab = tabName;
  tabButtons.forEach(btn => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  tabPanels.forEach(panel => {
    const id = panel.getAttribute("id");
    if (id === `tab-${tabName}`) {
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  });

  const newUrl = `${window.location.pathname}?tab=${tabName}`;
  window.history.pushState({ path: newUrl }, '', newUrl);
}

// Read url params for tab setting
const urlParams = new URLSearchParams(window.location.search);
const initialTab = urlParams.get("tab");
if (initialTab) {
  switchTab(initialTab);
}

// Doctor Portal logic variables
let currentDoctorId = null;
let currentDoctorProfile = null;
let activeConsultingPatient = null;
let sortedDoctorQueue = [];
let isSubmitting = false;

// UI binding elements
const toggleQueueBtn = document.getElementById("toggle-queue-btn");
const pausedBanner = document.getElementById("paused-alert-banner");

const activeConsultCard = document.getElementById("active-consultation-card");
const emptyConsultState = document.getElementById("empty-consultation-state");

const consultForm = document.getElementById("consultation-form");
const medicalNotesInput = document.getElementById("medical-notes");
const prescriptionInput = document.getElementById("prescription");

// Subscribe to global store
subscribe((state) => {
  if (state.loading || !state.currentUser || !state.userData) return;

  currentDoctorId = state.currentUser.uid;
  currentDoctorProfile = state.doctors.find(d => d.doctorId === currentDoctorId);
  sortedDoctorQueue = state.doctorQueues[currentDoctorId] || [];

  // Find if there is an active patient in consultation room
  activeConsultingPatient = state.patients.find(
    p => p.doctorAssigned === currentDoctorId && p.status === "InConsultation"
  );

  // 1. Populate Doctor Meta Details
  if (currentDoctorProfile) {
    document.getElementById("doc-meta-name").innerText = `Dr. ${currentDoctorProfile.name}`;
    document.getElementById("doc-meta-specialty").innerText = `${currentDoctorProfile.department} • ${currentDoctorProfile.specialization}`;
    document.getElementById("doc-meta-completed").innerText = currentDoctorProfile.patientsCompletedToday || 0;
    document.getElementById("doc-meta-queuesize").innerText = sortedDoctorQueue.length;

    // Paused alert banner display
    const isPaused = currentDoctorProfile.status === "paused";
    pausedBanner.style.display = isPaused ? "flex" : "none";

    // Set pause/resume button status styling
    if (isPaused) {
      toggleQueueBtn.className = "btn btn-success";
      toggleQueueBtn.innerHTML = `<span class="material-icons-outlined">play_arrow</span> <span>Resume Consultations</span>`;
    } else {
      toggleQueueBtn.className = "btn";
      toggleQueueBtn.style.backgroundColor = "var(--color-warning-light)";
      toggleQueueBtn.style.color = "var(--color-warning-hover)";
      toggleQueueBtn.style.border = "1px solid #fde68a";
      toggleQueueBtn.innerHTML = `<span class="material-icons-outlined">pause</span> <span>Pause Consultations</span>`;
    }
  }

  // 2. Render Active Consultation Room Card or Empty Room
  if (activeConsultingPatient) {
    emptyConsultState.style.display = "none";
    activeConsultCard.style.display = "block";

    document.getElementById("consult-pat-name").innerText = activeConsultingPatient.name;
    document.getElementById("consult-pat-details").innerText = `ID: ${activeConsultingPatient.patientId} • Age: ${activeConsultingPatient.age} • Gender: ${activeConsultingPatient.gender}`;
    
    // Set priority badge
    const badgeEl = document.getElementById("consult-pat-priority-badge");
    badgeEl.className = `badge badge-${getEmergencyBadgeClass(activeConsultingPatient.emergencyLevel)}`;
    badgeEl.innerText = `${activeConsultingPatient.emergencyLevel} Priority`;

    // Symptoms box
    const symptomsBox = document.getElementById("consult-pat-symptoms-box");
    const symptomsText = document.getElementById("consult-pat-symptoms-text");
    if (activeConsultingPatient.symptoms) {
      symptomsBox.style.display = "block";
      symptomsText.innerText = activeConsultingPatient.symptoms;
    } else {
      symptomsBox.style.display = "none";
    }
  } else {
    activeConsultCard.style.display = "none";
    emptyConsultState.style.display = "block";
  }

  // 3. Render Queue Control Table tab
  renderQueueControlTable();

  // 4. Render Sidebar Mini Queue List
  renderMiniQueueSidebar();
});

function getEmergencyBadgeClass(level) {
  if (level === "Critical") return "critical";
  if (level === "High") return "high";
  if (level === "Medium") return "medium";
  return "low";
}

function renderQueueControlTable() {
  const tableBody = document.getElementById("waiting-queue-body");
  if (!tableBody) return;

  if (sortedDoctorQueue.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-light);">No patients in queue lobby.</td></tr>`;
    return;
  }

  tableBody.innerHTML = sortedDoctorQueue.map((p, index) => {
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--color-text-dark);">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-light);">ID: ${p.patientId} • Age: ${p.age} • Gen: ${p.gender}</div>
        </td>
        <td style="font-weight: bold; font-variant-numeric: tabular-nums;">
          ${p.priorityScore || 0}
        </td>
        <td>
          <span class="badge badge-${getEmergencyBadgeClass(p.emergencyLevel)}">${p.emergencyLevel}</span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-primary call-patient-btn" data-id="${p.patientId}" ${index > 0 ? 'style="opacity:0.6; padding:0.4rem 0.85rem;"' : 'style="padding:0.4rem 0.85rem;"'}>
            <span class="material-icons-outlined" style="font-size:1rem;">play_arrow</span>
            <span>Call Room</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach button triggers
  document.querySelectorAll(".call-patient-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pId = btn.getAttribute("data-id");
      handleCallPatient(pId);
    });
  });
}

function renderMiniQueueSidebar() {
  const listEl = document.getElementById("sidebar-queue-list");
  if (!listEl) return;

  if (sortedDoctorQueue.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: var(--color-text-light); font-size: 0.8rem; padding: 2rem 0;">Lobby is empty</div>`;
    return;
  }

  listEl.innerHTML = sortedDoctorQueue.map((p, idx) => {
    return `
      <div style="background-color: var(--color-bg-app); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 600; font-size: 0.8rem; color: var(--color-text-dark);">${idx + 1}. ${p.name}</div>
          <div style="font-size: 0.7rem; color: var(--color-text-light);">ID: ${p.patientId} • Score: ${p.priorityScore || 0}</div>
        </div>
        <span class="badge badge-${getEmergencyBadgeClass(p.emergencyLevel)}" style="font-size: 0.65rem; padding: 0.15rem 0.45rem;">
          ${p.emergencyLevel}
        </span>
      </div>
    `;
  }).join("");
}

// Action: Handle starting consultation
async function handleCallPatient(patientId) {
  if (!currentDoctorProfile || isSubmitting) return;

  if (currentDoctorProfile.status === "paused") {
    showToast("Resume consultations queue before calling next patient.", "warning");
    return;
  }

  if (activeConsultingPatient) {
    showToast("Please complete the current consultation before calling another patient.", "warning");
    return;
  }

  isSubmitting = true;
  try {
    await startConsultation(patientId, currentDoctorId, currentDoctorProfile.name);
    showToast("Patient called to consultation room.", "success");
    // Switch to consult tab automatically
    switchTab("consult");
  } catch (err) {
    console.error(err);
    showToast("Failed to call patient.", "error");
  } finally {
    isSubmitting = false;
  }
}

// Empty State: Call next patient quick trigger
document.getElementById("call-next-empty-btn").addEventListener("click", () => {
  if (sortedDoctorQueue.length === 0) {
    showToast("Queue lobby is empty.", "warning");
    return;
  }
  const nextPat = sortedDoctorQueue[0];
  handleCallPatient(nextPat.patientId);
});

// Action: Complete consultation submission
consultForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeConsultingPatient || !currentDoctorProfile || isSubmitting) return;

  const notes = medicalNotesInput.value;
  const prescription = prescriptionInput.value;

  isSubmitting = true;
  try {
    await completeConsultation(
      activeConsultingPatient.patientId,
      currentDoctorId,
      currentDoctorProfile.name,
      notes,
      prescription
    );
    showToast("Consultation files written and saved successfully.", "success");
    consultForm.reset();
  } catch (err) {
    console.error(err);
    showToast("Failed to save consultation summary.", "error");
  } finally {
    isSubmitting = false;
  }
});

// Action: Skip patient
document.getElementById("skip-pat-btn").addEventListener("click", async () => {
  if (!activeConsultingPatient || !currentDoctorProfile || isSubmitting) return;

  if (confirm(`Are you sure you want to skip patient "${activeConsultingPatient.name}"? They will be flagged as skipped.`)) {
    isSubmitting = true;
    try {
      await skipPatient(activeConsultingPatient.patientId, currentDoctorId, currentDoctorProfile.name);
      showToast("Patient flagged as skipped in database.", "warning");
      consultForm.reset();
    } catch (err) {
      console.error(err);
      showToast("Failed to skip patient.", "error");
    } finally {
      isSubmitting = false;
    }
  }
});

// Action: Pause / Resume queue status toggle
toggleQueueBtn.addEventListener("click", async () => {
  if (!currentDoctorProfile) return;

  try {
    await toggleDoctorStatus(currentDoctorId, currentDoctorProfile.status, currentDoctorProfile.name);
    showToast(
      `Queue consultations is now ${currentDoctorProfile.status === 'active' ? 'Paused' : 'Active'}`,
      "info"
    );
  } catch (err) {
    console.error(err);
    showToast("Failed to change queue status.", "error");
  }
});
