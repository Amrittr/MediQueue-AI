import { subscribe, registerUser } from './state.js';
import { showToast } from './toast.js';

const form = document.getElementById("register-form");
const roleSelect = document.getElementById("role");
const deptGroup = document.getElementById("dept-group");
const deptSelect = document.getElementById("department");
const submitBtn = document.getElementById("submit-btn");

// Toggle department dropdown based on role selection
roleSelect.addEventListener("change", () => {
  const role = roleSelect.value;
  if (role === "doctor") {
    deptGroup.style.display = "block";
    deptSelect.required = true;
  } else {
    deptGroup.style.display = "none";
    deptSelect.required = false;
    deptSelect.value = "";
  }
});

// Subscribe to state to automatically redirect if logged in
let isRedirecting = false;
subscribe((state) => {
  if (state.loading) return;
  
  if (state.currentUser && state.userData && !isRedirecting) {
    isRedirecting = true;
    const role = state.userData.role;
    showToast("Redirecting to dashboard...", "success");
    setTimeout(() => {
      if (role === "admin") window.location.href = "admin.html";
      else if (role === "receptionist") window.location.href = "receptionist.html";
      else if (role === "doctor") window.location.href = "doctor.html";
      else if (role === "patient") window.location.href = "patient.html";
      else window.location.href = "index.html";
    }, 800);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = roleSelect.value;
  const department = deptSelect.value;

  if (!name || !email || !password) {
    showToast("Please fill in all fields.", "error");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.", "error");
    return;
  }

  if (role === "doctor" && !department) {
    showToast("Please assign a department.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; display: inline-block;"></span> Registering...`;

  try {
    await registerUser(email, password, name, role, "MediQueue General Hospital", department);
    showToast("Registration successful!", "success");
  } catch (err) {
    console.error(err);
    let errorMsg = "Registration failed. Please try again.";
    if (err.code === "auth/email-already-in-use") errorMsg = "Email already in use.";
    else if (err.code === "auth/invalid-email") errorMsg = "Invalid email format.";
    showToast(errorMsg, "error");
    submitBtn.disabled = false;
    submitBtn.innerText = "Create Account";
  }
});
