import { Modal } from "./core/modal.js";
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
            document.getElementById("password-confirm-invalid-helper").textContent = " 패스워드가 일치하지 않습니다. ";
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
                const errorData = await response.json();
                const details = errorData.details || "";

                if (details.includes("Nickname already in use")) {
                    Modal.alert("이미 사용 중인 닉네임입니다.");
                    return;
                }

                if (details.includes("Email already in use")) {
                    Modal.alert("이미 사용 중인 이메일입니다.");
                    return;
                }

                throw new Error("회원가입에 실패했습니다.");
            }

            const data = await response.json();
            window.location.href = "/pages/login.html"; // 성공 시, 로그인 페이지로 이동
        } catch (error) {
            // Modal.alert handles the display, so we don't need to alert again if it was handled above
            // But if it fell through to here with a generic error
            if (error.message !== "회원가입에 실패했습니다.") {
                // It might be a network error or something else
                Modal.alert("오류가 발생했습니다: " + error.message);
            } else {
                Modal.alert("회원가입에 실패했습니다. 다시 시도해주세요.");
            }
        }
    });


});