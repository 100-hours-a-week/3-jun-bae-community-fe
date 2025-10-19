import { API_BASE, TIMEOUT_MS } from "./defaults.js";

const BOOKMARK_KEY = "community:bookmarks";
const COMMENT_PAGE_SIZE = 10;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("postId");

  const postDetail = document.getElementById("post-detail");
  const postTitle = document.getElementById("post-title");
  const postMeta = document.getElementById("post-meta");
  const postTopic = document.getElementById("post-topic");
  const postContent = document.getElementById("post-content");
  const postFigure = document.getElementById("post-figure");
  const postImage = document.getElementById("post-image");
  const postFigcaption = document.getElementById("post-figcaption");
  const likeCountEl = document.getElementById("post-like-count");
  const viewCountEl = document.getElementById("post-view-count");
  const replyCountEl = document.getElementById("post-reply-count");
  const likeButton = document.getElementById("post-like-button");
  const bookmarkButton = document.getElementById("post-bookmark-button");
  const editLink = document.getElementById("post-edit-link");

  const commentForm = document.getElementById("comment-form");
  const commentBodyInput = document.getElementById("comment-body");
  const commentList = document.getElementById("comment-list");
  const commentEmpty = document.getElementById("comment-empty");
  const loadMoreButton = document.getElementById("load-more-comments");
  const commentPagination = document.getElementById("comment-pagination");

  if (!postId) {
    renderPostError("잘못된 접근입니다. 게시글을 찾을 수 없습니다.");
    disableInteractions();
    return;
  }

  let likedState = false;
  let currentUserId = null;
  let commentPage = 0;
  let commentsTotalPages = 0;

  init();

  async function init() {
    await Promise.allSettled([loadCurrentUser(), loadPost()]);
    await loadComments();
    initBookmarkState();
  }

  async function loadCurrentUser() {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/users/me`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        timeout: TIMEOUT_MS,
      });
      if (!response.ok) return;
      const data = await response.json();
      currentUserId = data.id;
    } catch (error) {
      console.info("현재 로그인 정보를 불러오지 못했습니다.", error);
    }
  }

  async function loadPost() {
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
      updatePost(post);
    } catch (error) {
      console.error(error);
      renderPostError(error.message);
      disableInteractions();
    } finally {
      postDetail?.setAttribute("aria-busy", "false");
    }
  }

  async function loadComments(page = 0, append = false) {
    try {
      if (!commentList) return;
      const params = new URLSearchParams({
        page: String(page),
        size: String(COMMENT_PAGE_SIZE),
      });

      const response = await fetchWithTimeout(
        `${API_BASE}/posts/${postId}/comments?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          timeout: TIMEOUT_MS,
        }
      );

      if (!response.ok) {
        throw new Error("댓글을 불러오지 못했습니다.");
      }

      const payload = await response.json();
      const comments = Array.isArray(payload.items) ? payload.items : [];

      if (!append) {
        commentList.innerHTML = "";
      }

      if (!comments.length && page === 0) {
        if (commentEmpty) {
          commentEmpty.removeAttribute("hidden");
          commentList.appendChild(commentEmpty);
        }
      } else {
        commentEmpty?.setAttribute("hidden", "true");
        comments.forEach((comment) => {
          commentList.appendChild(renderComment(comment));
        });
      }

      commentPage = payload.page ?? page;
      commentsTotalPages = payload.totalPages ?? 0;
      updateCommentPagination();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  function updateCommentPagination() {
    const hasMore = commentPage < commentsTotalPages - 1;
    if (hasMore) {
      commentPagination.removeAttribute("hidden");
    } else {
      commentPagination.setAttribute("hidden", "true");
    }
  }

  function updatePost(post) {
    postTitle.textContent = post.title ?? "(제목 없음)";
    postMeta.innerHTML = buildPostMeta(post);
    if (post.author?.nickname) {
      postTopic.textContent = `${post.author.nickname}님의 이야기`;
      postTopic.removeAttribute("hidden");
    } else {
      postTopic.textContent = "";
      postTopic.setAttribute("hidden", "true");
    }

    renderContent(postContent, post.content ?? "");

    likeCountEl.textContent = formatNumber(post.likeCount);
    viewCountEl.textContent = formatNumber(post.viewCount);
    replyCountEl.textContent = formatNumber(post.replyCount);

    likedState = Boolean(post.liked);
    updateLikeButton();

    if (Array.isArray(post.fileUrls) && post.fileUrls.length > 0) {
      const [first] = post.fileUrls;
      postFigure.hidden = false;
      postImage.src = first;
      postImage.alt = `${post.title ?? "게시글"} 첨부 이미지`;
      postFigcaption.textContent = "첨부 이미지";
    } else {
      postFigure.hidden = true;
    }

    if (editLink) {
      editLink.href = `/pages/postedit.html?postId=${post.id}`;
      editLink.removeAttribute("data-disabled");
    }

    likeButton?.addEventListener("click", handleLikeToggle);
    bookmarkButton?.addEventListener("click", handleBookmarkToggle);
    commentForm?.addEventListener("submit", handleCommentSubmit);
    loadMoreButton?.addEventListener("click", () => {
      loadComments(commentPage + 1, true);
    });
    commentList?.addEventListener("click", handleCommentClicks);
  }

  async function handleLikeToggle() {
    if (!postId) return;

    try {
      likeButton.disabled = true;
      const method = likedState ? "DELETE" : "POST";
      const response = await fetchWithTimeout(
        `${API_BASE}/posts/${postId}/likes`,
        {
          method,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          timeout: TIMEOUT_MS,
        }
      );

      if (!response.ok) {
        throw new Error(likedState ? "좋아요 취소에 실패했습니다." : "좋아요에 실패했습니다.");
      }

      const payload = await response.json();
      likedState = Boolean(payload.liked);
      likeCountEl.textContent = formatNumber(payload.likeCount);
      updateLikeButton();
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      likeButton.disabled = false;
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    if (!commentBodyInput) return;
    const content = commentBodyInput.value.trim();
    if (!content) return;

    try {
      const submitControl = commentForm?.querySelector("button[type='submit']");
      submitControl && (submitControl.disabled = true);
      const response = await fetchWithTimeout(
        `${API_BASE}/posts/${postId}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          timeout: TIMEOUT_MS,
        }
      );

      if (!response.ok) {
        throw new Error("댓글 등록에 실패했습니다.");
      }

      commentBodyInput.value = "";
      await loadComments(0, false);
      replyCountEl.textContent = formatNumber(parseNumber(replyCountEl.textContent) + 1);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      const submitControl = commentForm?.querySelector("button[type='submit']");
      submitControl && (submitControl.disabled = false);
    }
  }

  async function handleCommentClicks(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.action === "edit-comment") {
      event.preventDefault();
      const article = target.closest("article");
      if (!article) return;
      const commentId = article.dataset.commentId;
      const bodyElement = article.querySelector("[data-comment-body]");
      const currentContent = bodyElement?.textContent ?? "";
      const updated = prompt("댓글을 수정하세요.", currentContent);
      if (updated === null) return;
      const trimmed = updated.trim();
      if (!trimmed) {
        alert("댓글 내용은 비어 있을 수 없습니다.");
        return;
      }
      await updateComment(commentId, trimmed, bodyElement);
    }

    if (target.dataset.action === "delete-comment") {
      event.preventDefault();
      const article = target.closest("article");
      if (!article) return;
      const commentId = article.dataset.commentId;
      const confirmed = confirm("댓글을 삭제하시겠습니까?");
      if (!confirmed) return;
      await deleteComment(commentId, article);
    }
  }

  async function updateComment(commentId, content, bodyElement) {
    if (!commentId) return;
    try {
      const response = await fetchWithTimeout(`${API_BASE}/comments/${commentId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        timeout: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error("댓글 수정에 실패했습니다.");
      }

      const payload = await response.json();
      if (bodyElement) {
        bodyElement.textContent = payload.content ?? content;
      }
      const timeElement = bodyElement?.closest("article")?.querySelector("time");
      if (timeElement && payload.updatedAt) {
        timeElement.textContent = formatRelativeTime(payload.updatedAt);
        timeElement.dateTime = payload.updatedAt;
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function deleteComment(commentId, article) {
    if (!commentId) return;
    try {
      const response = await fetchWithTimeout(`${API_BASE}/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
        timeout: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error("댓글 삭제에 실패했습니다.");
      }

      article.remove();
      const remaining = commentList?.querySelectorAll("article").length ?? 0;
      if (remaining === 0) {
        if (commentEmpty && commentList) {
          commentEmpty.removeAttribute("hidden");
          commentList.appendChild(commentEmpty);
        }
      }
      replyCountEl.textContent = formatNumber(Math.max(parseNumber(replyCountEl.textContent) - 1, 0));
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  function renderComment(comment) {
    const article = document.createElement("article");
    article.dataset.commentId = String(comment.id ?? "");

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = comment.authorNickname ?? "익명";
    const time = document.createElement("p");
    const timeElement = document.createElement("time");
    if (comment.updatedAt) {
      timeElement.dateTime = comment.updatedAt;
      timeElement.textContent = formatRelativeTime(comment.updatedAt);
    } else if (comment.createdAt) {
      timeElement.dateTime = comment.createdAt;
      timeElement.textContent = formatRelativeTime(comment.createdAt);
    } else {
      timeElement.textContent = "방금 전";
    }
    time.appendChild(timeElement);
    header.appendChild(title);
    header.appendChild(time);

    const body = document.createElement("p");
    body.dataset.commentBody = "true";
    body.textContent = comment.content ?? "";

    article.appendChild(header);
    article.appendChild(body);

    if (currentUserId && comment.authorId === currentUserId) {
      const actions = document.createElement("div");
      actions.className = "comment-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary";
      editButton.dataset.action = "edit-comment";
      editButton.textContent = "수정";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "secondary";
      deleteButton.dataset.action = "delete-comment";
      deleteButton.textContent = "삭제";
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      article.appendChild(actions);
    }

    return article;
  }

  function updateLikeButton() {
    if (!likeButton) return;
    likeButton.setAttribute("aria-pressed", String(likedState));
    likeButton.textContent = likedState ? "좋아요 취소" : "좋아요";
  }

  function handleBookmarkToggle() {
    if (!bookmarkButton) return;
    const bookmarks = loadBookmarks();
    const numericId = Number(postId);
    const index = bookmarks.indexOf(numericId);
    if (index > -1) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push(numericId);
    }
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
    updateBookmarkButton(bookmarks.includes(numericId));
  }

  function initBookmarkState() {
    const bookmarks = loadBookmarks();
    updateBookmarkButton(bookmarks.includes(Number(postId)));
  }

  function updateBookmarkButton(isBookmarked) {
    if (!bookmarkButton) return;
    bookmarkButton.textContent = isBookmarked ? "북마크 해제" : "북마크";
    bookmarkButton.setAttribute("aria-pressed", String(isBookmarked));
  }

  function loadBookmarks() {
    try {
      const stored = localStorage.getItem(BOOKMARK_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

function renderPostError(message) {
  postTitle.textContent = message;
  postMeta.textContent = "";
  postContent.innerHTML = "";
  likeCountEl.textContent = "0";
  viewCountEl.textContent = "0";
  replyCountEl.textContent = "0";
  const postFigure = document.getElementById("post-figure");
  if (postFigure) {
    postFigure.hidden = true;
  }
}

  function disableInteractions() {
    likeButton?.setAttribute("disabled", "true");
    bookmarkButton?.setAttribute("disabled", "true");
    commentForm?.setAttribute("hidden", "true");
    loadMoreButton?.setAttribute("disabled", "true");
  }
});

function fetchWithTimeout(resource, options = {}) {
  const { timeout = TIMEOUT_MS, ...config } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const finalConfig = { ...config, signal: controller.signal };
  return fetch(resource, finalConfig).finally(() => clearTimeout(id));
}

function buildPostMeta(post) {
  const author = post.author?.nickname ?? "알 수 없음";
  const created = post.createdAt ? formatDate(post.createdAt) : "알 수 없음";
  const updated =
    post.updatedAt && post.updatedAt !== post.createdAt
      ? ` · 업데이트 ${formatRelativeTime(post.updatedAt)}`
      : "";
  return `by <strong>${escapeHtml(author)}</strong> • ${created}${updated}`;
}

function renderContent(container, rawContent) {
  container.innerHTML = "";
  const sections = rawContent.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (!sections.length) {
    const empty = document.createElement("p");
    empty.textContent = "게시글 내용이 없습니다.";
    container.appendChild(empty);
    return;
  }
  sections.forEach((section) => {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = escapeHtml(section).replace(/\n/g, "<br>");
    container.appendChild(paragraph);
  });
}

function formatRelativeTime(dateString) {
  if (!dateString) return "방금 전";
  const date = new Date(dateString);
  if (Number.isNaN(date.valueOf())) return "방금 전";

  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.valueOf())) return "알 수 없음";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value ?? 0);
}

function parseNumber(value) {
  const number = parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isNaN(number) ? 0 : number;
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
