import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import HashMap from './algorithms/HashMap.js';
import Graph from './algorithms/Graph.js';
import PriorityQueue from './algorithms/PriorityQueue.js';

// The global application state
export const state = {
  patients: [],
  doctors: [],
  departments: [],
  systemLogs: [],
  patientMap: new HashMap(),
  hospitalGraph: new Graph(),
  doctorQueues: {}, // maps doctorId -> sorted patient array
  currentUser: null,
  userData: null,
  loading: true
};

const listeners = new Set();
let unsubscribes = [];

// Subscribe helper for UI components
export function subscribe(callback) {
  listeners.add(callback);
  // Execute immediately with the current state
  callback(state);
  return () => {
    listeners.delete(callback);
  };
}

// Notify all subscribers of state changes
export function notify() {
  listeners.forEach(callback => callback({ ...state }));
}

// Helper: Calculate waiting minutes
export function calculateWaitingMinutes(checkInTimeStr) {
  if (!checkInTimeStr) return 0;
  const checkIn = new Date(checkInTimeStr);
  const now = new Date();
  const diffMs = now - checkIn;
  return Math.max(0, Math.floor(diffMs / 60000));
}

// Helper: Calculate priority score
export function calculatePriorityScore(patient) {
  let levelVal = 1;
  if (patient.emergencyLevel === "Critical") levelVal = 4;
  else if (patient.emergencyLevel === "High") levelVal = 3;
  else if (patient.emergencyLevel === "Medium") levelVal = 2;
  
  const age = parseInt(patient.age) || 0;
  const waiting = calculateWaitingMinutes(patient.checkInTime);
  const apptBonus = (patient.appointmentTime && patient.appointmentTime !== "") ? 50 : 0;
  
  return (levelVal * 100) + (age * 2) + waiting + apptBonus;
}

// Logging helper
export async function logAction(action, performedBy, details) {
  try {
    await addDoc(collection(db, "systemLogs"), {
      timestamp: new Date().toISOString(),
      action,
      performedBy,
      details
    });
  } catch (e) {
    console.error("Error writing audit log:", e);
  }
}

// Process data snapshots to build Graph, HashMap, and PriorityQueues
function processDSAModels() {
  const map = new HashMap();
  state.patients.forEach(p => {
    map.put(p.patientId, p);
  });
  state.patientMap = map;

  const graph = new Graph();
  graph.addNode("HOSPITAL-1", { type: "hospital", name: "MediQueue General Hospital" });

  state.departments.forEach(dept => {
    graph.addNode(dept.departmentId, { type: "department", name: dept.departmentName });
    graph.connectNodes("HOSPITAL-1", dept.departmentId, false);
  });

  state.doctors.forEach(docObj => {
    graph.addNode(docObj.doctorId, { 
      type: "doctor", 
      name: docObj.name, 
      department: docObj.department,
      specialization: docObj.specialization,
      availability: docObj.availability,
      status: docObj.status
    });
    const dept = state.departments.find(d => d.departmentName === docObj.department);
    if (dept) {
      graph.connectNodes(dept.departmentId, docObj.doctorId, false);
    }
  });

  const activeCheckedInPatients = state.patients.filter(
    p => p.status === "CheckedIn" || p.status === "InConsultation"
  );

  activeCheckedInPatients.forEach(p => {
    graph.addNode(p.patientId, { type: "patient", name: p.name, emergencyLevel: p.emergencyLevel });
    if (p.doctorAssigned) {
      graph.connectNodes(p.doctorAssigned, p.patientId, false);
    }
  });

  state.hospitalGraph = graph;

  const newDoctorQueues = {};
  state.doctors.forEach(doctor => {
    const docPQ = new PriorityQueue();
    const docPatients = activeCheckedInPatients.filter(
      p => (
        !p.doctorAssigned ||
        p.doctorAssigned === "" ||
        p.doctorAssigned === doctor.doctorId ||
        (p.department && doctor.department && p.department.toLowerCase() === doctor.department.toLowerCase()) ||
        !doctor.department
      ) && p.status === "CheckedIn"
    );

    docPatients.forEach(p => {
      const score = calculatePriorityScore(p);
      docPQ.enqueue(p, score);
    });

    newDoctorQueues[doctor.doctorId] = docPQ.getSortedPatients();
  });

  state.doctorQueues = newDoctorQueues;
}

function withTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
}

// Start real-time Firestore synchronization
function startSync() {
  // Clear any existing listeners
  unsubscribes.forEach(unsub => unsub());
  unsubscribes = [];

  const unsubPatients = onSnapshot(collection(db, "patients"), (snapshot) => {
    state.patients = snapshot.docs.map(docObj => ({ id: docObj.id, ...docObj.data() }));
    processDSAModels();
    notify();
  });

  const unsubDoctors = onSnapshot(collection(db, "doctors"), async (snapshot) => {
    const doctorList = snapshot.docs.map(docObj => ({ id: docObj.id, ...docObj.data() }));
    state.doctors = doctorList;
    
    const defaultDocs = [
      {
        doctorId: "DOC-Aaron",
        name: "Samuel Aaron",
        email: "aaron@hospital.com",
        department: "Neurology",
        specialization: "Neurosurgeon",
        experience: "12 Years",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      },
      {
        doctorId: "DOC-Smith",
        name: "Benjamin Smith",
        email: "smith@hospital.com",
        department: "Orthopedics",
        specialization: "Orthopedist",
        experience: "8 Years",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      },
      {
        doctorId: "DOC-Davis",
        name: "Clara Davis",
        email: "davis@hospital.com",
        department: "Cardiology",
        specialization: "Cardiologist",
        experience: "15 Years",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      },
      {
        doctorId: "DOC-Wilson",
        name: "Daniel Wilson",
        email: "wilson@hospital.com",
        department: "Pediatrics",
        specialization: "Pediatrician",
        experience: "10 Years",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      },
      {
        doctorId: "DOC-Watson",
        name: "Emma Watson",
        email: "watson@hospital.com",
        department: "General Medicine",
        specialization: "General Physician",
        experience: "5 Years",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      }
    ];

    try {
      for (const docObj of defaultDocs) {
        const exists = doctorList.some(d => d.doctorId === docObj.doctorId);
        if (!exists) {
          await setDoc(doc(db, "doctors", docObj.doctorId), docObj);
          await setDoc(doc(db, "users", docObj.doctorId), {
            uid: docObj.doctorId,
            name: docObj.name,
            email: docObj.email,
            role: "doctor",
            hospital: "MediQueue General Hospital",
            department: docObj.department,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error("Auto-seeding doctors failed:", e);
    }

    processDSAModels();
    notify();
  });

  const unsubDepts = onSnapshot(collection(db, "departments"), async (snapshot) => {
    const deptList = snapshot.docs.map(docObj => ({ id: docObj.id, ...docObj.data() }));
    state.departments = deptList;
    
    const defaultDepts = [
      { id: "DEP-100", name: "General Medicine", doctorIds: ["DOC-Watson"] },
      { id: "DEP-101", name: "Pediatrics", doctorIds: ["DOC-Wilson"] },
      { id: "DEP-102", name: "Cardiology", doctorIds: ["DOC-Davis"] },
      { id: "DEP-103", name: "Emergency", doctorIds: [] },
      { id: "DEP-104", name: "Dermatology", doctorIds: [] },
      { id: "DEP-105", name: "Neurology", doctorIds: ["DOC-Aaron"] },
      { id: "DEP-106", name: "Orthopedics", doctorIds: ["DOC-Smith"] }
    ];

    try {
      for (const dept of defaultDepts) {
        const exists = deptList.some(d => d.departmentId === dept.id || d.departmentName === dept.name);
        if (!exists) {
          await setDoc(doc(db, "departments", dept.id), {
            departmentId: dept.id,
            departmentName: dept.name,
            doctorIds: dept.doctorIds,
            averageWaitingTime: 0,
            queueLength: 0
          });
        }
      }
    } catch (e) {
      console.error("Auto-seeding departments failed:", e);
    }

    processDSAModels();
    notify();
  });

  const unsubLogs = onSnapshot(collection(db, "systemLogs"), (snapshot) => {
    state.systemLogs = snapshot.docs
      .map(docObj => ({ id: docObj.id, ...docObj.data() }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);
    notify();
  });

  unsubscribes.push(unsubPatients, unsubDoctors, unsubDepts, unsubLogs);
}

// Stop real-time Firestore synchronization
function stopSync() {
  unsubscribes.forEach(unsub => unsub());
  unsubscribes = [];
  state.patients = [];
  state.doctors = [];
  state.departments = [];
  state.systemLogs = [];
  state.patientMap = new HashMap();
  state.hospitalGraph = new Graph();
  state.doctorQueues = {};
}

// 30-Second recalculation timer for patients check-in
let recalcInterval = null;
function startRecalcTimer() {
  if (recalcInterval) clearInterval(recalcInterval);
  recalcInterval = setInterval(async () => {
    const waitingPatients = state.patients.filter(p => p.status === "CheckedIn");
    if (waitingPatients.length === 0) return;

    const batch = [];
    waitingPatients.forEach(p => {
      const calculatedWaiting = calculateWaitingMinutes(p.checkInTime);
      const newScore = calculatePriorityScore(p);
      
      if (p.priorityScore !== newScore || p.waitingMinutes !== calculatedWaiting) {
        const docRef = doc(db, "patients", p.patientId);
        batch.push(updateDoc(docRef, {
          waitingMinutes: calculatedWaiting,
          priorityScore: newScore,
          updatedAt: new Date().toISOString()
        }));
      }
    });

    if (batch.length > 0) {
      await Promise.all(batch);
    }
  }, 30000);
}

function stopRecalcTimer() {
  if (recalcInterval) {
    clearInterval(recalcInterval);
    recalcInterval = null;
  }
}

// Listen to Firebase Auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.currentUser = user;
    
    // Infer role intelligently from email if profile is unassigned or patient
    const emailLower = (user.email || "").toLowerCase();
    let defaultRole = "patient";
    let defaultDept = "";
    let defaultName = user.email?.split('@')[0] || "User";

    if (emailLower.includes("doctor") || emailLower.includes("watson") || emailLower.includes("davis") || emailLower.includes("aaron") || emailLower.includes("smith") || emailLower.includes("wilson") || emailLower.includes("doc")) {
      defaultRole = "doctor";
      defaultName = "Dr. " + defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
      defaultDept = "General Medicine";
    } else if (emailLower.includes("admin")) {
      defaultRole = "admin";
      defaultName = "System Administrator";
    } else if (emailLower.includes("reception")) {
      defaultRole = "receptionist";
      defaultName = "Receptionist Staff";
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        // If email is clearly a doctor email but user profile was registered as patient, correct the role
        if (defaultRole === "doctor" && uData.role !== "doctor") {
          uData.role = "doctor";
          uData.department = defaultDept;
          uData.name = defaultName;
          await setDoc(doc(db, "users", user.uid), uData, { merge: true }).catch(() => {});
        }
        state.userData = uData;
      } else {
        const newProfile = {
          uid: user.uid,
          name: defaultName,
          email: user.email,
          role: defaultRole,
          department: defaultDept,
          hospital: "MediQueue General Hospital",
          createdAt: new Date().toISOString()
        };
        state.userData = newProfile;
        await setDoc(doc(db, "users", user.uid), newProfile).catch(() => {});
      }

      // Ensure Doctor profile document exists in Firestore 'doctors' collection if role is doctor
      if (state.userData.role === "doctor") {
        const docProfile = {
          doctorId: user.uid,
          name: state.userData.name || defaultName,
          email: user.email,
          department: state.userData.department || "General Medicine",
          specialization: "General Physician",
          experience: "5 Years",
          availability: true,
          patientsCompletedToday: 0,
          queueLength: 0,
          status: "active",
          averageConsultationTime: 15
        };
        await setDoc(doc(db, "doctors", user.uid), docProfile, { merge: true }).catch(() => {});
        
        let existingD = state.doctors.find(d => d.doctorId === user.uid);
        if (!existingD) {
          state.doctors.push(docProfile);
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      state.userData = {
        uid: user.uid,
        name: defaultName,
        email: user.email,
        role: defaultRole,
        department: defaultDept,
        hospital: "MediQueue General Hospital"
      };
    }
    startSync();
    startRecalcTimer();
  } else {
    state.currentUser = null;
    state.userData = null;
    stopSync();
    stopRecalcTimer();
  }
  state.loading = false;
  notify();
});

// Operations / Actions

export async function loginUser(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      try {
        let role = "patient";
        let dept = "";
        let name = email.split('@')[0];
        
        if (email.includes("watson") || email.includes("davis") || email.includes("aaron") || email.includes("smith") || email.includes("wilson") || email.includes("doc")) {
          role = "doctor";
          name = "Dr. " + name.charAt(0).toUpperCase() + name.slice(1);
          if (email.includes("davis")) dept = "Cardiology";
          else if (email.includes("aaron")) dept = "Neurology";
          else if (email.includes("smith")) dept = "Orthopedics";
          else if (email.includes("wilson")) dept = "Pediatrics";
          else dept = "General Medicine";
        } else if (email.includes("admin")) {
          role = "admin";
        } else if (email.includes("reception")) {
          role = "receptionist";
        }

        return await registerUser(email, password, name, role, "MediQueue General Hospital", dept);
      } catch (regErr) {
        console.warn("Auto-register fallback triggered local simulation:", regErr);
        let role = "patient";
        if (email.includes("watson") || email.includes("davis") || email.includes("doc")) role = "doctor";
        else if (email.includes("admin")) role = "admin";
        else if (email.includes("reception")) role = "receptionist";
        simulateLocalLogin(email, role, email.split('@')[0]);
        return { user: state.currentUser };
      }
    }
    throw err;
  }
}

export async function logoutUser() {
  await firebaseSignOut(auth);
  window.location.href = "index.html";
}

export async function registerUser(email, password, name, role, hospital = "MediQueue General Hospital", department = "") {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  const profile = {
    uid: user.uid,
    name,
    email,
    role, // 'admin', 'receptionist', 'doctor', 'patient'
    hospital,
    department,
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, "users", user.uid), profile);
    
    if (role === 'patient') {
      const patientProfile = {
        patientId: user.uid,
        name,
        email,
        gender: "",
        age: "",
        phone: "",
        bloodGroup: "",
        symptoms: "",
        department: "",
        doctorAssigned: "",
        appointmentTime: "",
        checkInTime: "",
        priorityScore: 0,
        emergencyLevel: "Low",
        status: "Registered", // 'Registered', 'CheckedIn', 'InConsultation', 'Completed', 'Skipped'
        waitingMinutes: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "patients", user.uid), patientProfile);
    } else if (role === 'doctor') {
      const doctorProfile = {
        doctorId: user.uid,
        name,
        email,
        department,
        specialization: "General Physician",
        experience: "5 Years",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      };
      await setDoc(doc(db, "doctors", user.uid), doctorProfile);
    }
  } catch (e) {
    console.error("Firestore user profile save failed, using local fallback state:", e);
  }

  // Set memory cache directly for resilience
  state.userData = profile;
  if (role === 'patient') {
    const localPatient = {
      patientId: user.uid,
      name,
      email,
      gender: "",
      age: "",
      phone: "",
      bloodGroup: "",
      symptoms: "",
      department: "",
      doctorAssigned: "",
      appointmentTime: "",
      checkInTime: "",
      priorityScore: 0,
      emergencyLevel: "Low",
      status: "Registered",
      waitingMinutes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!state.patients.some(p => p.patientId === user.uid)) {
      state.patients.push(localPatient);
    }
  } else if (role === 'doctor') {
    const localDoctor = {
      doctorId: user.uid,
      name,
      email,
      department,
      specialization: "General Physician",
      experience: "5 Years",
      availability: true,
      patientsCompletedToday: 0,
      queueLength: 0,
      status: "active",
      averageConsultationTime: 15
    };
    if (!state.doctors.some(d => d.doctorId === user.uid)) {
      state.doctors.push(localDoctor);
    }
  }
  
  processDSAModels();
  notify();
  return user;
}

