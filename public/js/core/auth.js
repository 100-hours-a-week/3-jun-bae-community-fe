import {
  ensureSession,
  getSessionUser,
  isAuthenticated,
  logout,
  SESSION_CLEARED_EVENT,
  SESSION_UPDATED_EVENT,
} from "./session.js";
// session 관리 와 session 정보에 따른 UI 업데이트 처리

const logoutHandlers = new WeakSet();

document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();
  ensureSession().finally(() => updateAuthUI());

  window.addEventListener(SESSION_UPDATED_EVENT, updateAuthUI);
  window.addEventListener(SESSION_CLEARED_EVENT, updateAuthUI);
  window.addEventListener("storage", updateAuthUI);

  setupLogoutActions();
});

function updateAuthUI() {
  const loggedIn = isAuthenticated();
  toggleAuthElements("[data-auth='guest']", !loggedIn);
  toggleAuthElements("[data-auth='user']", loggedIn);

  const currentUser = getSessionUser();
  updateNicknameDisplays(currentUser);
  setupLogoutActions();
}

function toggleAuthElements(selector, shouldShow) {
  document.querySelectorAll(selector).forEach((element) => {
    toggleElementVisibility(element, shouldShow);
  });
}

function toggleElementVisibility(element, shouldShow) {
  if (!element) return;

  if (shouldShow) {
    element.removeAttribute("hidden");
    element.removeAttribute("aria-hidden");
    element.removeAttribute("inert");
  } else {
    element.setAttribute("hidden", "true");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "true");
  }
}

function updateNicknameDisplays(user) {
  document.querySelectorAll("[data-auth-nickname]").forEach((element) => {
    if (!element.dataset.placeholder) {
      element.dataset.placeholder = element.textContent?.trim() || "Account";
    }
    element.textContent = user?.nickname || element.dataset.placeholder;
  });
}

function setupLogoutActions() {
  const elements = document.querySelectorAll("[data-action='logout']");
  elements.forEach((element) => {
    if (logoutHandlers.has(element)) return;
    const handler = async (event) => {
      event.preventDefault();
      await handleLogout(element);
    };
    element.addEventListener("click", handler);
    logoutHandlers.add(element);
  });
}

async function handleLogout(triggerElement) {
  setBusyState(triggerElement, true);
  try {
    await logout();
    const redirect = triggerElement.dataset.redirect;
    if (redirect) {
      window.location.href = redirect;
      return;
    }
    updateAuthUI();
  } catch (error) {
    console.error(error);
    alert(error.message || "로그아웃 중 오류가 발생했습니다.");
  } finally {
    setBusyState(triggerElement, false);
  }
}

function setBusyState(element, isBusy) {
  if (!element) return;
  if (isBusy) {
    element.setAttribute("aria-busy", "true");
    if (element instanceof HTMLButtonElement) {
      element.disabled = true;
    } else {
      element.dataset.prevPointerEvents = element.style.pointerEvents;
      element.style.pointerEvents = "none";
    }
  } else {
    element.removeAttribute("aria-busy");
    if (element instanceof HTMLButtonElement) {
      element.disabled = false;
    } else if ("prevPointerEvents" in element.dataset) {
      element.style.pointerEvents = element.dataset.prevPointerEvents || "";
      delete element.dataset.prevPointerEvents;
    }
  }
}
