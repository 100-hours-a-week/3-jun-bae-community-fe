import { API_BASE, TIMEOUT_MS } from "./core/defaults.js";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("postId");

  const form = document.getElementById("post-edit-form");
  const submitButton = document.getElementById("edit-submit-button");
  const deleteButton = document.getElementById("delete-post-button");
  const cancelLink = document.getElementById("edit-cancel-link");
  const fileInput = document.getElementById("edit-image-file");

  if (!form || !postId) {
    alert("잘못된 접근입니다. 게시글 ID가 필요합니다.");
    window.location.replace("/pages/posts.html");
    return;
  }

  if (cancelLink) {
    cancelLink.href = `/pages/post.html?postId=${postId}`;
  }

  loadPost(postId);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");

    try {
      const fd = new FormData(form);
      const title = String(fd.get("title") ?? "").trim();
      const contentInput = String(fd.get("content") ?? "").trim();

      if (!title || !contentInput) {
        throw new Error("제목과 본문을 입력해주세요.");
      }

      const payload = {
        title,
        content: contentInput
      };

      const file = fileInput?.files?.[0];
      if (file) {
        const fileId = await uploadFile(file);
        if (fileId) {
          payload.fileIds = [fileId];
        }
      }

      const response = await fetchWithTimeout(`${API_BASE}/posts/${postId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeout: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error("게시글 수정에 실패했습니다.");
      }

      alert("게시글이 수정되었습니다.");
      window.location.href = `/pages/post.html?postId=${postId}`;
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  });

  deleteButton?.addEventListener("click", async () => {
    const confirmed = confirm("게시글을 삭제하시겠습니까?");
    if (!confirmed) return;

    try {
      deleteButton.disabled = true;
      const response = await fetchWithTimeout(`${API_BASE}/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
        timeout: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error("게시글 삭제에 실패했습니다.");
      }

      alert("게시글이 삭제되었습니다.");
      window.location.href = "/pages/posts.html";
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      deleteButton.disabled = false;
    }
  });
});

async function loadPost(postId) {
  const titleInput = document.getElementById("edit-title");
  const contentInput = document.getElementById("edit-content");
  const coverImageInput = document.getElementById("edit-image");


  try {
    const response = await fetchWithTimeout(`${API_BASE}/posts/${postId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      timeout: TIMEOUT_MS,
    });

    if (!response.ok) {
      throw new Error("게시글 정보를 불러오지 못했습니다.");
    }

    const post = await response.json();

    if (titleInput) titleInput.value = post.title ?? "";
    if (contentInput) contentInput.value = post.content ?? "";
  } catch (error) {
    console.error(error);
    alert(error.message);
    window.location.replace("/pages/posts.html");
  }
}


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