export async function registerPatient(patientData) {
  const patientId = "P-" + Math.floor(100000 + Math.random() * 900000);
  const newPatient = {
    patientId,
    name: patientData.name,
    gender: patientData.gender,
    age: patientData.age,
    phone: patientData.phone,
    bloodGroup: patientData.bloodGroup || "",
    symptoms: patientData.symptoms,
    department: patientData.department,
    doctorAssigned: patientData.doctorAssigned || "",
    appointmentTime: patientData.appointmentTime || "",
    checkInTime: "",
    priorityScore: 0,
    emergencyLevel: patientData.emergencyLevel || "Low",
    status: "Registered",
    waitingMinutes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.patients.push(newPatient);
  processDSAModels();
  notify();

  try {
    await withTimeout(setDoc(doc(db, "patients", patientId), newPatient), 2000);
    logAction("Register Patient", patientData.registeredBy || "System", `Registered Patient ${patientData.name} (${patientId})`);
  } catch (e) {
    console.warn("Register patient background sync warning:", e);
  }
  return patientId;
}

export async function editPatient(patientId, updatedData) {
  const patientIndex = state.patients.findIndex(p => p.patientId === patientId);
  if (patientIndex > -1) {
    state.patients[patientIndex] = {
      ...state.patients[patientIndex],
      ...updatedData,
      updatedAt: new Date().toISOString()
    };
    processDSAModels();
    notify();
  }

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(setDoc(patientRef, {
      ...updatedData,
      updatedAt: new Date().toISOString()
    }, { merge: true }), 2000);
    logAction("Edit Patient", updatedData.performedBy || "System", `Updated details for ${patientId}`);
  } catch (e) {
    console.warn("Edit patient background sync warning:", e);
  }
}

