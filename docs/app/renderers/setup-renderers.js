import { normalizeSwissSettings } from "../../swiss.js";
import { getPlayerAge, normalizePlayerEntries } from "../../tournament-state.js";
import { escapeHtml } from "../utils.js";

function buildPlayerChipStyle(player) {
  const hue = Number.isFinite(player?.hue) ? Number(player.hue) : 210;
  const start = (hue + 18) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 80% 62%) 0%, hsl(${start} 80% 68%) 100%)`,
    boxShadow: `0 0.35rem 0.8rem hsl(${hue} 80% 55% / 25%)`,
  };
}

function buildPlayerTooltip(player) {
  if (!player) {
    return "";
  }

  const fragments = [player.name];
  if (player.dateOfBirth) {
    fragments.push(`DOB: ${player.dateOfBirth}`);
  }
  const age = getPlayerAge(player);
  if (age !== null) {
    fragments.push(`Age: ${age}`);
  }

  return fragments.join(" • ");
}

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
  const players = normalizePlayerEntries(Array.isArray(uiState.setupPlayers) ? uiState.setupPlayers : []);
  const swissSettings = normalizeSwissSettings(tournament?.swissSettings || uiState.setupSwissConfig || undefined);
  const swissSettingsVisible = uiState.setupTournamentType === "swiss";
  const playerListMarkup = players.length
    ? players.map((player, index) => {
        const chipStyle = buildPlayerChipStyle(player);
        const age = getPlayerAge(player);
        const tooltip = buildPlayerTooltip(player);
        return `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center gap-3">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span
                  class="player-chip"
                  title="${escapeHtml(tooltip)}"
                  style="background: ${chipStyle.background}; box-shadow: ${chipStyle.boxShadow};"
                >
                  ${escapeHtml(player.name)}
                </span>
                ${player.dateOfBirth ? `<span class="badge text-bg-light">${escapeHtml(player.dateOfBirth)}</span>` : ""}
                ${age !== null ? `<span class="badge text-bg-secondary">${t("profileAge")}: ${age}</span>` : ""}
              </div>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-secondary edit-player-button" data-player-index="${index}">${t("editPlayer")}</button>
                <button type="button" class="btn btn-outline-danger delete-player-button" data-player-index="${index}">${t("deletePlayer")}</button>
              </div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="list-group-item text-muted small">${t("playerListEmpty")}</div>`;
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
              <div class="d-flex justify-content-between align-items-center mb-2 gap-3">
                <label class="form-label mb-0">${t("players")}</label>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-sm btn-outline-primary" id="import-players-button">
                    <span aria-hidden="true">＋</span> ${t("importPlayers")}
                  </button>
                  <button type="button" class="btn btn-sm btn-primary" id="add-player-button">
                    <span aria-hidden="true">＋</span> ${t("addPlayer")}
                  </button>
                </div>
              </div>
              <div class="list-group player-manager-list">${playerListMarkup}</div>
            </div>
            <button type="submit" class="btn btn-primary">${
              isEdit ? t("updateTournament") : t("createTournament")
            }</button>
          </form>
        </div>
      </div>
    </section>

    <div class="modal fade" id="player-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <form id="player-modal-form">
            <div class="modal-header">
              <h5 class="modal-title">${t("playerFormTitle")}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t("cancel")}"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="player-modal-index" value="-1" />
              <div class="mb-3">
                <label for="player-name" class="form-label">${t("playerName")}</label>
                <input id="player-name" class="form-control" maxlength="120" required />
              </div>
              <div class="mb-3">
                <label for="player-date-of-birth" class="form-label">${t("dateOfBirth")}</label>
                <input id="player-date-of-birth" type="date" class="form-control" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("playerFormSave")}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal fade" id="import-players-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <form id="import-players-form">
            <div class="modal-header">
              <h5 class="modal-title">${t("importPlayersTitle")}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t("cancel")}"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted small mb-3">${t("importPlayersHint")}</p>
              <textarea id="import-players-text" class="form-control" rows="8" placeholder="Alice, 2000-05-12\nBob\nClaire, 1999-02-18"></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("importPlayers")}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
