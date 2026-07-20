# MediQueue AI – Smart Hospital Queue Management System

**MediQueue AI** is a production-quality full-stack web application that intelligently manages patient queues using custom Data Structures and Algorithms (DSA) instead of a simple first-come-first-served layout. 

The user interface is designed to resemble actual professional clinical software—emphasizing clean grids, clear spacing, high-contrast typography, and intuitive sidebars, deliberately avoiding hyper-designed "AI-generated" dark theme templates or neon grids.

---

## 🚀 Key Features

* **Manual DSA Engine**: Features custom JavaScript implementations of a FIFO Queue, a Binary Max Heap, a Priority Queue, a Bucket Chaining Hash Map, and an Adjacency List Graph (visualized live on the Admin panel).
* **Role-Based Portals**:
  * **Patient Portal**: Self-registration, booking appointments, live queue tracking, downloadable QR pass, and medical history audits.
  * **Receptionist Desk**: Quick registration, live triage override, manual check-in, and auto-scanner integration.
  * **Doctor Console**: Active consultation writer (notes + prescriptions), skip patients, call next, and queue controls (pause/resume).
  * **Admin Panel**: Graph ADT visualizer, department queue charts, emergency triages, and audit logs.
* **Auto-Triage & Bubble-Up Math**: Automatically calculates priority scores:
  `Priority Score = (Emergency Level * 100) + (Age * 2) + Waiting Minutes + Appointment Bonus`
  A background timer runs client-side every 30 seconds to recalculate waiting minutes, bubble up patients, and synchronize state with Firestore.
* **QR System**: Generates custom check-in QR codes. Integrates `html5-qrcode` to enable camera scans at the front desk for instant check-in.

---

## 🛠️ Tech Stack

* **Frontend Framework**: React 19, Vite, React Router v6, Tailwind CSS v4, React Icons
* **Database & Auth**: Firebase Auth, Cloud Firestore (Real-time snapshots)
* **Visualizations**: Chart.js, Canvas graph mapping

---

## 📁 Project Directory Structure

```
src/
├── algorithms/       # Custom manual DSA implementations (No external helpers)
│   ├── Queue.js          # FIFO Queue
│   ├── MaxHeap.js        # Binary Max Heap
│   ├── PriorityQueue.js  # Heap-based Priority Queue
│   ├── HashMap.js        # Bucket-Chained Hash Map
│   ├── Graph.js          # Adjacency List Graph structure
│   └── test.js           # Verification test script
├── components/       # Shared UI
│   ├── ProtectedRoute.jsx # Role-Based Access Control
│   ├── Sidebar.jsx       # Left side navigation panel
│   ├── Navbar.jsx        # Top details banner with server clock
│   ├── Toast.jsx         # Custom notifications
│   └── QRScannerModal.jsx# Camera scanner modal wrapper
├── context/          # State managers
│   ├── AuthContext.jsx   # Auth listener and User profile loader
│   └── QueueContext.jsx  # Real-time Firestore sync & DSA mapping
├── firebase/         # Firebase initialization
│   └── config.js
├── pages/            # View Dashboards
│   ├── Login.jsx         # User entry point
│   ├── Register.jsx      # Role registration forms (for testing ease)
│   ├── AdminDashboard.jsx
│   ├── ReceptionistDashboard.jsx
│   ├── DoctorDashboard.jsx
│   └── PatientDashboard.jsx
├── styles/           # Main CSS and Tailwind import rules
│   └── index.css
├── App.jsx           # Routes and core layouts
└── main.jsx          # React mount point
```

---

## ⚙️ Setup & Installation

### 1. Install Node.js Dependencies
Navigate to the project root and run:
```bash
npm install
```

### 2. Configure Firebase Environment Variables
Verify or create a `.env` file at the root of the project:
```env
VITE_FIREBASE_API_KEY=AIzaSyAOsshe93Hd3lkDr5xqieBRL1fhgLG_tMY
VITE_FIREBASE_AUTH_DOMAIN=dsa-project-570fb.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://dsa-project-570fb-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=dsa-project-570fb
VITE_FIREBASE_STORAGE_BUCKET=dsa-project-570fb.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1052928923076
VITE_FIREBASE_APP_ID=1:1052928923076:web:b50a5808ce1dd4a44b4091
VITE_FIREBASE_MEASUREMENT_ID=G-0D76QZQ97B
```

### 3. Run DSA Verification Tests
Validate custom algorithms using the CLI test command:
```bash
node src/algorithms/test.js
```

### 4. Start Local Development Server
Boot Vite local host:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Firestore Security Rules
Below are the recommended Firestore security rules to write to your Firebase console under the rules tab. This restricts updates strictly based on auth context roles:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /patients/{patientId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /doctors/{doctorId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /queue/{queueId} {
      allow read, write: if request.auth != null;
    }
    match /departments/{deptId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /appointments/{apptId} {
      allow read, write: if request.auth != null;
    }
    match /systemLogs/{logId} {
      allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📝 Demo Walkthrough Instructions (For Presentations)
To easily demonstrate the complete workflow during college presentations:
1. **Open Register Page**: Click the "Create an Account" link on the login page.
2. **Register Roles**:
   - Create an **Administrator** profile (Role: Administrator).
   - Create a **Doctor** profile (Role: Doctor, Department: Pediatrics).
   - Create a **Receptionist** profile (Role: Receptionist).
   - Create a **Patient** profile (Role: Patient).
3. **Configure & Link**:
   - Log in as the Admin. View the **Graph ADT View** (It automatically seeds default departments and maps your newly registered Pediatrics doctor to the graph!).
   - Log in as the Patient. Go to **Book Appointment** and schedule a Pediatrics slot. Take a screenshot or download the QR check-in code.
   - Log in as the Receptionist. Search for your patient name, and click **Check In**. Alternatively, use **Scan QR Pass** to simulate scanning using your webcam or phone camera!
   - Log in as the Doctor. Note that the patient is loaded into your active priority queue. Click **Call** to start consultation, write medical notes/prescriptions, and click **Complete & Save**.
   - Check the Admin console again to review the Analytics graphs and System Logs auditing.
   - ## 📄 Project Report

The complete project report is available below:

📥 **[Download Project Report](./DSA%20project%20report.pdf)**