export async function checkInPatient(patientId, receptionistName) {
  const pData = state.patients.find(p => p.patientId === patientId);
  if (!pData) throw new Error("Patient profile not found");

  const checkInTime = new Date().toISOString();
  const score = calculatePriorityScore({
    ...pData,
    checkInTime
  });

  pData.status = "CheckedIn";
  pData.checkInTime = checkInTime;
  pData.priorityScore = score;
  pData.updatedAt = checkInTime;

  if (pData.doctorAssigned) {
    const doctor = state.doctors.find(d => d.doctorId === pData.doctorAssigned);
    if (doctor) {
      doctor.queueLength = (doctor.queueLength || 0) + 1;
    }
  }

  processDSAModels();
  notify();

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(updateDoc(patientRef, {
      status: "CheckedIn",
      checkInTime,
      priorityScore: score,
      updatedAt: checkInTime
    }), 2000);

    await withTimeout(setDoc(doc(db, "queue", patientId), {
      patientId,
      doctorId: pData.doctorAssigned,
      department: pData.department,
      status: "waiting",
      priorityScore: score,
      checkInTime
    }), 2000);

    if (pData.doctorAssigned) {
      const docRef = doc(db, "doctors", pData.doctorAssigned);
      const doctor = state.doctors.find(d => d.doctorId === pData.doctorAssigned);
      if (doctor) {
        withTimeout(updateDoc(docRef, {
          queueLength: (doctor.queueLength || 0) + 1
        }), 2000);
      }
    }

    logAction("Patient Check-in", receptionistName, `Checked in patient ${pData.name} (${patientId})`);
  } catch (e) {
    console.warn("Check-in background sync warning:", e);
  }
}

