import React, { useEffect } from "react";
import { MdCheckCircle, MdError, MdInfo, MdWarning } from "react-icons/md";

export default function Toast({ message, type = "success", onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case "error":
        return {
          bg: "bg-red-50 border-red-200 text-red-800",
          icon: <MdError className="text-red-500" size={20} />
        };
      case "warning":
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          icon: <MdWarning className="text-amber-500" size={20} />
        };
      case "info":
        return {
          bg: "bg-blue-50 border-blue-200 text-blue-800",
          icon: <MdInfo className="text-blue-500" size={20} />
        };
      case "success":
      default:
        return {
          bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          icon: <MdCheckCircle className="text-emerald-500" size={20} />
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-transform duration-300 ${styles.bg}`}>
      {styles.icon}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
