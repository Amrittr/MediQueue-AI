import { subscribe, bookAppointment, editPatient } from './state.js';
import { initLayout } from './components.js';
import { showToast } from './toast.js';

// Initialize navbar and sidebar layout
initLayout("patient.html");

// Tab toggling DOM elements
let activeTab = "portal";
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

// Redirect quick trigger button
document.getElementById("book-appointment-redirect-btn").addEventListener("click", () => {
  switchTab("book");
});

// Patient state variables
let currentPatientId = null;
let currentPatientProfile = null;
let cachedDoctors = [];
let cachedDepts = [];

// Dropdown mappings
const bookDeptSelect = document.getElementById("book-dept");
const bookDocSelect = document.getElementById("book-doc");
const profileDeptSelect = document.getElementById("profile-dept");
const profileDocSelect = document.getElementById("profile-doc");

function setupDeptDoctorDropdownMapping(deptSelect, docSelect) {
  deptSelect.addEventListener("change", () => {
    const deptVal = deptSelect.value;
    if (!deptVal) {
      docSelect.innerHTML = `<option value="">Select Doctor</option>`;
      docSelect.disabled = true;
      return;
    }
    // Filter available doctors in department
    const filteredDocs = cachedDoctors.filter(d => d.department === deptVal && d.availability);
    docSelect.innerHTML = `<option value="">Select Doctor</option>` + 
      filteredDocs.map(d => `<option value="${d.doctorId}">Dr. ${d.name} (${d.specialization})</option>`).join("");
    docSelect.disabled = false;
  });
}

setupDeptDoctorDropdownMapping(bookDeptSelect, bookDocSelect);
setupDeptDoctorDropdownMapping(profileDeptSelect, profileDocSelect);

// Form elements
const bookingForm = document.getElementById("appointment-booking-form");
const profileForm = document.getElementById("patient-profile-form");