export async function emergencyOverride(patientId, newEmergencyLevel, performedBy) {
  const pData = state.patients.find(p => p.patientId === patientId);
  if (!pData) throw new Error("Patient not found");

  const checkInTime = pData.checkInTime || new Date().toISOString();
  pData.emergencyLevel = newEmergencyLevel;
  pData.checkInTime = checkInTime;
  pData.priorityScore = calculatePriorityScore(pData);
  pData.updatedAt = new Date().toISOString();

  processDSAModels();
  notify();

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(updateDoc(patientRef, {
      emergencyLevel: newEmergencyLevel,
      priorityScore: pData.priorityScore,
      updatedAt: pData.updatedAt
    }), 2000);

    const qRef = doc(db, "queue", patientId);
    withTimeout(updateDoc(qRef, {
      priorityScore: pData.priorityScore
    }), 2000).catch(() => {});

    logAction("Emergency Override", performedBy, `Updated emergency level of ${pData.name} to ${newEmergencyLevel}`);
  } catch (e) {
    console.warn("Emergency override background sync warning:", e);
  }
}

export async function assignDoctor(patientId, departmentName, doctorId, performedBy) {
  const pData = state.patients.find(p => p.patientId === patientId);
  if (!pData) throw new Error("Patient not found");

  const oldDoctorId = pData.doctorAssigned;
  pData.department = departmentName;
  pData.doctorAssigned = doctorId;
  pData.updatedAt = new Date().toISOString();

  if (oldDoctorId) {
    const oldDoc = state.doctors.find(d => d.doctorId === oldDoctorId);
    if (oldDoc) {
      oldDoc.queueLength = Math.max(0, (oldDoc.queueLength || 0) - 1);
    }
  }

  if (doctorId) {
    const newDoc = state.doctors.find(d => d.doctorId === doctorId);
    if (newDoc) {
      newDoc.queueLength = (newDoc.queueLength || 0) + 1;
    }
  }
  processDSAModels();
  notify();

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(updateDoc(patientRef, {
      department: departmentName,
      doctorAssigned: doctorId,
      updatedAt: new Date().toISOString()
    }), 2000);

    const qRef = doc(db, "queue", patientId);
    withTimeout(updateDoc(qRef, {
      department: departmentName,
      doctorId: doctorId
    }), 2000).catch(() => {});

    const docObj = state.doctors.find(d => d.doctorId === doctorId);
    logAction("Assign Doctor", performedBy, `Assigned patient ${pData.name} to Dr. ${docObj ? docObj.name : 'Unassigned'}`);
  } catch (e) {
    console.warn("Assign doctor background sync warning:", e);
  }
}

