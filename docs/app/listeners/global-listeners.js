export function attachGlobalListeners({ dismissNotification }) {
  document.querySelectorAll("[data-notification-dismiss]").forEach((button) => {
    button.addEventListener("click", () => {
      dismissNotification(button.dataset.notificationDismiss);
    });
  });
}
