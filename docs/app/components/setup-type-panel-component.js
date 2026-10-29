import { escapeHtml } from "../utils.js";

export const setupTypePanelComponent = {
  name: "setup-type-selector",
  render({ props }) {
    const { t, setupTournamentType } = props;
    return `
      <div class="mb-3">
        <label class="form-label">${t("tournamentType")}</label>
        <div class="row g-3 tournament-type-cards">
          <div class="col-12 col-md-6">
            <button
              type="button"
              class="card tournament-type-option ${setupTournamentType === "manual" ? "selected" : ""}"
              data-tournament-type="manual"
            >
              <div class="card-body">
                <h3 class="h6 mb-2">${t("tournamentTypeManual")}</h3>
                <p class="mb-0 small text-muted">${t("tournamentTypeManualDescription")}</p>
              </div>
            </button>
          </div>
          <div class="col-12 col-md-6">
            <button
              type="button"
              class="card tournament-type-option ${setupTournamentType === "swiss" ? "selected" : ""}"
              data-tournament-type="swiss"
            >
              <div class="card-body">
                <h3 class="h6 mb-2">${t("tournamentTypeSwiss")}</h3>
                <p class="mb-0 small text-muted">${t("tournamentTypeSwissDescription")}</p>
              </div>
            </button>
          </div>
        </div>
        <input id="tournament-type" type="hidden" value="${escapeHtml(setupTournamentType || "manual")}" />
      </div>
    `;
  },
};
