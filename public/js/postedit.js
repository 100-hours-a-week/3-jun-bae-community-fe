import { API_BASE, TIMEOUT_MS } from "./defaults.js";

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
      const summary = String(fd.get("summary") ?? "").trim();
      const tags = String(fd.get("tags") ?? "").trim();
      const coverImageUrl = String(fd.get("coverImage") ?? "").trim();
      const allowComments = fd.getAll("allowComments").includes("true");

      if (!title || !contentInput) {
        throw new Error("제목과 본문을 입력해주세요.");
      }

      const payload = {
        title,
        content: buildContent({
          summary,
          content: contentInput,
          tags,
          coverImageUrl,
          allowComments,
        }),
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
  const summaryInput = document.getElementById("edit-summary");
  const tagsInput = document.getElementById("edit-tags");
  const coverImageInput = document.getElementById("edit-image");
  const allowCommentsInput = document.getElementById("edit-allow-comments");

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
    const parsed = parsePostContent(post);

    if (titleInput) titleInput.value = post.title ?? "";
    if (contentInput) contentInput.value = parsed.content ?? "";
    if (summaryInput) summaryInput.value = parsed.summary ?? "";
    if (tagsInput) tagsInput.value = parsed.tags ?? "";
    if (coverImageInput) coverImageInput.value = parsed.coverImageUrl ?? "";
    if (allowCommentsInput) allowCommentsInput.checked = parsed.allowComments;
  } catch (error) {
    console.error(error);
    alert(error.message);
    window.location.replace("/pages/posts.html");
  }
}

function buildContent({ summary, content, tags, coverImageUrl, allowComments }) {
  const parts = [];
  if (!allowComments) {
    parts.push("> 댓글이 비활성화된 게시글입니다.");
  }
  if (coverImageUrl) {
    parts.push(`![cover image](${coverImageUrl})`);
  }
  if (summary) {
    parts.push(summary);
  }
  if (content) {
    parts.push(content);
  }
  if (tags) {
    parts.push(`태그: ${tags}`);
  }
  return parts.join("\n\n");
}

function parsePostContent(post) {
  const result = {
    allowComments: true,
    summary: "",
    content: post.content ?? "",
    tags: "",
    coverImageUrl: "",
  };

  let working = post.content ?? "";

  if (!working.trim()) {
    return result;
  }

  const commentNoteRegex = /^>\s*댓글이 비활성화된 게시글입니다\.\s*\n*/m;
  if (commentNoteRegex.test(working)) {
    result.allowComments = false;
    working = working.replace(commentNoteRegex, "").trim();
  }

  if (Array.isArray(post.fileUrls) && post.fileUrls.length > 0) {
    result.coverImageUrl = post.fileUrls[0];
  } else {
    const imageRegex = /!\[[^\]]*]\((.*?)\)\s*/;
    const imageMatch = imageRegex.exec(working);
    if (imageMatch) {
      result.coverImageUrl = imageMatch[1];
      working = working.replace(imageMatch[0], "").trim();
    }
  }

  const tagRegex = /^태그:\s*(.+)$/m;
  const tagMatch = tagRegex.exec(working);
  if (tagMatch) {
    result.tags = tagMatch[1].trim();
    working = working.replace(tagMatch[0], "").trim();
  }

  const segments = working.split(/\n{2,}/).map((segment) => segment.trim()).filter(Boolean);
  if (segments.length) {
    if (segments.length > 1) {
      result.summary = segments[0].slice(0, 240);
      result.content = segments.slice(1).join("\n\n");
    } else {
      result.summary = "";
      result.content = segments[0];
    }
  } else {
    result.summary = "";
    result.content = working;
  }

  return result;
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