export async function startConsultation(patientId, doctorId, doctorName) {
  const pData = state.patients.find(p => p.patientId === patientId);
  if (pData) {
    pData.status = "InConsultation";
    pData.doctorAssigned = doctorId;
    pData.updatedAt = new Date().toISOString();
    processDSAModels();
    notify();
  }

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(updateDoc(patientRef, {
      status: "InConsultation",
      doctorAssigned: doctorId,
      updatedAt: new Date().toISOString()
    }), 2000);

    const qRef = doc(db, "queue", patientId);
    withTimeout(updateDoc(qRef, {
      status: "in_consultation"
    }), 2000).catch(() => {});

    logAction("Start Consultation", `Dr. ${doctorName}`, `Started consultation with patient (${patientId})`);
  } catch (e) {
    console.warn("Start consultation background sync warning:", e);
  }
}

export async function completeConsultation(patientId, doctorId, doctorName, notes, prescription) {
  const pData = state.patients.find(p => p.patientId === patientId);
  if (pData) {
    pData.status = "Completed";
    pData.medicalNotes = notes || "";
    pData.prescription = prescription || "";
    pData.updatedAt = new Date().toISOString();
  }
  const doctor = state.doctors.find(d => d.doctorId === doctorId);
  if (doctor) {
    doctor.patientsCompletedToday = (doctor.patientsCompletedToday || 0) + 1;
    doctor.queueLength = Math.max(0, (doctor.queueLength || 0) - 1);
  }
  processDSAModels();
  notify();

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(updateDoc(patientRef, {
      status: "Completed",
      medicalNotes: notes || "",
      prescription: prescription || "",
      updatedAt: new Date().toISOString()
    }), 2000);

    withTimeout(deleteDoc(doc(db, "queue", patientId)), 2000).catch(() => {});

    if (doctor) {
      const docRef = doc(db, "doctors", doctorId);
      withTimeout(updateDoc(docRef, {
        patientsCompletedToday: doctor.patientsCompletedToday,
        queueLength: doctor.queueLength
      }), 2000);
    }

    withTimeout(addDoc(collection(db, "appointments"), {
      patientId,
      doctorId,
      doctorName,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      notes: notes || "",
      prescription: prescription || "",
      status: "completed",
      createdAt: new Date().toISOString()
    }), 2000);

    logAction("Complete Consultation", `Dr. ${doctorName}`, `Completed consultation for ${patientId}`);
  } catch (e) {
    console.warn("Complete consultation background sync warning:", e);
  }
}

