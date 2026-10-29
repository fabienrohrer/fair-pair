import { renderNotificationStack } from "../renderers.js";

export const notificationListComponent = {
  name: "notification-stack",
  getInitialLocalState() {
    return { collapsed: false };
  },
  render({ props, localState }) {
    const notificationsCount = props.uiState.notifications.length;
    if (notificationsCount === 0) {
      return "";
    }

    if (localState?.collapsed) {
      return `
        <section class="fp-notification-stack" aria-label="Notifications">
          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-light" data-notification-toggle>
              ${props.t("showNotifications")} (${notificationsCount})
            </button>
          </div>
        </section>
      `;
    }

    return `
      <section class="fp-notification-stack" aria-label="Notifications">
        <div class="d-flex justify-content-end mb-2">
          <button type="button" class="btn btn-sm btn-outline-light" data-notification-toggle>
            ${props.t("hideNotifications")}
          </button>
        </div>
        ${renderNotificationStack({ uiState: props.uiState, t: props.t, wrap: false })}
      </section>
    `;
  },
  bind({ host, props, setLocalState }) {
    host.querySelector("[data-notification-toggle]")?.addEventListener("click", () => {
      setLocalState((previous = { collapsed: false }) => ({
        ...previous,
        collapsed: !previous.collapsed,
      }));
      props.requestRender();
    });
  },
};
