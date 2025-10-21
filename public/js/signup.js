import { API_BASE } from "./core/defaults.js";

document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("signup-form");

    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fd = new FormData(signupForm);
        const confirmPasswordInput = document.getElementById("signup-password-confirm");
        console.log(`${fd.get("password")} / ${fd.get("signup-password-confirm")}`);
        if (fd.get("password") !== fd.get("signup-password-confirm")) {
            document.getElementById("signup-password-confirm").setAttribute("aria-invalid", "true");
            document.getElementById("password-confirm-invalid-helper").textContent=" 패스워드가 일치하지 않습니다. ";
            return;
        }
        document.getElementById("signup-password-confirm").setAttribute("aria-invalid", "false");
        document.getElementById("password-confirm-invalid-helper").textContent = "";
        
        confirmPasswordInput.setCustomValidity(""); // 유효성 검사 초기화

        try {
            const response = await fetch(`${API_BASE}/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nickname: fd.get("nickname"),
                    email: fd.get("email"),
                    password: fd.get("password"),
                }),
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Signup failed");
            }

            const data = await response.json();
            window.location.href = "/pages/login.html"; // 성공 시, 로그인 페이지로 이동
        } catch (error) {
            alert("Error: " + error.message);
        }
    });

        
});