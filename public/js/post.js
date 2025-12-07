import { Modal } from "./core/modal.js";
import { API_BASE, TIMEOUT_MS } from "./core/defaults.js";
import { getSessionUser } from "./core/session.js";

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
  const editLinkButton = document.getElementById("post-edit-link");

  const commentForm = document.getElementById("comment-form");
  const commentBodyInput = document.getElementById("comment-body");
  const commentList = document.getElementById("comment-list");
  const commentEmpty = document.getElementById("comment-empty");
  const loadMoreButton = document.getElementById("load-more-comments");
  const commentPagination = document.getElementById("comment-pagination");

  const voteSection = document.getElementById("vote-section");
  const voteResult = document.getElementById("vote-result");
  const voteButtons = document.querySelectorAll(".vote-btn");

  if (!postId) {
    renderPostError("잘못된 접근입니다. 게시글을 찾을 수 없습니다.");
    disableInteractions();
    return;
  }

  let likedState = false;
  let currentUserId = null;
  let commentPage = 0;
  let commentsTotalPages = 0;
  let currentPost = null;

  init();

  async function init() {
    await Promise.allSettled([loadPost()]);
    await loadComments();
    const user = getSessionUser();
    if (user) {
      currentUserId = user.id;
      loadLikeState();
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
      currentPost = post;
      updatePost(post);
      updateVoteState(post);
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
      Modal.alert(error.message);
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
    if (postTopic) {
      if (post.author?.nickname) {
        postTopic.textContent = `${post.author.nickname}님의 이야기`;
        postTopic.removeAttribute("hidden");
      } else {
        postTopic.textContent = "";
        postTopic.setAttribute("hidden", "true");
      }
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

    // Show edit link only if current user is the author
    if (editLinkButton && post.author.id === getSessionUser()?.id) {
      editLinkButton.removeAttribute("hidden");
      editLinkButton.addEventListener("click", () => {
        window.location.href = `/pages/postedit.html?postId=${post.id}`;
      });
      editLinkButton.removeAttribute("hidden"); // Ensure it's visible
    }

    likeButton?.addEventListener("click", handleLikeToggle);
    commentForm?.addEventListener("submit", handleCommentSubmit);
    loadMoreButton?.addEventListener("click", () => {
      loadComments(commentPage + 1, true);
    });
    commentList?.addEventListener("click", handleCommentClicks);

    voteButtons.forEach(btn => {
      btn.addEventListener("click", (e) => handleVote(e.target.dataset.vote));
    });
  }

  function updateVoteState(post) {
    if (!voteSection) return;

    voteSection.hidden = false;

    const user = getSessionUser();
    // If user is author, disable buttons and show message
    if (user && post.author?.id === user.id) {
      disableVoteButtons();
      if (voteResult) {
        voteResult.hidden = false;
        voteResult.textContent = "자신의 게시글에는 투표할 수 없습니다.";
        voteResult.className = "vote-result";
      }
      return;
    }

    if (post.currentUserVote) {
      showVoteResult(post.currentUserVote.voteType, post.currentUserVote.isCorrect);
      disableVoteButtons();
    }
  }

  async function handleVote(voteType) {
    if (!voteType || !postId) return;

    const user = getSessionUser();
    if (!user) {
      Modal.alert("로그인 후 투표가 가능합니다.");
      return;
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE}/posts/${postId}/vote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType }),
        timeout: TIMEOUT_MS
      });

      if (!response.ok) {
        throw new Error("투표에 실패했습니다.");
      }

      const result = await response.json();
      if (result.success && result.data) {
        const { correct, userTotalScore } = result.data;
        showVoteResult(voteType, correct, userTotalScore);
        disableVoteButtons();
      } else {
        // Fallback
        await loadPost();
      }

    } catch (error) {
      console.error(error);
      Modal.alert(error.message);
    }
  }

  function showVoteResult(voteType, isCorrect, score) {
    if (!voteResult) return;

    voteResult.hidden = false;
    voteResult.className = "vote-result"; // Reset classes

    if (isCorrect) {
      voteResult.innerHTML = `정답입니다! 🎉<br>`;

      voteResult.classList.add("vote-correct");
      triggerConfetti();
    } else {
      voteResult.innerHTML = `틀렸습니다. 😢<br>`;
      voteResult.classList.add("vote-incorrect");
    }
    if (score != null) {
      voteResult.innerHTML += `<small>현재 점수: ${formatNumber(score)}점</small>`;
    }
  }

  function disableVoteButtons() {
    voteButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
  }

  function triggerConfetti() {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // 입자 생성
      createConfettiParticles(10);
    }, 250);
  }

  function createConfettiParticles(count) {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
    const container = document.body;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.width = '10px';
      el.style.height = '10px';
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.top = '-10px';
      el.style.zIndex = '9999';
      el.style.pointerEvents = 'none';
      el.style.transition = 'top 2s ease-in, transform 2s linear';

      container.appendChild(el);

      // Trigger animation
      requestAnimationFrame(() => {
        el.style.top = '110vh';
        el.style.transform = `rotate(${Math.random() * 360}deg)`;
      });

      // Cleanup
      setTimeout(() => {
        el.remove();
      }, 2000);
    }
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
      Modal.alert(error.message);
    } finally {
      likeButton.disabled = false;
    }
  }

  async function loadLikeState() {
    // Optional: If specific like state loading is needed separately
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
      Modal.alert(error.message);
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
      const updated = await Modal.prompt("댓글을 수정하세요.", currentContent);
      if (updated === null) return;
      const trimmed = updated.trim();
      if (!trimmed) {
        Modal.alert("댓글 내용은 비어 있을 수 없습니다.");
        return;
      }
      await updateComment(commentId, trimmed, bodyElement);
    }

    if (target.dataset.action === "delete-comment") {
      event.preventDefault();
      const article = target.closest("article");
      if (!article) return;
      const commentId = article.dataset.commentId;
      const confirmed = await Modal.confirm("댓글을 삭제하시겠습니까?");
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
      Modal.alert(error.message);
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
      Modal.alert(error.message);
    }
  }

  function renderComment(comment) {
    const article = document.createElement("article");
    article.dataset.commentId = String(comment.id ?? "");

    const heading = document.createElement("heading");
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
    heading.appendChild(title);
    heading.appendChild(time);

    const body = document.createElement("p");
    body.dataset.commentBody = "true";
    body.textContent = comment.content ?? "";

    article.appendChild(heading);
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
    commentForm?.setAttribute("hidden", "true");
    loadMoreButton?.setAttribute("disabled", "true");
    disableVoteButtons();
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
