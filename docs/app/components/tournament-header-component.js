import { escapeHtml } from "../utils.js";

export const tournamentHeaderComponent = {
  name: "tournament-header",
  render({ props }) {
    const { tournamentName, t } = props;
    return `
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h1 class="h4 mb-0">${escapeHtml(tournamentName)}</h1>
        <div class="d-flex gap-2">
          <button id="back-home" class="btn btn-outline-secondary">${t("backToHome")}</button>
        </div>
      </div>
    `;
  },
};
