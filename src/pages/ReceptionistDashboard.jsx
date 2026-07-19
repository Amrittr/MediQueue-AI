import React, { useState } from "react";
import { useQueue } from "../context/QueueContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import QRScannerModal from "../components/QRScannerModal.jsx";
import Toast from "../components/Toast.jsx";
import * as Md from "react-icons/md";

export default function ReceptionistDashboard() {
  const { userData } = useAuth();
  const { 
    patients, 
    doctors, 
    departments, 
    registerPatient, 
    checkInPatient, 
    emergencyOverride, 
    assignDoctor,
    patientMap
  } = useQueue();

  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Registration Form State
  const [regName, setRegName] = useState("");
  const [regAge, setRegAge] = useState("");
  const [regGender, setRegGender] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regSymptoms, setRegSymptoms] = useState("");
  const [regDept, setRegDept] = useState("");
  const [regDoc, setRegDoc] = useState("");
  const [regEmergency, setRegEmergency] = useState("Low");

  // Edit / Override Modal States
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [overrideEmergency, setOverrideEmergency] = useState("");
  const [overrideDept, setOverrideDept] = useState("");
  const [overrideDoc, setOverrideDoc] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const pId = await registerPatient({
        name: regName,
        age: regAge,
        gender: regGender,
        phone: regPhone,
        symptoms: regSymptoms,
        department: regDept,
        doctorAssigned: regDoc,
        emergencyLevel: regEmergency,
        registeredBy: userData?.name || "Receptionist"
      });

      setToast({ message: `Patient registered successfully! ID: ${pId}`, type: "success" });
      setIsRegisterOpen(false);
      // Reset form
      setRegName(""); setRegAge(""); setRegGender(""); setRegPhone("");
      setRegSymptoms(""); setRegDept(""); setRegDoc(""); setRegEmergency("Low");
    } catch (err) {
      setToast({ message: "Registration failed.", type: "error" });
    }
  };

  const handleScanSuccess = async (scannedUid) => {
    // Check key in manual hash map
    if (!patientMap.has(scannedUid)) {
      setToast({ message: "Invalid pass! No patient profile linked to this ID.", type: "error" });
      return;
    }

    try {
      await checkInPatient(scannedUid, userData?.name || "Receptionist");
      setToast({ message: "Patient Checked In successfully!", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to check in patient.", type: "error" });
    }
  };

  const handleCheckInManual = async (pId) => {
    try {
      await checkInPatient(pId, userData?.name || "Receptionist");
      setToast({ message: "Patient Checked In successfully!", type: "success" });
    } catch (err) {
      setToast({ message: "Check-in failed.", type: "error" });
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    try {
      const p = patients.find(p => p.patientId === selectedPatientId);
      if (!p) return;

      if (overrideEmergency !== p.emergencyLevel) {
        await emergencyOverride(selectedPatientId, overrideEmergency, userData?.name || "Receptionist");
      }

      if (overrideDept !== p.department || overrideDoc !== p.doctorAssigned) {
        await assignDoctor(selectedPatientId, overrideDept, overrideDoc, userData?.name || "Receptionist");
      }

      setToast({ message: "Patient file updated successfully!", type: "success" });
      setIsEditOpen(false);
    } catch (err) {
      setToast({ message: "Failed to update patient file.", type: "error" });
    }
  };

  const openEditModal = (p) => {
    setSelectedPatientId(p.patientId);
    setOverrideEmergency(p.emergencyLevel);
    setOverrideDept(p.department || "");
    setOverrideDoc(p.doctorAssigned || "");
    setIsEditOpen(true);
  };

  // Filter patients
  const filteredPatients = patients.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm);
    
    const matchesDept = deptFilter === "" || p.department === deptFilter;
    const matchesStatus = statusFilter === "" || p.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hospital Check-In Desk</h2>
          <p className="text-sm text-gray-500">Register new files or scan passes to queue patients.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Md.MdQrCodeScanner size={18} />
            Scan QR Pass
          </button>
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Md.MdPersonAdd size={18} />
            New Patient File
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Md.MdSearch className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by ID, Name or Phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Departments</option>
            {departments.map((d, idx) => (
              <option key={idx} value={d.departmentName}>{d.departmentName}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Registered">Registered</option>
            <option value="CheckedIn">Checked In</option>
            <option value="InConsultation">In Consultation</option>
            <option value="Completed">Completed</option>
            <option value="Skipped">Skipped</option>
          </select>
        </div>
      </div>

      {/* Patient Listing Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
              <th className="px-6 py-4">Patient Info</th>
              <th className="px-6 py-4">Department & Doctor</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Priority / Emergency</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((p, idx) => {
                const docObj = doctors.find(d => d.doctorId === p.doctorAssigned);
                return (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">ID: {p.patientId} • Age: {p.age} • Gen: {p.gender}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-800">{p.department || "Unassigned"}</p>
                        <p className="text-xs text-gray-500">{docObj ? `Dr. ${docObj.name}` : "Pending assignment"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={
                        p.status === "CheckedIn" ? "badge-checked-in" :
                        p.status === "InConsultation" ? "badge-medium" :
                        p.status === "Completed" ? "badge-low" :
                        p.status === "Skipped" ? "badge-critical" : "badge-low"
                      }>
                        {p.status === "CheckedIn" ? "Checked In" : p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={
                          p.emergencyLevel === "Critical" ? "badge-critical" :
                          p.emergencyLevel === "High" ? "badge-high" :
                          p.emergencyLevel === "Medium" ? "badge-medium" : "badge-low"
                        }>
                          {p.emergencyLevel}
                        </span>
                        {p.status === "CheckedIn" && (
                          <span className="text-xs text-gray-500 font-semibold">
                            (Score: {p.priorityScore})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {p.status === "Registered" && (
                          <button
                            onClick={() => handleCheckInManual(p.patientId)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Check In
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(p)}
                          className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1"
                        >
                          <Md.MdEdit size={14} /> Edit / Route
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-12 text-gray-400">
                  No active patient files found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden relative border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-base">New Patient Registration File</h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <Md.MdClose size={22} />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Mary Jane"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Age</label>
                  <input
                    type="number"
                    required
                    value={regAge}
                    onChange={(e) => setRegAge(e.target.value)}
                    placeholder="45"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Gender</label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Emergency Level</label>
                  <select
                    value={regEmergency}
                    onChange={(e) => setRegEmergency(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Department</label>
                  <select
                    value={regDept}
                    onChange={(e) => {
                      setRegDept(e.target.value);
                      setRegDoc("");
                    }}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d, idx) => (
                      <option key={idx} value={d.departmentName}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Assign Doctor</label>
                  <select
                    value={regDoc}
                    onChange={(e) => setRegDoc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    disabled={!regDept}
                  >
                    <option value="">Select Doctor</option>
                    {doctors
                      .filter(d => d.department === regDept && d.availability)
                      .map((d, idx) => (
                        <option key={idx} value={d.doctorId}>Dr. {d.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Symptoms Description</label>
                <textarea
                  value={regSymptoms}
                  onChange={(e) => setRegSymptoms(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm h-20"
                  placeholder="Notes on current condition..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-sm">
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Route / Emergency Override Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden relative border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-base">Edit Patient Route / Emergency Status</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <Md.MdClose size={22} />
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Triage Emergency Level</label>
                <select
                  value={overrideEmergency}
                  onChange={(e) => setOverrideEmergency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical (Immediate Priority Override)</option>
                </select>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Critical override automatically places this patient first in the doctor's queue.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Department</label>
                  <select
                    value={overrideDept}
                    onChange={(e) => {
                      setOverrideDept(e.target.value);
                      setOverrideDoc("");
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d, idx) => (
                      <option key={idx} value={d.departmentName}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Assign Doctor</label>
                  <select
                    value={overrideDoc}
                    onChange={(e) => setOverrideDoc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    disabled={!overrideDept}
                  >
                    <option value="">Select Doctor</option>
                    {doctors
                      .filter(d => d.department === overrideDept && d.availability)
                      .map((d, idx) => (
                        <option key={idx} value={d.doctorId}>Dr. {d.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
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
        </div>
      )}

      {/* QR Code Camera Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

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
