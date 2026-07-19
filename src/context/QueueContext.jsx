import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebase/config.js";
import PriorityQueue from "../algorithms/PriorityQueue.js";
import HashMap from "../algorithms/HashMap.js";
import Graph from "../algorithms/Graph.js";

const QueueContext = createContext();

export function useQueue() {
  return useContext(QueueContext);
}

export function QueueProvider({ children }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [queues, setQueues] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  const [patientMap, setPatientMap] = useState(new HashMap());
  const [hospitalGraph, setHospitalGraph] = useState(new Graph());
  
  const [doctorQueues, setDoctorQueues] = useState({});
  const [systemLogs, setSystemLogs] = useState([]);

  const calculateWaitingMinutes = (checkInTimeStr) => {
    if (!checkInTimeStr) return 0;
    const checkIn = new Date(checkInTimeStr);
    const now = new Date();
    const diffMs = now - checkIn;
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const calculatePriorityScore = (patient) => {
    let levelVal = 1;
    if (patient.emergencyLevel === "Critical") levelVal = 4;
    else if (patient.emergencyLevel === "High") levelVal = 3;
    else if (patient.emergencyLevel === "Medium") levelVal = 2;
    
    const age = parseInt(patient.age) || 0;
    const waiting = calculateWaitingMinutes(patient.checkInTime);
    const apptBonus = (patient.appointmentTime && patient.appointmentTime !== "") ? 50 : 0;
    
    return (levelVal * 100) + (age * 2) + waiting + apptBonus;
  };

  const logAction = async (action, performedBy, details) => {
    try {
      await addDoc(collection(db, "systemLogs"), {
        timestamp: new Date().toISOString(),
        action,
        performedBy,
        details
      });
    } catch (e) {
      console.error("Error writing log:", e);
    }
  };

  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, "patients"), (snapshot) => {
      const patientList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(patientList);
    });

    const unsubDoctors = onSnapshot(collection(db, "doctors"), (snapshot) => {
      const doctorList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDoctors(doctorList);
    });

    const unsubQueue = onSnapshot(collection(db, "queue"), (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQueues(qList);
    });

    const unsubDepts = onSnapshot(collection(db, "departments"), async (snapshot) => {
      const deptList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDepartments(deptList);
      
      if (deptList.length === 0) {
        const defaultDepts = [
          { id: "DEP-100", name: "General Medicine" },
          { id: "DEP-101", name: "Pediatrics" },
          { id: "DEP-102", name: "Cardiology" },
          { id: "DEP-103", name: "Emergency" },
          { id: "DEP-104", name: "Dermatology" }
        ];
        try {
          for (const dept of defaultDepts) {
            await setDoc(doc(db, "departments", dept.id), {
              departmentId: dept.id,
              departmentName: dept.name,
              doctorIds: [],
              averageWaitingTime: 0,
              queueLength: 0
            });
          }
        } catch (e) {
          console.error("Auto-seeding departments failed:", e);
        }
      }
    });

    const unsubLogs = onSnapshot(collection(db, "systemLogs"), (snapshot) => {
      const logs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
      setSystemLogs(logs);
    });

    return () => {
      unsubPatients();
      unsubDoctors();
      unsubQueue();
      unsubDepts();
      unsubLogs();
    };
  }, []);

  useEffect(() => {
    const map = new HashMap();
    patients.forEach(p => {
      map.put(p.patientId, p);
    });
    setPatientMap(map);

    const graph = new Graph();
    graph.addNode("HOSPITAL-1", { type: "hospital", name: "MediQueue General Hospital" });

    departments.forEach(dept => {
      graph.addNode(dept.departmentId, { type: "department", name: dept.departmentName });
      graph.connectNodes("HOSPITAL-1", dept.departmentId, false);
    });

    doctors.forEach(doc => {
      graph.addNode(doc.doctorId, { 
        type: "doctor", 
        name: doc.name, 
        department: doc.department,
        specialization: doc.specialization,
        availability: doc.availability,
        status: doc.status
      });
      const dept = departments.find(d => d.departmentName === doc.department);
      if (dept) {
        graph.connectNodes(dept.departmentId, doc.doctorId, false);
      }
    });

    const activeCheckedInPatients = patients.filter(
      p => p.status === "CheckedIn" || p.status === "InConsultation"
    );

    activeCheckedInPatients.forEach(p => {
      graph.addNode(p.patientId, { type: "patient", name: p.name, emergencyLevel: p.emergencyLevel });
      if (p.doctorAssigned) {
        graph.connectNodes(p.doctorAssigned, p.patientId, false);
      }
    });

    setHospitalGraph(graph);

    const newDoctorQueues = {};

    doctors.forEach(doc => {
      const docPQ = new PriorityQueue();
      
      const docPatients = activeCheckedInPatients.filter(
        p => p.doctorAssigned === doc.doctorId && p.status === "CheckedIn"
      );

      docPatients.forEach(p => {
        const score = calculatePriorityScore(p);
        docPQ.enqueue(p, score);
      });

      newDoctorQueues[doc.doctorId] = docPQ.getSortedPatients();
    });

    setDoctorQueues(newDoctorQueues);
  }, [patients, doctors, queues, departments]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const waitingPatients = patients.filter(p => p.status === "CheckedIn");
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

    return () => clearInterval(interval);
  }, [patients]);

  const registerPatient = async (patientData) => {
    try {
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

      await setDoc(doc(db, "patients", patientId), newPatient);
      await logAction("Register Patient", patientData.registeredBy || "System", `Registered Patient ${patientData.name} (${patientId})`);
      
      return patientId;
    } catch (e) {
      console.error("Register Patient error:", e);
      throw e;
    }
  };

  const editPatient = async (patientId, updatedData) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        ...updatedData,
        updatedAt: new Date().toISOString()
      });
      await logAction("Edit Patient", updatedData.performedBy || "System", `Updated details for ${patientId}`);
    } catch (e) {
      console.error("Edit Patient error:", e);
      throw e;
    }
  };

  const checkInPatient = async (patientId, receptionistName) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      const checkInTime = new Date().toISOString();
      
      const pData = patients.find(p => p.patientId === patientId);
      if (!pData) throw new Error("Patient not found in cache");

      const score = calculatePriorityScore({
        ...pData,
        checkInTime
      });

      await updateDoc(patientRef, {
        status: "CheckedIn",
        checkInTime,
        priorityScore: score,
        updatedAt: new Date().toISOString()
      });

      await setDoc(doc(db, "queue", patientId), {
        patientId,
        doctorId: pData.doctorAssigned,
        department: pData.department,
        status: "waiting",
        priorityScore: score,
        checkInTime
      });

      if (pData.doctorAssigned) {
        const docRef = doc(db, "doctors", pData.doctorAssigned);
        const doctor = doctors.find(d => d.doctorId === pData.doctorAssigned);
        if (doctor) {
          await updateDoc(docRef, {
            queueLength: (doctor.queueLength || 0) + 1
          });
        }
      }

      await logAction("Patient Check-in", receptionistName, `Checked in patient ${pData.name} (${patientId})`);
    } catch (e) {
      console.error("Check-in error:", e);
      throw e;
    }
  };

  const emergencyOverride = async (patientId, newEmergencyLevel, performedBy) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      const pData = patients.find(p => p.patientId === patientId);
      if (!pData) throw new Error("Patient not found");

      const checkInTime = pData.checkInTime || new Date().toISOString();
      const updatedPatient = {
        ...pData,
        emergencyLevel: newEmergencyLevel,
        checkInTime
      };

      const newScore = calculatePriorityScore(updatedPatient);

      await updateDoc(patientRef, {
        emergencyLevel: newEmergencyLevel,
        priorityScore: newScore,
        updatedAt: new Date().toISOString()
      });

      const qRef = doc(db, "queue", patientId);
      await updateDoc(qRef, {
        priorityScore: newScore
      });

      await logAction("Emergency Override", performedBy, `Updated emergency level of ${pData.name} to ${newEmergencyLevel}`);
    } catch (e) {
      console.error("Emergency override error:", e);
      throw e;
    }
  };

  const assignDoctor = async (patientId, departmentName, doctorId, performedBy) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      const pData = patients.find(p => p.patientId === patientId);
      if (!pData) throw new Error("Patient not found");

      const oldDoctorId = pData.doctorAssigned;

      await updateDoc(patientRef, {
        department: departmentName,
        doctorAssigned: doctorId,
        updatedAt: new Date().toISOString()
      });

      const qRef = doc(db, "queue", patientId);
      await updateDoc(qRef, {
        department: departmentName,
        doctorId: doctorId
      });

      if (oldDoctorId) {
        const oldDocRef = doc(db, "doctors", oldDoctorId);
        const oldDoc = doctors.find(d => d.doctorId === oldDoctorId);
        if (oldDoc) {
          await updateDoc(oldDocRef, {
            queueLength: Math.max(0, (oldDoc.queueLength || 0) - 1)
          });
        }
      }

      if (doctorId) {
        const newDocRef = doc(db, "doctors", doctorId);
        const newDoc = doctors.find(d => d.doctorId === doctorId);
        if (newDoc) {
          await updateDoc(newDocRef, {
            queueLength: (newDoc.queueLength || 0) + 1
          });
        }
      }

      const docObj = doctors.find(d => d.doctorId === doctorId);
      await logAction("Assign Doctor", performedBy, `Assigned patient ${pData.name} to Dr. ${docObj ? docObj.name : 'Unassigned'}`);
    } catch (e) {
      console.error("Assign doctor error:", e);
      throw e;
    }
  };

  const startConsultation = async (patientId, doctorId, doctorName) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        status: "InConsultation",
        updatedAt: new Date().toISOString()
      });

      const qRef = doc(db, "queue", patientId);
      await updateDoc(qRef, {
        status: "in_consultation"
      });

      await logAction("Start Consultation", `Dr. ${doctorName}`, `Started consultation with patient (${patientId})`);
    } catch (e) {
      console.error("Start consultation error:", e);
      throw e;
    }
  };

  const completeConsultation = async (patientId, doctorId, doctorName, notes, prescription) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        status: "Completed",
        medicalNotes: notes || "",
        prescription: prescription || "",
        updatedAt: new Date().toISOString()
      });

      await deleteDoc(doc(db, "queue", patientId));

      const docRef = doc(db, "doctors", doctorId);
      const doctor = doctors.find(d => d.doctorId === doctorId);
      if (doctor) {
        await updateDoc(docRef, {
          patientsCompletedToday: (doctor.patientsCompletedToday || 0) + 1,
          queueLength: Math.max(0, (doctor.queueLength || 0) - 1)
        });
      }

      await addDoc(collection(db, "appointments"), {
        patientId,
        doctorId,
        doctorName,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        notes: notes || "",
        prescription: prescription || "",
        status: "completed",
        createdAt: new Date().toISOString()
      });

      await logAction("Complete Consultation", `Dr. ${doctorName}`, `Completed consultation and wrote prescription for ${patientId}`);
    } catch (e) {
      console.error("Complete consultation error:", e);
      throw e;
    }
  };

  const skipPatient = async (patientId, doctorId, doctorName) => {
    try {
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        status: "Skipped",
        updatedAt: new Date().toISOString()
      });

      const qRef = doc(db, "queue", patientId);
      await updateDoc(qRef, {
        status: "skipped"
      });

      const docRef = doc(db, "doctors", doctorId);
      const doctor = doctors.find(d => d.doctorId === doctorId);
      if (doctor) {
        await updateDoc(docRef, {
          queueLength: Math.max(0, (doctor.queueLength || 0) - 1)
        });
      }

      await logAction("Skip Patient", `Dr. ${doctorName}`, `Skipped patient ${patientId} in queue.`);
    } catch (e) {
      console.error("Skip patient error:", e);
      throw e;
    }
  };

  const toggleDoctorStatus = async (doctorId, currentStatus, doctorName) => {
    try {
      const docRef = doc(db, "doctors", doctorId);
      const newStatus = currentStatus === "active" ? "paused" : "active";
      await updateDoc(docRef, {
        status: newStatus,
        availability: newStatus === "active"
      });
      await logAction(newStatus === "active" ? "Resume Queue" : "Pause Queue", `Dr. ${doctorName}`, `Toggled queue state to ${newStatus}`);
    } catch (e) {
      console.error("Toggle doctor status error:", e);
      throw e;
    }
  };

  const bookAppointment = async (patientId, appointmentData) => {
    try {
      const appointmentId = "A-" + Math.floor(100000 + Math.random() * 900000);
      await setDoc(doc(db, "appointments", appointmentId), {
        appointmentId,
        patientId,
        doctorId: appointmentData.doctorId,
        doctorName: appointmentData.doctorName,
        date: appointmentData.date,
        time: appointmentData.time,
        status: "scheduled",
        notes: appointmentData.notes || "",
        createdAt: new Date().toISOString()
      });

      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, {
        appointmentTime: `${appointmentData.date} ${appointmentData.time}`,
        doctorAssigned: appointmentData.doctorId,
        department: appointmentData.department,
        updatedAt: new Date().toISOString()
      });

      await logAction("Book Appointment", "Patient", `Booked appointment ${appointmentId} with Dr. ${appointmentData.doctorName}`);
    } catch (e) {
      console.error("Book appointment error:", e);
      throw e;
    }
  };

  const value = {
    patients,
    doctors,
    queues,
    departments,
    patientMap,
    hospitalGraph,
    doctorQueues,
    systemLogs,
    registerPatient,
    editPatient,
    checkInPatient,
    emergencyOverride,
    assignDoctor,
    startConsultation,
    completeConsultation,
    skipPatient,
    toggleDoctorStatus,
    bookAppointment,
    calculatePriorityScore,
    logAction
  };

  return (
    <QueueContext.Provider value={value}>
      {children}
    </QueueContext.Provider>
  );
}