// Subscribe to global store
let isFirstLoad = true;
subscribe((state) => {
  if (state.loading || !state.currentUser || !state.userData) return;

  currentPatientId = state.currentUser.uid;
  currentPatientProfile = state.patients.find(p => p.patientId === currentPatientId);
  cachedDoctors = state.doctors;

  // Render static credentials
  document.getElementById("patient-welcome-title").innerText = `Welcome, ${state.userData.name}`;
  document.getElementById("patient-meta-id").innerText = `Patient ID: ${currentPatientId}`;

  // Generate QR pass link details
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${currentPatientId}`;
  document.getElementById("qr-pass-img").src = qrUrl;
  document.getElementById("qr-pass-id").innerText = currentPatientId;
  document.getElementById("qr-download-link").href = qrUrl;

  // Load departments lists once
  if (JSON.stringify(cachedDepts) !== JSON.stringify(state.departments)) {
    cachedDepts = state.departments;
    const deptOpts = state.departments.map(d => `<option value="${d.departmentName}">${d.departmentName}</option>`).join("");
    bookDeptSelect.innerHTML = `<option value="">Select Department</option>` + deptOpts;
    profileDeptSelect.innerHTML = `<option value="">Select Department</option>` + deptOpts;
  }

  // Sync profile details into inputs on first load
  if (currentPatientProfile && isFirstLoad) {
    isFirstLoad = false;
    document.getElementById("profile-age").value = currentPatientProfile.age || "";
    document.getElementById("profile-gender").value = currentPatientProfile.gender || "";
    document.getElementById("profile-phone").value = currentPatientProfile.phone || "";
    document.getElementById("profile-blood").value = currentPatientProfile.bloodGroup || "";
    document.getElementById("profile-symptoms").value = currentPatientProfile.symptoms || "";
    
    if (currentPatientProfile.department) {
      profileDeptSelect.value = currentPatientProfile.department;
      // Trigger change event to populate doctors list
      const event = new Event('change');
      profileDeptSelect.dispatchEvent(event);
      profileDocSelect.value = currentPatientProfile.doctorAssigned || "";
    }
  }

  // 1. Render Live Queue Position Card or Unchecked-in box
  const liveQueueBox = document.getElementById("live-queue-status-box");
  const uncheckedBox = document.getElementById("unchecked-queue-box");
  const reportCard = document.getElementById("consultation-report-card");

  if (currentPatientProfile) {
    const isQueued = currentPatientProfile.status === "CheckedIn" || currentPatientProfile.status === "InConsultation";
    
    if (isQueued) {
      liveQueueBox.style.display = "block";
      uncheckedBox.style.display = "none";
      
      const docId = currentPatientProfile.doctorAssigned;
      const docObj = state.doctors.find(d => d.doctorId === docId);
      const sortedQueue = state.doctorQueues[docId] || [];
      const index = sortedQueue.findIndex(p => p.patientId === currentPatientId);

      document.getElementById("queue-assigned-doctor").innerText = docObj ? `Assigned to Dr. ${docObj.name}` : "Assigned Specialist";
      
      // Pause status badge alert
      const isPaused = docObj?.status === "paused";
      document.getElementById("queue-doctor-paused-badge").style.display = isPaused ? "inline-flex" : "none";

      const posVal = document.getElementById("queue-position-val");
      const aheadVal = document.getElementById("queue-patients-ahead");
      const waitVal = document.getElementById("queue-wait-val");
      const lobbyBanner = document.getElementById("queue-lobby-banner");

      if (currentPatientProfile.status === "InConsultation") {
        posVal.innerText = "Active";
        posVal.style.fontSize = "1.5rem";
        aheadVal.innerText = "No patients ahead";
        waitVal.innerHTML = `0 <span style="font-size: 0.85rem; font-weight: 500;">mins</span>`;
        lobbyBanner.innerText = "It's your turn! Please head into the consultation room.";
      } else if (index > -1) {
        posVal.innerText = index + 1;
        posVal.style.fontSize = "2rem";
        aheadVal.innerText = `${index} patient(s) ahead`;
        
        const avgTime = docObj ? parseInt(docObj.averageConsultationTime) || 15 : 15;
        waitVal.innerHTML = `${index * avgTime} <span style="font-size: 0.85rem; font-weight: 500;">mins</span>`;
        lobbyBanner.innerText = "Please wait in the lobby. We will notify you when Dr. Ready calls you.";
      } else {
        // Safe fallback if queue list Firestore hasn't compiled yet
        posVal.innerText = "...";
        aheadVal.innerText = "Calculating...";
        waitVal.innerHTML = `... <span style="font-size: 0.85rem; font-weight: 500;">mins</span>`;
      }
    } else {
      liveQueueBox.style.display = "none";
      uncheckedBox.style.display = "block";
      
      // Upcoming slot details display
      const upcomingSlotCard = document.getElementById("upcoming-slot-card");
      if (currentPatientProfile.appointmentTime) {
        upcomingSlotCard.style.display = "block";
        document.getElementById("upcoming-slot-time").innerText = currentPatientProfile.appointmentTime;
        
        const slotDocObj = state.doctors.find(d => d.doctorId === currentPatientProfile.doctorAssigned);
        document.getElementById("upcoming-slot-doctor").innerText = `With Dr. ${slotDocObj ? slotDocObj.name : 'Specialist Assigned'}`;
      } else {
        upcomingSlotCard.style.display = "none";
      }
    }
    // 2. Render Medical report files
    const hasReport = currentPatientProfile.medicalNotes || currentPatientProfile.prescription;
    if (hasReport) {
      reportCard.style.display = "block";
      const notesBox = document.getElementById("report-notes-box");
      const notesText = document.getElementById("report-notes-text");
      const presBox = document.getElementById("report-prescription-box");
      const presText = document.getElementById("report-prescription-text");

      if (currentPatientProfile.medicalNotes) {
        notesBox.style.display = "block";
        notesText.innerText = currentPatientProfile.medicalNotes;
      } else {
        notesBox.style.display = "none";
      }

      if (currentPatientProfile.prescription) {
        presBox.style.display = "block";
        presText.innerText = currentPatientProfile.prescription;
      } else {
        presBox.style.display = "none";
      }
    } else {
      reportCard.style.display = "none";
    }
  } else {
    // Fallback if patient profile is not loaded / found
    liveQueueBox.style.display = "none";
    uncheckedBox.style.display = "block";
    document.getElementById("upcoming-slot-card").style.display = "none";
    reportCard.style.display = "none";
  }
});

// Action: Handle booking form submission
bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dept = bookDeptSelect.value;
  const doctorId = bookDocSelect.value;
  const date = document.getElementById("book-date").value;
  const time = document.getElementById("book-time").value;
  const notes = document.getElementById("book-notes").value;

  if (!dept || !doctorId || !date || !time) {
    showToast("Please fill in all slots.", "error");
    return;
  }

  try {
    const docObj = cachedDoctors.find(d => d.doctorId === doctorId);
    await bookAppointment(currentPatientId, {
      doctorId,
      doctorName: docObj ? docObj.name : "Assigned Specialist",
      department: dept,
      date,
      time,
      notes
    });

    alert("Slot booked!");
    window.location.reload();
  } catch (err) {
    console.error(err);
    showToast("Booking failed. Please try again.", "error");
  }
});

// Action: Handle Profile update submission
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const age = document.getElementById("profile-age").value;
  const gender = document.getElementById("profile-gender").value;
  const phone = document.getElementById("profile-phone").value;
  const bloodGroup = document.getElementById("profile-blood").value;
  const symptoms = document.getElementById("profile-symptoms").value;
  const preferredDept = profileDeptSelect.value;
  const preferredDoc = profileDocSelect.value;

  try {
    await editPatient(currentPatientId, {
      age,
      gender,
      phone,
      bloodGroup,
      symptoms,
      department: preferredDept,
      doctorAssigned: preferredDoc,
      performedBy: "Patient Profile Editor"
    });
    showToast("Profile file details updated successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update profile details.", "error");
  }
});
