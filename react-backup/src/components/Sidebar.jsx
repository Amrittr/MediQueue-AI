import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { 
  MdDashboard, 
  MdPeople, 
  MdLocalHospital, 
  MdHistory, 
  MdQrCodeScanner, 
  MdExitToApp, 
  MdPerson,
  MdEventNote,
  MdFormatListNumbered
} from "react-icons/md";

export default function Sidebar() {
  const { userData, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!userData) return null;

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/login");
    } catch (e) {
      console.error("Failed to log out", e);
    }
  };

  const getLinks = () => {
    switch (userData.role) {
      case "admin":
        return [
          { label: "Dashboard", path: "/admin", icon: <MdDashboard size={20} /> },
          { label: "Manage Doctors", path: "/admin/doctors", icon: <MdPeople size={20} /> },
          { label: "Departments", path: "/admin/departments", icon: <MdLocalHospital size={20} /> },
          { label: "System Logs", path: "/admin/logs", icon: <MdHistory size={20} /> }
        ];
      case "receptionist":
        return [
          { label: "Queue Dashboard", path: "/receptionist", icon: <MdFormatListNumbered size={20} /> },
          { label: "Register Patient", path: "/receptionist/register", icon: <MdPerson size={20} /> },
          { label: "Check In Scanner", path: "/receptionist/scanner", icon: <MdQrCodeScanner size={20} /> }
        ];
      case "doctor":
        return [
          { label: "Consult Dashboard", path: "/doctor", icon: <MdDashboard size={20} /> },
          { label: "Queue Control", path: "/doctor/control", icon: <MdFormatListNumbered size={20} /> }
        ];
      case "patient":
        return [
          { label: "Patient Portal", path: "/patient", icon: <MdPerson size={20} /> },
          { label: "Book Appointment", path: "/patient/book", icon: <MdEventNote size={20} /> }
        ];
      default:
        return [];
    }
  };

  const menuItems = getLinks();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col justify-between flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
            MQ
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight text-base">MediQueue AI</h1>
            <span className="text-xs text-blue-600 font-medium font-sans">Hospital System</span>
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg mb-6 border border-gray-100">
          <p className="text-sm font-semibold text-gray-800 truncate">{userData.name}</p>
          <p className="text-xs text-gray-500 capitalize">{userData.role}</p>
          {userData.department && (
            <p className="text-[10px] text-blue-500 font-medium mt-1 truncate">{userData.department}</p>
          )}
        </div>

        <nav className="space-y-1">
          {menuItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={idx}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
        >
          <MdExitToApp size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
