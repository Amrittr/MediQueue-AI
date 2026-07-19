import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config.js";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const registerUser = async (email, password, name, role, hospital = "", department = "") => {
    try {
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

      setUserData(profile);
      return user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const loginUser = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logoutUser = () => {
    setUserData(null);
    setCurrentUser(null);
    return firebaseSignOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({ uid: user.uid, email: user.email, role: 'patient' });
          }
        } catch (err) {
          console.error("Error fetching user doc:", err);
          setUserData({ uid: user.uid, email: user.email, role: 'patient' });
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    loading,
    registerUser,
    loginUser,
    logoutUser,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
