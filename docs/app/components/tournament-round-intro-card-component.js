import { escapeHtml } from "../utils.js";

export const tournamentRoundIntroCardComponent = {
  name: "tournament-round-intro",
  render({ props }) {
    const { tournamentName, roundsCount, t } = props;
    return `
      <div class="card shadow-sm mt-4">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h3 class="h5 mb-1">${escapeHtml(tournamentName)}</h3>
            <p class="text-muted mb-0">${t("roundsCount")}: ${roundsCount}</p>
          </div>
          <button id="prepare-round" class="btn btn-primary">${t("prepareRound")}</button>
        </div>
      </div>
    `;
  },
};
