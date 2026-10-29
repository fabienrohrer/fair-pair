import { escapeHtml } from "../utils.js";

export function renderAppBar({ t, language }) {
  return `
    <nav class="navbar navbar-expand-lg fairpair-appbar px-3 px-md-4 py-3 mb-4">
      <div class="container-fluid px-0">
        <div class="d-flex align-items-center justify-content-between w-100 gap-3">
          <div class="d-flex align-items-center gap-3">
            <img class="brand-logo appbar-logo" src="./fair-pair-logo.svg" alt="Fair Pair logo" />
          </div>
          <div class="d-flex align-items-center gap-2 ms-auto">
            <i class="bi bi-globe2 lang-icon" aria-hidden="true"></i>
            <div class="lang-switcher" role="group" aria-label="${t("language")}">
              <button type="button" class="lang-btn ${language === "en" ? "active" : ""}" data-lang="en">EN</button>
              <button type="button" class="lang-btn ${language === "fr" ? "active" : ""}" data-lang="fr">FR</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
}

export function renderNotificationStack({ uiState, t, wrap = true }) {
  if (uiState.notifications.length === 0) {
    return "";
  }
  const items = uiState.notifications
    .map(
      (notification) => `
        <div class="alert alert-${escapeHtml(notification.variant)} alert-dismissible fade show fp-notification-shadow mb-2" role="status" aria-live="polite" data-notification-id="${escapeHtml(notification.id)}">
          ${escapeHtml(notification.message)}
          <button type="button" class="btn-close" aria-label="${t("closeNotification")}" data-notification-dismiss="${escapeHtml(notification.id)}"></button>
        </div>
      `
    )
    .join("");

  if (!wrap) {
    return items;
  }

  return `<section class="fp-notification-stack" aria-label="Notifications">${items}</section>`;
}
