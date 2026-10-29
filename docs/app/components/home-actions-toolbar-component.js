export const homeActionsToolbarComponent = {
  name: "home-toolbar",
  render({ props }) {
    const { t } = props;
    return `
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="h4 mb-0">${t("homeTitle")}</h1>
        <div class="d-flex gap-2">
          <button id="add-tournament" class="btn btn-primary">+ ${t("addTournament")}</button>
          <button id="reset-all" class="btn btn-outline-danger">${t("resetAll")}</button>
        </div>
      </div>
    `;
  },
};