export async function skipPatient(patientId, doctorId, doctorName) {
  const pData = state.patients.find(p => p.patientId === patientId);
  if (pData) {
    pData.status = "Skipped";
    pData.updatedAt = new Date().toISOString();
  }
  const doctor = state.doctors.find(d => d.doctorId === doctorId);
  if (doctor) {
    doctor.queueLength = Math.max(0, (doctor.queueLength || 0) - 1);
  }
  processDSAModels();
  notify();

  try {
    const patientRef = doc(db, "patients", patientId);
    await withTimeout(updateDoc(patientRef, {
      status: "Skipped",
      updatedAt: new Date().toISOString()
    }), 2000);

    const qRef = doc(db, "queue", patientId);
    withTimeout(updateDoc(qRef, {
      status: "skipped"
    }), 2000).catch(() => {});

    logAction("Skip Patient", `Dr. ${doctorName}`, `Skipped patient ${patientId}`);
  } catch (e) {
    console.warn("Skip patient background sync warning:", e);
  }
}

export async function toggleDoctorStatus(doctorId, currentStatus, doctorName) {
  const doctor = state.doctors.find(d => d.doctorId === doctorId);
  if (doctor) {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    doctor.status = newStatus;
    doctor.availability = (newStatus === "active");
    processDSAModels();
    notify();

    try {
      const docRef = doc(db, "doctors", doctorId);
      await withTimeout(updateDoc(docRef, {
        status: newStatus,
        availability: (newStatus === "active")
      }), 2000);
      logAction(newStatus === "active" ? "Resume Queue" : "Pause Queue", `Dr. ${doctorName}`, `Toggled queue state to ${newStatus}`);
    } catch (e) {
      console.warn("Toggle doctor status background sync warning:", e);
    }
  }
}

