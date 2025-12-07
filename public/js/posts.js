import { API_BASE, TIMEOUT_MS } from "./core/defaults.js";

const state = {
  items: [],
  cursor: null,
  hasNext: true,
  loading: false,
};

document.addEventListener("DOMContentLoaded", () => {
  const feedSection = document.getElementById("post-feed");
  const postList = document.getElementById("post-list");
  const emptyState = document.getElementById("post-empty");
  const scrollAnchor = document.getElementById("scroll-anchor");
  const loadingIndicator = document.getElementById("post-loading-indicator");
  const searchInput = document.getElementById("post-search");
  const sortSelect = document.getElementById("post-sort");

  if (!postList || !scrollAnchor) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          fetchPosts();
        }
      });
    },
    { rootMargin: "200px 0px" }
  );

  observer.observe(scrollAnchor);

  searchInput?.addEventListener("input", () => renderPosts());
  sortSelect?.addEventListener("change", () => fetchPosts(true));

  fetchPosts(true);

  async function fetchPosts(initial = false) {
    if (state.loading) return;
    if (!state.hasNext && !initial) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (initial) {
        state.cursor = null;
        state.hasNext = true;
      }
      if (state.cursor && !initial) {
        params.set("cursorId", state.cursor);
      }
      params.set("size", "12");

      const sortValue = sortSelect?.value ?? "latest";
      let sortParam = "latest";
      switch (sortValue) {
        case "latest":
          sortParam = "latest";
          break;
        case "popular":
          sortParam = "likes";
          break;
        case "commented":
          sortParam = "comments";
          break;
        case "views":
          sortParam = "views";
          break;
        default:
          sortParam = "latest";
          break;
      }

      params.set("sort", sortParam);

      const response = await fetchWithTimeout(
        `${API_BASE}/posts?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          timeout: TIMEOUT_MS,
        }
      );

      if (!response.ok) {
        throw new Error("게시글을 불러오지 못했습니다.");
      }

      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];

      state.items = initial ? items : [...state.items, ...items];
      state.cursor = payload.nextCursor ?? null;
      state.hasNext = Boolean(payload.hasNext);

      renderPosts();

      if (!state.hasNext) {
        observer.unobserve(scrollAnchor);
        scrollAnchor.dataset.loading = "done";
        if (loadingIndicator) {
          loadingIndicator.hidden = true;
        }
        scrollAnchor.innerHTML = `<p class="empty-state">모든 게시글을 확인했습니다.</p>`;
      }
    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function renderPosts() {
    const keyword = searchInput?.value.trim().toLowerCase() ?? "";

    // Frontend search filtering (as per plan/request to only change sorting)
    const filtered = state.items.filter((post) => {
      if (!keyword) return true;
      const title = (post.title ?? "").toLowerCase();
      const author = (post.authorNickname ?? "").toLowerCase();
      const content = (post.content ?? "").toLowerCase();
      return (
        title.includes(keyword) || author.includes(keyword) || content.includes(keyword)
      );
    });

    // Removed frontend sorting as it is now handled by backend

    postList.innerHTML = "";

    if (!filtered.length) {
      emptyState?.removeAttribute("hidden");
      emptyState && (emptyState.textContent = keyword ? "검색 결과가 없습니다." : "아직 게시글이 없습니다.");
      postList.appendChild(emptyState);
      return;
    }

    emptyState?.setAttribute("hidden", "true");

    filtered.forEach((post) => {
      postList.appendChild(renderPostCard(post));
    });
  }

  function renderPostCard(post) {
    const article = document.createElement("article");

    const heading = document.createElement("heading");
    const title = document.createElement("h2");
    const titleLink = document.createElement("a");
    titleLink.href = `/pages/post.html?postId=${post.id}`;
    titleLink.textContent = post.title ?? "(제목 없음)";
    title.appendChild(titleLink);

    const meta = document.createElement("p");
    const authorNickname = post.authorNickname ?? "알 수 없음";
    const createdAt = formatRelativeTime(post.createdAt);
    meta.innerHTML = `by <strong>${escapeHtml(authorNickname)}</strong> • ${createdAt}`;

    heading.appendChild(title);
    heading.appendChild(meta);

    const preview = document.createElement("p");
    preview.textContent = buildExcerpt(post.content);

    const footer = document.createElement("footer");
    footer.className = "post-card-footer";

    const stats = document.createElement("div");
    stats.className = "post-meta-stats";
    stats.setAttribute("aria-label", "게시글 통계");
    stats.innerHTML = `
      <span><strong>좋아요</strong> ${formatNumber(post.likeCount)}</span>
      <span><strong>조회수</strong> ${formatNumber(post.viewCount)}</span>
      <span><strong>댓글</strong> ${formatNumber(post.replyCount)}</span>
    `;

    const readMore = document.createElement("a");
    readMore.href = `/pages/post.html?postId=${post.id}`;
    readMore.setAttribute("role", "button");
    readMore.textContent = "Read More";

    footer.appendChild(stats);
    footer.appendChild(readMore);

    article.appendChild(heading);
    article.appendChild(preview);
    article.appendChild(footer);

    return article;
  }

  function setLoading(flag) {
    state.loading = flag;
    feedSection?.setAttribute("aria-busy", String(flag));
    scrollAnchor.dataset.loading = flag ? "true" : "false";
    if (loadingIndicator) {
      loadingIndicator.hidden = !flag;
    }
  }

  function setError(message) {
    if (!message) {
      scrollAnchor.removeAttribute("data-error");
      if (loadingIndicator && !scrollAnchor.contains(loadingIndicator)) {
        scrollAnchor.innerHTML = "";
        scrollAnchor.appendChild(loadingIndicator);
      }
      return;
    }
    scrollAnchor.dataset.error = message;
    scrollAnchor.innerHTML = `<p role="alert">${escapeHtml(message)} <button class="secondary" type="button" id="retry-fetch">다시 시도</button></p>`;
    const retry = document.getElementById("retry-fetch");
    retry?.addEventListener("click", () => {
      scrollAnchor.innerHTML = "";
      scrollAnchor.appendChild(loadingIndicator);
      fetchPosts();
    });
  }
});

function fetchWithTimeout(resource, options = {}) {
  const { timeout = TIMEOUT_MS, ...config } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const finalConfig = { ...config, signal: controller.signal };

  return fetch(resource, finalConfig).finally(() => clearTimeout(id));
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

function buildExcerpt(content = "") {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text || "내용 미리보기가 없습니다.";
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value ?? 0);
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
