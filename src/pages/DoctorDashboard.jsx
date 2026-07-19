import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useQueue } from "../context/QueueContext.jsx";
import Toast from "../components/Toast.jsx";
import { 
  MdPlayArrow, 
  MdPause, 
  MdSkipNext, 
  MdCheck, 
  MdHistory, 
  MdAssignment, 
  MdLocalPharmacy 
} from "react-icons/md";

export default function DoctorDashboard() {
  const { currentUser } = useAuth();
  const { 
    doctors, 
    doctorQueues, 
    startConsultation, 
    completeConsultation, 
    skipPatient, 
    toggleDoctorStatus,
    patients 
  } = useQueue();

  const [docInfo, setDocInfo] = useState(null);
  const [activeQueue, setActiveQueue] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  
  // Consultation Form States
  const [medicalNotes, setMedicalNotes] = useState("");
  const [prescription, setPrescription] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync Doctor's custom metadata
  useEffect(() => {
    if (currentUser && doctors.length > 0) {
      const activeDoc = doctors.find(d => d.doctorId === currentUser.uid);
      if (activeDoc) {
        setDocInfo(activeDoc);
      }
    }
  }, [currentUser, doctors]);

  // Sync Doctor's sorted queue & active patient
  useEffect(() => {
    if (currentUser) {
      const sortedQueue = doctorQueues[currentUser.uid] || [];
      setActiveQueue(sortedQueue);

      // Check if there is already a patient in consultation
      const inConsult = patients.find(
        p => p.doctorAssigned === currentUser.uid && p.status === "InConsultation"
      );
      setCurrentPatient(inConsult || null);
    }
  }, [currentUser, doctorQueues, patients]);

  const handleStartConsultation = async (patientId) => {
    if (!docInfo) return;
    setLoading(true);
    try {
      await startConsultation(patientId, currentUser.uid, docInfo.name);
      setToast({ message: "Consultation started.", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to start consultation.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteConsultation = async (e) => {
    e.preventDefault();
    if (!currentPatient || !docInfo) return;
    
    setLoading(true);
    try {
      await completeConsultation(
        currentPatient.patientId, 
        currentUser.uid, 
        docInfo.name, 
        medicalNotes, 
        prescription
      );
      setToast({ message: "Consultation completed and saved.", type: "success" });
      setMedicalNotes("");
      setPrescription("");
      setCurrentPatient(null);
    } catch (err) {
      setToast({ message: "Failed to complete consultation.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPatient = async (patientId) => {
    if (!docInfo) return;
    setLoading(true);
    try {
      await skipPatient(patientId, currentUser.uid, docInfo.name);
      setToast({ message: "Patient skipped in queue.", type: "warning" });
    } catch (err) {
      setToast({ message: "Failed to skip patient.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleQueue = async () => {
    if (!docInfo) return;
    try {
      await toggleDoctorStatus(currentUser.uid, docInfo.status, docInfo.name);
      setToast({ 
        message: `Queue ${docInfo.status === "active" ? "Paused" : "Resumed"}`, 
        type: "info" 
      });
    } catch (err) {
      setToast({ message: "Failed to change queue status.", type: "error" });
    }
  };

  const nextPatient = activeQueue.length > 0 ? activeQueue[0] : null;

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto">
      {/* Doctor Meta Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dr. {docInfo?.name}</h2>
          <p className="text-xs text-blue-600 font-medium">
            {docInfo?.department} • {docInfo?.specialization}
          </p>
          <div className="flex gap-4 mt-3 text-xs text-gray-500 font-semibold">
            <span>Patients Completed Today: {docInfo?.patientsCompletedToday || 0}</span>
            <span>Queue Length: {activeQueue.length}</span>
          </div>
        </div>

        <button
          onClick={handleToggleQueue}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm border transition-colors cursor-pointer ${
            docInfo?.status === "active"
              ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          {docInfo?.status === "active" ? (
            <>
              <MdPause size={18} />
              Pause Consultations
            </>
          ) : (
            <>
              <MdPlayArrow size={18} />
              Resume Consultations
            </>
          )}
        </button>
      </div>

      {docInfo?.status === "paused" && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm font-medium flex items-center gap-2">
          <MdPause size={18} />
          Your queue is currently paused. Patients will remain in the lobby and won't be called.
        </div>
      )}

      {/* Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Active Patient Consultation */}
        <div className="md:col-span-2 space-y-6">
          {currentPatient ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Active Consultation
              </span>
              <div className="border-b border-gray-100 pb-4 mb-6 mt-1 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{currentPatient.name}</h3>
                  <p className="text-xs text-gray-500">
                    ID: {currentPatient.patientId} • Age: {currentPatient.age} • Gender: {currentPatient.gender}
                  </p>
                </div>
                <span className={
                  currentPatient.emergencyLevel === "Critical" ? "badge-critical" :
                  currentPatient.emergencyLevel === "High" ? "badge-high" : "badge-medium"
                }>
                  {currentPatient.emergencyLevel} Priority
                </span>
              </div>

              {/* Symptoms */}
              {currentPatient.symptoms && (
                <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                  <p className="font-bold text-gray-600 uppercase">Symptoms Reported:</p>
                  <p className="text-gray-700 mt-1">{currentPatient.symptoms}</p>
                </div>
              )}

              {/* Consultation Input Fields */}
              <form onSubmit={handleCompleteConsultation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 flex items-center gap-1">
                    <MdAssignment size={14} className="text-gray-400" />
                    Clinical Diagnosis & Medical Notes
                  </label>
                  <textarea
                    required
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm h-32"
                    placeholder="Describe diagnosis findings, patient conditions..."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 flex items-center gap-1">
                    <MdLocalPharmacy size={14} className="text-gray-400" />
                    Prescription / Medication Details
                  </label>
                  <textarea
                    required
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm h-24"
                    placeholder="Paracetamol 650mg - thrice daily after meals (5 Days)..."
                  ></textarea>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleSkipPatient(currentPatient.patientId)}
                    disabled={loading}
                    className="btn-secondary text-xs text-amber-700 hover:text-amber-900 border-amber-200 flex items-center gap-1"
                  >
                    <MdSkipNext size={16} /> Skip Patient
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary text-xs flex items-center gap-1"
                  >
                    <MdCheck size={16} /> Complete & Save
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs text-center py-16">
              <MdAssignment size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-base font-bold text-gray-800">No active consultation</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Select the next patient from your priority queue to start a consultation.
              </p>
              {nextPatient && (
                <button
                  onClick={() => handleStartConsultation(nextPatient.patientId)}
                  disabled={loading || docInfo?.status === "paused"}
                  className="mt-6 btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  Call Next Patient ({nextPatient.name}) <MdPlayArrow size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Doctor's Live Queue List */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <MdHistory size={20} className="text-blue-600" />
              Live Priority Queue
            </h3>
            
            <div className="space-y-3 max-h-[450px] overflow-y-auto">
              {activeQueue.length > 0 ? (
                activeQueue.map((p, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition-all ${
                        isFirst
                          ? "bg-blue-50/50 border-blue-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {idx + 1}. {p.name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Age: {p.age} • Wait: {p.waitingMinutes}m
                          </p>
                        </div>
                        <span className={
                          p.emergencyLevel === "Critical" ? "badge-critical" :
                          p.emergencyLevel === "High" ? "badge-high" : "badge-medium"
                        }>
                          {p.emergencyLevel}
                        </span>
                      </div>
                      
                      {isFirst && !currentPatient && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleStartConsultation(p.patientId)}
                            disabled={loading || docInfo?.status === "paused"}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2.5 rounded-lg text-xs cursor-pointer flex-1 flex items-center justify-center gap-1"
                          >
                            <MdPlayArrow size={14} /> Call
                          </button>
                          <button
                            onClick={() => handleSkipPatient(p.patientId)}
                            disabled={loading}
                            className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 font-medium py-1 px-2.5 rounded-lg text-xs cursor-pointer flex-1 flex items-center justify-center gap-1"
                          >
                            <MdSkipNext size={14} /> Skip
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-6 text-xs text-gray-400">
                  No checked-in patients in your queue.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
