import { API_BASE, TIMEOUT_MS } from "./defaults.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("profile-form");
  const submitButton = document.getElementById("profile-submit-button");
  const deleteButton = document.getElementById("profile-delete-button");
  const profileImageInput = document.getElementById("profile-image-url");
  const fileInput = document.getElementById("profile-image-file");
  const nicknameInput = document.getElementById("profile-nickname");
  const emailInput = document.getElementById("profile-email");

  if (!form) return;

  loadProfile();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");

    try {
      const nickname = nicknameInput?.value.trim();
      const email = emailInput?.value.trim();
      let profileImageUrl = profileImageInput?.value.trim() ?? "";
      let profileImageId = null;

      if (!nickname || !email) {
        throw new Error("닉네임과 이메일을 모두 입력해주세요.");
      }

      const file = fileInput?.files?.[0];
      if (file) {
        const uploadResult = await uploadFile(file);
        profileImageId = uploadResult.id;
        profileImageUrl = uploadResult.url ?? profileImageUrl;
      }

      const payload = {
        nickname,
        email,
      };

      if (profileImageUrl) {
        payload.profileImageUrl = profileImageUrl;
      }
      if (profileImageId) {
        payload.profileImageId = profileImageId;
      }

      const response = await fetchWithTimeout(`${API_BASE}/users/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeout: TIMEOUT_MS,
      });

      if (response.status === 401) {
        alert("로그인이 필요합니다. 다시 로그인해주세요.");
        window.location.href = "/pages/login.html";
        return;
      }

      if (!response.ok) {
        if (response.status === 405) {
          throw new Error("프로필 수정 API가 아직 준비되지 않았습니다.");
        }
        throw new Error("프로필 업데이트에 실패했습니다.");
      }

      alert("프로필이 업데이트되었습니다.");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  });

  deleteButton?.addEventListener("click", async () => {
    const confirmed = confirm("정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
    if (!confirmed) return;

    try {
      deleteButton.disabled = true;
      const response = await fetchWithTimeout(`${API_BASE}/users`, {
        method: "DELETE",
        credentials: "include",
        timeout: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error("계정 삭제에 실패했습니다.");
      }

      alert("계정이 삭제되었습니다.");
      window.location.href = "/pages/signup.html";
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      deleteButton.disabled = false;
    }
  });

  async function loadProfile() {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/users/me`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        timeout: TIMEOUT_MS,
      });

      if (response.status === 401) {
        alert("로그인이 필요합니다.");
        window.location.href = "/pages/login.html";
        return;
      }

      if (!response.ok) {
        throw new Error("프로필 정보를 불러오지 못했습니다.");
      }

      const profile = await response.json();
      nicknameInput && (nicknameInput.value = profile.nickname ?? "");
      emailInput && (emailInput.value = profile.email ?? "");
      profileImageInput && (profileImageInput.value = profile.profileImageUrl ?? "");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }
});

async function uploadFile(file) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetchWithTimeout(`${API_BASE}/files`, {
    method: "POST",
    credentials: "include",
    body,
    timeout: TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new Error("프로필 이미지 업로드에 실패했습니다.");
  }

  return response.json();
}

function fetchWithTimeout(resource, options = {}) {
  const { timeout = TIMEOUT_MS, ...config } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const finalConfig = { ...config, signal: controller.signal };
  return fetch(resource, finalConfig).finally(() => clearTimeout(id));
}
