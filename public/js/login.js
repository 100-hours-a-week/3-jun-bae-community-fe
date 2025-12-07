import { Modal } from "./core/modal.js";
import { API_BASE } from "./core/defaults.js";
import { ensureSession, isAuthenticated, saveSession } from "./core/session.js";

document.addEventListener("DOMContentLoaded", async () => {
  await ensureSession();
  if (isAuthenticated()) {
    window.location.replace("/pages/posts.html");
    return;
  }

  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      saveSession(data);
      window.location.href = "/pages/posts.html";
    } catch (error) {
      Modal.alert("Error: " + error.message);
    }
  });
});
