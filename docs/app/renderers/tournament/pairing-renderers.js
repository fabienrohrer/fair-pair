import { getPairingStageRules, resolveAutoPairingMode } from "../../../tournament-state.js";
import { pairingToolsPanelComponent } from "../../components/pairing-tools-panel-component.js";
import { roundStageBannerComponent } from "../../components/round-stage-banner-component.js";
import {
  buildPriorityOptions,
  getPairingUnassignedIds,
  renderPlayerChip,
} from "../shared-renderers.js";

export function renderPairingDraft(tournament, state, t, getPlayerName) {
  const draft = tournament.currentRoundDraft;
  const unassigned = getPairingUnassignedIds(tournament);
  const byeEnabled = tournament.players.length % 2 === 1;
  const stageRules = getPairingStageRules(tournament.tournamentType, tournament.rounds.length);
  const selectedMode = resolveAutoPairingMode(draft.autoOptions.mode, stageRules);
  const allowManualPairing = stageRules.allowManualPairing;
  const allowAutoPairingTools = stageRules.allowAutoPairingTools;
  const priorityValue = draft.autoOptions.priorityOrder.join("|");
  const isAutomaticMode = selectedMode === "automatic";
  const isSwissTournament = tournament.tournamentType === "swiss";

  const tables = draft.pairing.tables
    .map((table, index) => {
      const aContent = table.a
        ? renderPlayerChip(
            tournament,
            table.a,
            "pairing",
            `table-${index}-a`,
            getPlayerName,
            allowManualPairing
          )
        : `<div class="drop-empty">${t("dropPlayer")}</div>`;
      const bContent = table.b
        ? renderPlayerChip(
            tournament,
            table.b,
            "pairing",
            `table-${index}-b`,
            getPlayerName,
            allowManualPairing
          )
        : `<div class="drop-empty">${t("dropPlayer")}</div>`;

      return `
        <div class="card mb-3">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("tables")} #${table.tableNumber}</h4>
            <div class="pairing-slots">
              <div class="pairing-drop-zone" data-drop-type="slot" data-table-index="${index}" data-slot="a">${aContent}</div>
              <div class="pairing-drop-zone" data-drop-type="slot" data-table-index="${index}" data-slot="b">${bContent}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const byeContent = draft.pairing.byePlayerId
    ? renderPlayerChip(
        tournament,
        draft.pairing.byePlayerId,
        "pairing",
        "bye",
        getPlayerName,
        allowManualPairing
      )
    : `<div class="drop-empty">${t("dropPlayer")}</div>`;

  const poolContent =
    unassigned
      .map((playerId) =>
        renderPlayerChip(tournament, playerId, "pairing", "pool", getPlayerName, allowManualPairing)
      )
      .join("") || `<div class="text-muted small">${t("dropPlayer")}</div>`;

  const priorityOptions = buildPriorityOptions(priorityValue, state.language, t);

  const automaticSettings = isAutomaticMode
    ? `
      <div class="row g-2">
        <div class="col-12 col-md-3">
          <label class="form-label">${t("byeStrategy")}</label>
          <select id="auto-bye-strategy" class="form-select">
            <option value="worst" ${draft.autoOptions.byeStrategy === "worst" ? "selected" : ""}>${t(
              "byeWorst"
            )}</option>
            <option value="random" ${draft.autoOptions.byeStrategy === "random" ? "selected" : ""}>${t(
              "byeRandom"
            )}</option>
          </select>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">${t("priorityOrder")}</label>
          <select id="auto-priority-order" class="form-select">${priorityOptions}</select>
        </div>
      </div>
    `
    : "";

  const modeOptions = stageRules.allowedAutoModes
    .map((mode) => {
      const label = mode === "registration" ? t("registrationOrder") : t(mode);
      const isSelected = selectedMode === mode;
      return `<option value="${mode}" ${isSelected ? "selected" : ""}>${label}</option>`;
    })
    .join("");

  const pairingToolsPanel = pairingToolsPanelComponent.render({
    props: {
      t,
      isSwissTournament,
      allowAutoPairingTools,
      modeOptions,
      automaticSettings,
      allowManualPairing,
    },
  });

  const roundStageHeader = roundStageBannerComponent.render({
    props: {
      t,
      phase: "pairing",
      roundNumber: tournament.rounds.length + 1,
    },
  });

  return `
    ${roundStageHeader}
    <div class="card shadow-sm mt-3">
      <div class="card-body">
        <h3 class="h5 mb-3">${t("pairingViewTitle")}</h3>
        <div class="pairing-drop-zone player-bank-zone mb-3 p-3" data-drop-type="pool">
          <div class="player-chip-list">${poolContent}</div>
        </div>
        ${tables}
        ${
          byeEnabled
            ? `<div class="card mb-3">
                <div class="card-body pairing-drop-zone" data-drop-type="bye">
                  <h4 class="h6 mb-3">${t("byeSlot")}</h4>
                  ${byeContent}
                </div>
              </div>`
            : ""
        }

        ${pairingToolsPanel}
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" id="back-to-tournament" class="btn btn-outline-secondary">${t(
            "backToTournament"
          )}</button>
          <button type="button" id="start-round" class="btn btn-primary">${t("startRound")}</button>
        </div>
      </div>
    </div>
  `;
}
