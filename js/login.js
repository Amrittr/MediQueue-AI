import { subscribe, loginUser } from './state.js';
import { showToast } from './toast.js';

const form = document.getElementById("login-form");
const submitBtn = document.getElementById("submit-btn");

// Subscribe to state changes to handle automatic redirect if already logged in
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
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showToast("Please fill in all fields.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; display: inline-block;"></span> Signing In...`;

  try {
    await loginUser(email, password);
    showToast("Login successful!", "success");
  } catch (err) {
    console.error(err);

    let errorMsg = "Invalid email or password.";
    if (err.code === "auth/user-not-found") errorMsg = "No account found with this email.";
    else if (err.code === "auth/wrong-password") errorMsg = "Incorrect password.";
    else if (err.code === "auth/invalid-credential") errorMsg = "Incorrect email or password.";
    else if (err.message && err.message.toLowerCase().includes("network")) errorMsg = "Network error. Please check your internet connection.";
    
    showToast(errorMsg, "error");
    submitBtn.disabled = false;
    submitBtn.innerText = "Sign In";
  }
});

// Quick demo account triggers
document.getElementById("quick-doctor-btn")?.addEventListener("click", () => {
  document.getElementById("email").value = "doctor1@gmail.com";
  document.getElementById("password").value = "123456";
  form.dispatchEvent(new Event("submit"));
});

document.getElementById("quick-patient-btn")?.addEventListener("click", () => {
  document.getElementById("email").value = "patient1@gmail.com";
  document.getElementById("password").value = "123456";
  form.dispatchEvent(new Event("submit"));
});
