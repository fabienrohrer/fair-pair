import { normalizeSwissSettings } from "../../swiss.js";
import { escapeHtml } from "../utils.js";

export function renderSetupView({
  uiState,
  getTournamentById,
  t,
  setupHeaderContent = "",
  setupTypePanelContent = "",
  setupSwissSettingsContent = "",
}) {
  const isEdit = uiState.setupMode === "edit";
  const tournament = isEdit ? getTournamentById(uiState.setupTournamentId) : null;
  const name = tournament?.name || "";
  const playersText = tournament ? tournament.players.map((player) => player.name).join("\n") : "";
  const swissSettings = normalizeSwissSettings(tournament?.swissSettings || uiState.setupSwissConfig || undefined);
  const swissSettingsVisible = uiState.setupTournamentType === "swiss";
  const swissSettingsContent =
    setupSwissSettingsContent ||
    `
      <div id="swiss-settings-panel" class="card border-0 bg-transparent ${swissSettingsVisible ? "" : "d-none"}">
        <div class="card-body px-0 pb-0">
          <h3 class="h6 mb-3">${t("swissOptions")}</h3>
          <div class="row g-3">
            <div class="col-12 col-md-5">
              <label for="swiss-score-mode" class="form-label">${t("swissScoring")}</label>
              <select id="swiss-score-mode" class="form-select">
                <option value="standard" ${swissSettings.scoreMode === "standard" ? "selected" : ""}>${t(
                  "swissScoringStandard"
                )}</option>
                <option value="double" ${swissSettings.scoreMode === "double" ? "selected" : ""}>${t(
                  "swissScoringDouble"
                )}</option>
              </select>
            </div>
            <div class="col-12 col-md-4">
              <label for="swiss-bye-policy" class="form-label">${t("swissByePolicy")}</label>
              <select id="swiss-bye-policy" class="form-select">
                <option value="lowest_score" ${swissSettings.byeStrategy === "lowest_score" ? "selected" : ""}>${t(
                  "swissByeLowest"
                )}</option>
                <option value="random" ${swissSettings.byeStrategy === "random" ? "selected" : ""}>${t(
                  "swissByeRandom"
                )}</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">${t("swissTiebreaker")}</label>
              <div class="form-control-plaintext text-muted pt-2">${t("swissTiebreakerBuchholz")}</div>
            </div>
          </div>
        </div>
      </div>
    `;

  return `
    <section>
      ${setupHeaderContent}
      <div class="card shadow-sm">
        <div class="card-body">
          <form id="setup-form">
            <div class="mb-3">
              <label for="tournament-name" class="form-label">${t("tournamentName")}</label>
              <input id="tournament-name" class="form-control" value="${escapeHtml(name)}" required />
            </div>
            ${setupTypePanelContent}
            ${swissSettingsContent}
            <div class="mb-3 mt-3">
              <label for="players-input" class="form-label">${t("players")}</label>
              <textarea id="players-input" class="form-control" rows="8" required>${escapeHtml(
                playersText
              )}</textarea>
            </div>
            <button type="submit" class="btn btn-primary">${
              isEdit ? t("updateTournament") : t("createTournament")
            }</button>
          </form>
        </div>
      </div>
    </section>
  `;
}
