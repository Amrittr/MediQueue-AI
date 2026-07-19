import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useQueue } from "../context/QueueContext.jsx";
import Toast from "../components/Toast.jsx";
import { 
  MdQrCode, 
  MdHourglassEmpty, 
  MdPerson, 
  MdEvent, 
  MdAssignment, 
  MdDownload,
  MdArrowForward
} from "react-icons/md";

export default function PatientDashboard() {
  const { currentUser, userData, registerUser } = useAuth();
  const { 
    patients, 
    doctors, 
    doctorQueues, 
    bookAppointment, 
    editPatient, 
    departments 
  } = useQueue();

  const [patientData, setPatientData] = useState(null);
  const [activeTab, setActiveTab] = useState("portal");
  const [toast, setToast] = useState(null);

  // Profile Form States
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDoc, setSelectedDoc] = useState("");

  // Booking Form States
  const [bookDept, setBookDept] = useState("");
  const [bookDoc, setBookDoc] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookNotes, setBookNotes] = useState("");

  // Sync current user's patient profile data
  useEffect(() => {
    if (currentUser && patients.length > 0) {
      const currentPatient = patients.find(p => p.patientId === currentUser.uid);
      if (currentPatient) {
        setPatientData(currentPatient);
        setAge(currentPatient.age || "");
        setGender(currentPatient.gender || "");
        setPhone(currentPatient.phone || "");
        setBloodGroup(currentPatient.bloodGroup || "");
        setSymptoms(currentPatient.symptoms || "");
        setSelectedDept(currentPatient.department || "");
        setSelectedDoc(currentPatient.doctorAssigned || "");
      }
    }
  }, [currentUser, patients]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      await editPatient(currentUser.uid, {
        age,
        gender,
        phone,
        bloodGroup,
        symptoms,
        department: selectedDept,
        doctorAssigned: selectedDoc,
        performedBy: "Patient"
      });
      setToast({ message: "Profile updated successfully!", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to update profile.", type: "error" });
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookDoc || !bookDate || !bookTime) {
      setToast({ message: "Please select doctor, date, and time.", type: "error" });
      return;
    }

    try {
      const docObj = doctors.find(d => d.doctorId === bookDoc);
      await bookAppointment(currentUser.uid, {
        doctorId: bookDoc,
        doctorName: docObj ? docObj.name : "Unknown Doctor",
        department: bookDept,
        date: bookDate,
        time: bookTime,
        notes: bookNotes
      });
      setToast({ message: "Appointment booked successfully!", type: "success" });
      setBookDept("");
      setBookDoc("");
      setBookDate("");
      setBookTime("");
      setBookNotes("");
      setActiveTab("portal");
    } catch (err) {
      setToast({ message: "Booking failed. Try again.", type: "error" });
    }
  };

  // Find queue info if patient is CheckedIn or InConsultation
  const getQueueInfo = () => {
    if (!patientData || !patientData.doctorAssigned) return null;
    const docId = patientData.doctorAssigned;
    const docObj = doctors.find(d => d.doctorId === docId);
    const sortedQueue = doctorQueues[docId] || [];
    
    // Find current patient index in sorted queue
    const index = sortedQueue.findIndex(p => p.patientId === patientData.patientId);
    
    if (patientData.status === "InConsultation") {
      return {
        position: "Currently Active",
        waitingTime: 0,
        doctorName: docObj ? docObj.name : "Assigned Doctor",
        status: "In Consultation",
        paused: docObj?.status === "paused"
      };
    }

    if (index === -1) return null;

    const avgTime = docObj ? parseInt(docObj.averageConsultationTime) || 15 : 15;
    const waitingTime = index * avgTime;

    return {
      position: index + 1,
      patientsAhead: index,
      waitingTime,
      doctorName: docObj ? docObj.name : "Assigned Doctor",
      status: "Waiting",
      paused: docObj?.status === "paused"
    };
  };

  const queueInfo = getQueueInfo();
  const qrUrl = patientData ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${patientData.patientId}` : "";

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome, {userData?.name}</h2>
          <p className="text-sm text-gray-500">Patient ID: {currentUser?.uid}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("portal")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "portal"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("book")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "book"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Book Appointment
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Edit Profile
          </button>
        </div>
      </div>

      {activeTab === "portal" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Portal Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Live Queue Box */}
            {patientData && (patientData.status === "CheckedIn" || patientData.status === "InConsultation") ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      Live Queue Status
                    </span>
                    <h3 className="text-lg font-bold text-gray-800 mt-1">
                      Assigned to Dr. {queueInfo?.doctorName}
                    </h3>
                  </div>
                  {queueInfo?.paused && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">
                      Doctor Paused
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Your Position</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">
                      {queueInfo?.position}
                    </p>
                    {queueInfo?.patientsAhead !== undefined && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {queueInfo.patientsAhead} patient(s) ahead
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Est. Wait Time</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">
                      {queueInfo?.waitingTime} <span className="text-sm font-normal">mins</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">Updates dynamically</p>
                  </div>
                </div>

                <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 font-medium">
                  {patientData.status === "InConsultation"
                    ? "It's your turn! Please head into the consultation room."
                    : "Please wait in the lobby. We will notify you when Dr. Ready calls you."}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs text-center py-12">
                <MdHourglassEmpty size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-base font-bold text-gray-800">You are not checked in yet</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                  Please show your QR Code to the receptionist at the front desk when you arrive at the hospital to check in and join the queue.
                </p>
                {patientData?.appointmentTime ? (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 inline-block text-left">
                    <h4 className="text-xs font-bold text-gray-600 uppercase">Upcoming Slot</h4>
                    <p className="text-sm font-bold text-gray-800 mt-1">
                      {patientData.appointmentTime}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      With Dr. {doctors.find(d => d.doctorId === patientData.doctorAssigned)?.name || "Assigned Specialist"}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveTab("book")}
                    className="mt-6 btn-primary text-xs inline-flex items-center gap-1.5"
                  >
                    Book An Appointment Now <MdArrowForward size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Medical History */}
            {patientData && (patientData.medicalNotes || patientData.prescription) && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <MdAssignment className="text-blue-600" size={20} />
                  Latest Consultation Report
                </h3>
                <div className="space-y-4">
                  {patientData.medicalNotes && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-xs font-bold text-gray-600 uppercase">Doctor's Medical Notes</h4>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                        {patientData.medicalNotes}
                      </p>
                    </div>
                  )}
                  {patientData.prescription && (
                    <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                      <h4 className="text-xs font-bold text-blue-700 uppercase">Prescribed Medicine</h4>
                      <p className="text-sm font-semibold text-blue-900 mt-2 whitespace-pre-line">
                        {patientData.prescription}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / QR Code Display Column */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs text-center">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center justify-center gap-2">
                <MdQrCode className="text-blue-600" size={20} />
                Your Hospital Pass
              </h3>
              {qrUrl ? (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl inline-block">
                  <img src={qrUrl} alt="Check-in QR" className="w-48 h-48 mx-auto" />
                  <p className="text-[10px] font-bold text-gray-400 mt-2">{currentUser?.uid}</p>
                </div>
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-xl mx-auto flex items-center justify-center text-gray-400 text-xs">
                  Loading QR...
                </div>
              )}
              <a
                href={qrUrl}
                download={`Pass-${currentUser?.uid}.png`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 btn-secondary text-xs flex items-center justify-center gap-2 w-full"
              >
                <MdDownload size={16} />
                Open / Download Pass
              </a>
              <p className="text-[10px] text-gray-400 mt-3">
                Download and save this QR. Show it at the reception check-in desk to automatically join the queue.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "book" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs max-w-2xl">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <MdEvent className="text-blue-600" size={20} />
            Book a Clinic Slot
          </h3>
          <form onSubmit={handleBookAppointment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Department
                </label>
                <select
                  value={bookDept}
                  onChange={(e) => {
                    setBookDept(e.target.value);
                    setBookDoc("");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept, idx) => (
                    <option key={idx} value={dept.departmentName}>
                      {dept.departmentName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Select Doctor
                </label>
                <select
                  value={bookDoc}
                  onChange={(e) => setBookDoc(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                  disabled={!bookDept}
                >
                  <option value="">Select Doctor</option>
                  {doctors
                    .filter(d => d.department === bookDept && d.availability)
                    .map((doc, idx) => (
                      <option key={idx} value={doc.doctorId}>
                        Dr. {doc.name} ({doc.specialization})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Preferred Date
                </label>
                <input
                  type="date"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Preferred Time Slot
                </label>
                <input
                  type="time"
                  value={bookTime}
                  onChange={(e) => setBookTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Describe Symptoms
              </label>
              <textarea
                value={bookNotes}
                onChange={(e) => setBookNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm h-24 bg-white"
                placeholder="Fever, cough, chest tightness..."
              ></textarea>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={() => setActiveTab("portal")}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-sm">
                Book Slot
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs max-w-2xl">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <MdPerson className="text-blue-600" size={20} />
            Update Profile Information
          </h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="+91 98765 43210"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Describe Current Symptoms
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm h-20"
                placeholder="Briefly state symptoms..."
              ></textarea>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={() => setActiveTab("portal")}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-sm">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

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
