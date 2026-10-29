export const setupHeaderComponent = {
  name: "setup-header",
  render({ props }) {
    const { t, isEdit } = props;
    return `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h4 mb-0">${isEdit ? t("setupTitleEdit") : t("setupTitleCreate")}</h1>
        <button id="cancel-setup" class="btn btn-outline-secondary">${t("cancel")}</button>
      </div>
    `;
  },
};
