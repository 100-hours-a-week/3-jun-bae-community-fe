import { API_BASE, TIMEOUT_MS } from "./defaults.js";

export const SESSION_UPDATED_EVENT = "session:updated";
export const SESSION_CLEARED_EVENT = "session:cleared";

let currentUser = null;
let inFlightPromise = null;

export function getSessionUser() {
  return currentUser;
}

export function isAuthenticated() {
  return Boolean(currentUser);
}

export function saveSession(user) {
  const sanitized = sanitizeUser(user);
  if (!sanitized) {
    clearSession();
    return;
  }
  currentUser = sanitized;
  dispatchSessionEvent(SESSION_UPDATED_EVENT, { user: sanitized });
}

export function clearSession() {
  currentUser = null;
  dispatchSessionEvent(SESSION_CLEARED_EVENT, {});
}

export async function ensureSession(forceRefresh = false) {
  if (!forceRefresh && currentUser) {
    return currentUser;
  }

  if (!inFlightPromise) {
    inFlightPromise = fetchSession().finally(() => {
      inFlightPromise = null;
    });
  }

  return inFlightPromise;
}

export async function refreshSession() {
  return ensureSession(true);
}

export async function logout() {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/auth/logout`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      timeout: TIMEOUT_MS,
    });

    if (!response.ok && response.status !== 401) {
      throw new Error("로그아웃에 실패했습니다.");
    }
  } finally {
    clearSession();
  }
}

function sanitizeUser(user) {
  if (!user || typeof user !== "object") return null;
  const {
    userId,
    id,
    email = "",
    nickname = "",
    profileImageUrl = "",
    roles = [],
    lastLoginAt = null,
  } = user;

  const resolvedId = typeof id === "number" ? id : userId;
  if (typeof resolvedId !== "number") return null;

  return {
    id: resolvedId,
    email: String(email || ""),
    nickname: String(nickname || ""),
    profileImageUrl: String(profileImageUrl || ""),
    roles: Array.isArray(roles) ? roles : [],
    lastLoginAt: lastLoginAt ? String(lastLoginAt) : null,
  };
}

async function fetchSession() {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/users/me`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      timeout: TIMEOUT_MS,
    });

    if (response.status === 401) {
      clearSession();
      return null;
    }

    if (!response.ok) {
      throw new Error("세션 정보를 불러오지 못했습니다.");
    }

    const payload = await response.json();
    saveSession(payload);
    return currentUser;
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("세션 요청이 시간 초과되었습니다.");
    } else {
      console.error("세션 정보를 확인하는 중 오류가 발생했습니다.", error);
    }
    return currentUser;
  }
}

function dispatchSessionEvent(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (error) {
    console.error("세션 이벤트를 전달하지 못했습니다.", error);
  }
}

function fetchWithTimeout(resource, options = {}) {
  const { timeout = TIMEOUT_MS, ...config } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const finalConfig = { ...config, signal: controller.signal };

  return fetch(resource, finalConfig).finally(() => clearTimeout(id));
}
