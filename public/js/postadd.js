import { API_BASE, TIMEOUT_MS } from "./core/defaults.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("post-create-form");
  const submitButton = document.getElementById("post-submit-button");
  const fileInput = document.getElementById("post-image-file");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    submitButton?.setAttribute("aria-busy", "true");
    if (submitButton) submitButton.disabled = true;

    try {
      const formData = new FormData(form);
      const title = String(formData.get("title") ?? "").trim();
      const contentInput = String(formData.get("content") ?? "").trim();
      const summary = String(formData.get("summary") ?? "").trim();
      const tags = String(formData.get("tags") ?? "").trim();
      const coverImageUrl = String(formData.get("coverImage") ?? "").trim();
      const allowComments = formData.getAll("allowComments").includes("true");

      if (!title || !contentInput) {
        throw new Error("제목과 본문을 입력해주세요.");
      }

      const fileIds = [];
      const file = fileInput?.files?.[0];
      if (file) {
        const uploadedId = await uploadFile(file);
        if (uploadedId) {
          fileIds.push(uploadedId);
        }
      }

      const content = contentInput;

      const response = await fetchWithTimeout(`${API_BASE}/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, fileIds }),
        timeout: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error("게시글 작성에 실패했습니다.");
      }

      const payload = await response.json();
      const postId = payload.id;
      alert("게시글이 등록되었습니다.");
      window.location.href = postId ? `/pages/post.html?postId=${postId}` : "/pages/posts.html";
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      submitButton?.removeAttribute("aria-busy");
      if (submitButton) submitButton.disabled = false;
    }
  });
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
    throw new Error("파일 업로드에 실패했습니다.");
  }

  const payload = await response.json();
  return payload.id;
}

function fetchWithTimeout(resource, options = {}) {
  const { timeout = TIMEOUT_MS, ...config } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const finalConfig = { ...config, signal: controller.signal };
  return fetch(resource, finalConfig).finally(() => clearTimeout(id));
}
