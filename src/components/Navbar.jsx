import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { MdAccessTime, MdCircle } from "react-icons/md";

export default function Navbar() {
  const { userData } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!userData) return null;

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-gray-800">
          {userData.hospital || "MediQueue General Hospital"}
        </h2>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-xs font-medium">
          <MdCircle className="animate-pulse text-emerald-500" size={8} />
          <span>Queue Engine Active</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <MdAccessTime size={16} className="text-gray-400" />
          <span>
            {time.toLocaleDateString(undefined, { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}{" "}
            • {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </header>
  );
}