export async function bookAppointment(patientId, appointmentData) {
  const tokenNumber = "MQ-" + Math.floor(100 + Math.random() * 900);
  
  if (!patientId) {
    if (state.currentUser?.uid) {
      patientId = state.currentUser.uid;
    } else {
      patientId = "PAT-" + Math.floor(1000 + Math.random() * 9000);
    }
  }

  // Auto-assign a doctor matching the selected department if doctorId is empty or unassigned
  let assignedDoctorId = appointmentData.doctorId || "";
  let assignedDoctorName = appointmentData.doctorName || "Unassigned";

  if (!assignedDoctorId || assignedDoctorId === "" || assignedDoctorName === "Unassigned") {
    const matchingDoctor = state.doctors.find(
      d => d.department && (appointmentData.department || "").toLowerCase().includes(d.department.toLowerCase()) || d.department.toLowerCase().includes((appointmentData.department || "").toLowerCase())
    );
    if (matchingDoctor) {
      assignedDoctorId = matchingDoctor.doctorId;
      assignedDoctorName = matchingDoctor.name;
    } else if (state.doctors.length > 0) {
      assignedDoctorId = state.doctors[0].doctorId;
      assignedDoctorName = state.doctors[0].name;
    }
  }

  const nowStr = new Date().toISOString();
  const appointmentTimeStr = `${appointmentData.date} ${appointmentData.time}`;

  const patientDataToSave = {
    patientId,
    name: state.userData?.name || state.currentUser?.email?.split('@')[0] || "Patient",
    email: state.currentUser?.email || "",
    gender: "Other",
    age: "30",
    phone: "",
    bloodGroup: "",
    symptoms: appointmentData.notes || "",
    appointmentTime: appointmentTimeStr,
    doctorAssigned: assignedDoctorId,
    department: appointmentData.department,
    status: "CheckedIn",
    tokenNumber,
    checkInTime: nowStr,
    priorityScore: 0,
    emergencyLevel: appointmentData.emergencyLevel || "Low",
    waitingMinutes: 0,
    createdAt: nowStr,
    updatedAt: nowStr
  };

  // 1. Immediately update in-memory state so UI updates WITHOUT delay
  let pIdx = state.patients.findIndex(p => p.patientId === patientId);
  if (pIdx > -1) {
    state.patients[pIdx] = { ...state.patients[pIdx], ...patientDataToSave };
  } else {
    state.patients.push(patientDataToSave);
  }
  processDSAModels();
  notify();

  // 2. Perform Firestore network operations asynchronously with a 2-second timeout to avoid blocking UI
  try {
    const appointmentId = "A-" + Math.floor(100000 + Math.random() * 900000);
    await withTimeout(setDoc(doc(db, "appointments", appointmentId), {
      appointmentId,
      patientId,
      doctorId: assignedDoctorId,
      doctorName: assignedDoctorName,
      department: appointmentData.department,
      date: appointmentData.date,
      time: appointmentData.time,
      status: "scheduled",
      notes: appointmentData.notes || "",
      tokenNumber,
      createdAt: nowStr
    }), 2000);

    const patientRef = doc(db, "patients", patientId);
    await withTimeout(setDoc(patientRef, patientDataToSave, { merge: true }), 2000);

    logAction("Book Appointment", "Patient", `Booked appointment ${appointmentId} with Dr. ${assignedDoctorName} (Auto-Checked In, Token: ${tokenNumber})`);
  } catch (e) {
    console.warn("Firestore write network delay/offline fallback, kept local state updated:", e);
  }

  return tokenNumber;
}

export function simulateLocalLogin(email, role, name) {
  const uid = "DEMO-" + role.toUpperCase();
  state.currentUser = { uid, email };
  state.userData = {
    uid,
    name,
    email,
    role,
    hospital: "MediQueue General Hospital",
    department: role === "doctor" ? "General Medicine" : ""
  };
  
  if (role === 'patient') {
    const localPatient = {
      patientId: uid,
      name,
      email,
      gender: "Male",
      age: "25",
      phone: "1234567890",
      bloodGroup: "O+",
      symptoms: "",
      department: "",
      doctorAssigned: "",
      appointmentTime: "",
      checkInTime: "",
      priorityScore: 0,
      emergencyLevel: "Low",
      status: "Registered",
      waitingMinutes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!state.patients.some(p => p.patientId === uid)) {
      state.patients.push(localPatient);
    }
  } else if (role === 'doctor') {
    const localDoctor = {
      doctorId: uid,
      name: name,
      email,
      department: "General Medicine",
      specialization: "General Physician",
      experience: "5 Years",
      availability: true,
      patientsCompletedToday: 0,
      queueLength: 0,
      status: "active",
      averageConsultationTime: 15
    };
    if (!state.doctors.some(d => d.doctorId === uid)) {
      state.doctors.push(localDoctor);
    }
  }
  
  state.loading = false;
  processDSAModels();
  notify();
}
