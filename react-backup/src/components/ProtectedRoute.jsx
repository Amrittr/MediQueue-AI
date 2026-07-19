import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    switch (userData.role) {
      case "admin": return <Navigate to="/admin" replace />;
      case "receptionist": return <Navigate to="/receptionist" replace />;
      case "doctor": return <Navigate to="/doctor" replace />;
      case "patient": return <Navigate to="/patient" replace />;
      default: return <Navigate to="/login" replace />;
    }
  }

  return children;
}
