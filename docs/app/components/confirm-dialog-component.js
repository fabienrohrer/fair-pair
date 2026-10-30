import { escapeHtml } from "../utils.js";

export const confirmDialogComponent = {
  name: "confirm-dialog",
  render({ props }) {
    const { title, message, confirmLabel, cancelLabel, onClose } = props;

    return `
      <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 id="confirm-dialog-title" class="modal-title">${escapeHtml(title)}</h5>
              <button type="button" class="btn-close" data-confirm-dialog-close aria-label="${escapeHtml(cancelLabel)}"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">${escapeHtml(message)}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-confirm-dialog-cancel>${escapeHtml(cancelLabel)}</button>
              <button type="button" class="btn btn-danger" data-confirm-dialog-confirm>${escapeHtml(confirmLabel)}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show" data-confirm-dialog-backdrop></div>
    `;
  },
  bind({ host, props }) {
    const closeDialog = () => {
      if (typeof props.onClose === "function") {
        props.onClose();
      }
    };

    host.querySelector("[data-confirm-dialog-close]")?.addEventListener("click", closeDialog);
    host.querySelector("[data-confirm-dialog-cancel]")?.addEventListener("click", closeDialog);
    host.querySelector("[data-confirm-dialog-backdrop]")?.addEventListener("click", closeDialog);
    host.querySelector("[data-confirm-dialog-confirm]")?.addEventListener("click", () => {
      if (typeof props.onConfirm === "function") {
        props.onConfirm();
      }
      closeDialog();
    });
  },
};
