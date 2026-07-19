import React, { useState, useEffect, useRef } from "react";
import { useQueue } from "../context/QueueContext.jsx";
import { db } from "../firebase/config.js";
import { doc, setDoc, deleteDoc, collection, addDoc } from "firebase/firestore";
import Toast from "../components/Toast.jsx";
import { Chart } from "chart.js/auto";
import { 
  MdAnalytics, 
  MdPeople, 
  MdLocalHospital, 
  MdHistory, 
  MdAdd, 
  MdDelete,
  MdAccountTree,
  MdTimeline,
  MdDone
} from "react-icons/md";

export default function AdminDashboard() {
  const { 
    patients, 
    doctors, 
    departments, 
    systemLogs, 
    hospitalGraph 
  } = useQueue();

  const [activeTab, setActiveTab] = useState("analytics");
  const [toast, setToast] = useState(null);

  // Form states for creating resources
  const [docName, setDocName] = useState("");
  const [docDept, setDocDept] = useState("");
  const [docSpec, setDocSpec] = useState("");
  const [docExp, setDocExp] = useState("");
  const [docEmail, setDocEmail] = useState("");

  const [deptName, setDeptName] = useState("");

  const [cepName, setCepName] = useState("");
  const [cepEmail, setCepEmail] = useState("");

  // Chart Canvas Refs
  const deptChartRef = useRef(null);
  const emergencyChartRef = useRef(null);
  const deptChartInstance = useRef(null);
  const emergencyChartInstance = useRef(null);

  // Clean and render analytics charts
  useEffect(() => {
    if (activeTab !== "analytics") return;

    // A. Build Department Queue Load Chart
    if (deptChartRef.current) {
      if (deptChartInstance.current) {
        deptChartInstance.current.destroy();
      }

      // Count patient loads per department
      const deptCounts = {};
      departments.forEach(d => {
        deptCounts[d.departmentName] = 0;
      });
      patients.forEach(p => {
        if (p.status === "CheckedIn" || p.status === "InConsultation") {
          if (deptCounts[p.department] !== undefined) {
            deptCounts[p.department]++;
          }
        }
      });

      const labels = Object.keys(deptCounts);
      const data = Object.values(deptCounts);

      deptChartInstance.current = new Chart(deptChartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Patients in Queue",
            data,
            backgroundColor: "#2563EB",
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }

    // B. Build Emergency Level Distribution Chart
    if (emergencyChartRef.current) {
      if (emergencyChartInstance.current) {
        emergencyChartInstance.current.destroy();
      }

      const emergencyCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      patients.forEach(p => {
        if (p.status === "CheckedIn") {
          if (emergencyCounts[p.emergencyLevel] !== undefined) {
            emergencyCounts[p.emergencyLevel]++;
          }
        }
      });

      emergencyChartInstance.current = new Chart(emergencyChartRef.current, {
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

    return () => {
      if (deptChartInstance.current) deptChartInstance.current.destroy();
      if (emergencyChartInstance.current) emergencyChartInstance.current.destroy();
    };
  }, [activeTab, patients, departments]);

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!docName || !docDept || !docEmail) return;

    try {
      const docId = "DOC-" + Math.floor(100000 + Math.random() * 900000);
      
      // Save doctor file details
      await setDoc(doc(db, "doctors", docId), {
        doctorId: docId,
        name: docName,
        email: docEmail,
        department: docDept,
        specialization: docSpec || "General Medicine",
        experience: docExp || "1 Year",
        availability: true,
        patientsCompletedToday: 0,
        queueLength: 0,
        status: "active",
        averageConsultationTime: 15
      });

      // Save role profile linked to auth checks
      await setDoc(doc(db, "users", docId), {
        uid: docId,
        name: docName,
        email: docEmail,
        role: "doctor",
        hospital: "MediQueue General Hospital",
        department: docDept,
        createdAt: new Date().toISOString()
      });

      // Update Department doctors list
      const dept = departments.find(d => d.departmentName === docDept);
      if (dept) {
        const docIds = dept.doctorIds || [];
        await setDoc(doc(db, "departments", dept.departmentId), {
          ...dept,
          doctorIds: [...docIds, docId]
        });
      }

      setToast({ message: `Doctor ${docName} added successfully!`, type: "success" });
      setDocName(""); setDocDept(""); setDocSpec(""); setDocExp(""); setDocEmail("");
    } catch (err) {
      setToast({ message: "Failed to add doctor.", type: "error" });
    }
  };

  const handleDeleteDoctor = async (docId, deptName) => {
    try {
      await deleteDoc(doc(db, "doctors", docId));
      await deleteDoc(doc(db, "users", docId));
      
      // Remove doctor from Department list
      const dept = departments.find(d => d.departmentName === deptName);
      if (dept) {
        const docIds = (dept.doctorIds || []).filter(id => id !== docId);
        await setDoc(doc(db, "departments", dept.departmentId), {
          ...dept,
          doctorIds: docIds
        });
      }
      setToast({ message: "Doctor profile removed.", type: "warning" });
    } catch (err) {
      setToast({ message: "Failed to delete doctor.", type: "error" });
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!deptName) return;

    try {
      const deptId = "DEP-" + Math.floor(100000 + Math.random() * 900000);
      await setDoc(doc(db, "departments", deptId), {
        departmentId: deptId,
        departmentName: deptName,
        doctorIds: [],
        averageWaitingTime: 0,
        queueLength: 0
      });

      setToast({ message: `Department ${deptName} created.`, type: "success" });
      setDeptName("");
    } catch (err) {
      setToast({ message: "Failed to create department.", type: "error" });
    }
  };

  const handleDeleteDept = async (deptId) => {
    try {
      await deleteDoc(doc(db, "departments", deptId));
      setToast({ message: "Department deleted.", type: "warning" });
    } catch (err) {
      setToast({ message: "Failed to delete department.", type: "error" });
    }
  };

  // Metrics calculations
  const totalPatients = patients.length;
  const onlineDocs = doctors.filter(d => d.availability).length;
  const emergencyCount = patients.filter(p => p.status === "CheckedIn" && p.emergencyLevel === "Critical").length;
  const waitingPatientsCount = patients.filter(p => p.status === "CheckedIn").length;
  
  const averageWaitTime = waitingPatientsCount > 0
    ? Math.floor(patients.filter(p => p.status === "CheckedIn").reduce((acc, curr) => acc + (curr.waitingMinutes || 0), 0) / waitingPatientsCount)
    : 0;

  // Render tree structure list recursively
  const renderGraphNode = (node) => {
    const isRoot = node.type === "hospital";
    const isDept = node.type === "department";
    const isDoc = node.type === "doctor";
    const isPat = node.type === "patient";

    let bgStyle = "bg-gray-100 border-gray-300 text-gray-800";
    if (isRoot) bgStyle = "bg-blue-600 text-white border-blue-700";
    else if (isDept) bgStyle = "bg-emerald-50 border-emerald-200 text-emerald-800";
    else if (isDoc) bgStyle = "bg-indigo-50 border-indigo-200 text-indigo-800";
    else if (isPat) {
      bgStyle = node.emergencyLevel === "Critical"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-gray-50 border-gray-200 text-gray-700";
    }

    return (
      <div key={node.id} className="ml-6 mt-3 pl-4 border-l-2 border-dashed border-gray-300">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${bgStyle}`}>
          <span className="capitalize font-bold">[{node.type}]</span>
          <span>{node.name}</span>
          {isDoc && (
            <span className="text-[10px] text-indigo-500 font-medium">({node.availability ? "Online" : "Offline"})</span>
          )}
          {isPat && (
            <span className="text-[10px] text-red-500 font-bold">({node.emergencyLevel})</span>
          )}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map(child => renderGraphNode(child))}
          </div>
        )}
      </div>
    );
  };

  const graphTree = hospitalGraph ? hospitalGraph.getTreeStructure() : [];

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto">
      {/* Top Navigation Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hospital Administration Panel</h2>
          <p className="text-sm text-gray-500">Monitor system load, manage clinic staff, and inspect algorithms.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "analytics" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Analytics & Load
          </button>
          <button
            onClick={() => setActiveTab("doctors")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "doctors" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Manage Doctors
          </button>
          <button
            onClick={() => setActiveTab("depts")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "depts" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Departments
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "graph" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Graph ADT View
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "logs" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            System Logs
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Total Patient Files</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalPatients}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Doctors Online</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{onlineDocs}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Emergency Code Red</p>
          <p className="text-2xl font-black text-red-600 mt-1">{emergencyCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Avg. Waiting Time</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{averageWaitTime} <span className="text-xs font-medium text-gray-500">mins</span></p>
        </div>
      </div>

      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs md:col-span-2">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Department Active Queues Load</h3>
            <div className="h-64 relative">
              <canvas ref={deptChartRef}></canvas>
            </div>
          </div>
          {/* Doughnut Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Emergency Triages</h3>
            <div className="h-64 relative">
              <canvas ref={emergencyChartRef}></canvas>
            </div>
          </div>
        </div>
      )}

      {activeTab === "doctors" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs h-fit">
            <h3 className="font-bold text-gray-900 text-sm mb-4">Add Doctor Profile</h3>
            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Dr. John Watson"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={docEmail}
                  onChange={(e) => setDocEmail(e.target.value)}
                  placeholder="watson@hospital.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Department</label>
                <select
                  value={docDept}
                  onChange={(e) => setDocDept(e.target.value)}
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
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Specialization</label>
                <input
                  type="text"
                  value={docSpec}
                  onChange={(e) => setDocSpec(e.target.value)}
                  placeholder="Neurology"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Experience</label>
                <input
                  type="text"
                  value={docExp}
                  onChange={(e) => setDocExp(e.target.value)}
                  placeholder="8 Years"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <button type="submit" className="w-full btn-primary py-2.5 text-xs flex justify-center items-center gap-1">
                <MdAdd size={16} /> Save Doctor
              </button>
            </form>
          </div>

          {/* List Doctors */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Doctor</th>
                  <th className="px-6 py-4">Department & Specialization</th>
                  <th className="px-6 py-4">Queue Size</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {doctors.length > 0 ? (
                  doctors.map((d, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">Dr. {d.name}</p>
                          <p className="text-xs text-gray-400">{d.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{d.department}</p>
                          <p className="text-xs text-gray-500">{d.specialization} • Exp: {d.experience}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900">{d.queueLength || 0} waiting</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteDoctor(d.doctorId, d.department)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <MdDelete size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-gray-400">
                      No doctors configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "depts" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs h-fit">
            <h3 className="font-bold text-gray-900 text-sm mb-4">Create Department</h3>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Cardiology"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button type="submit" className="w-full btn-primary py-2.5 text-xs flex justify-center items-center gap-1">
                <MdAdd size={16} /> Create
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Department ID</th>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4">Staff Count</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {departments.length > 0 ? (
                  departments.map((d, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-xs font-mono font-bold text-gray-400">{d.departmentId}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{d.departmentName}</td>
                      <td className="px-6 py-4 font-semibold text-gray-500">{d.doctorIds?.length || 0} doctor(s)</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteDept(d.departmentId)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <MdDelete size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-gray-400">
                      No departments configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "graph" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider">Hospital Nodes Graph ADT Structure</h3>
          <p className="text-xs text-gray-500 mb-6">
            Live client-side rendering of the manual Graph Adjacency List showing active node linkings.
          </p>

          <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl overflow-x-auto min-h-[300px]">
            {graphTree.length > 0 ? (
              graphTree.map(rootNode => renderGraphNode(rootNode))
            ) : (
              <p className="text-center py-12 text-xs text-gray-400">No active nodes in hospital Graph.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Realtime Audits & System Logs</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto font-mono text-xs">
            {systemLogs.length > 0 ? (
              systemLogs.map((log, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-2">
                  <div>
                    <span className="text-blue-600 font-bold">[{log.action}]</span>
                    <span className="text-gray-700 ml-2">{log.details}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold flex-shrink-0">
                    User: {log.performedBy} • {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-12 text-gray-400">System Logs empty.</p>
            )}
          </div>
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
