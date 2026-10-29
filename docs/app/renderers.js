import { flattenRankingGroups } from "../pairing.js";
import {
  getPairingStageRules,
  normalizeRankingGroups,
  resolveAutoPairingMode,
} from "../tournament-state.js";
import { normalizeSwissSettings } from "../swiss.js";
import { rankingSnapshotCardComponent } from "./components/ranking-snapshot-card-component.js";
import { PRIORITY_ORDERS } from "./constants.js";
import { escapeHtml } from "./utils.js";
import { pairingToolsPanelComponent } from "./components/pairing-tools-panel-component.js";
import { roundHistoryCardComponent } from "./components/round-history-card-component.js";
import { roundStageBannerComponent } from "./components/round-stage-banner-component.js";
import { swissResultsTableListComponent } from "./components/swiss-results-table-list-component.js";

function getPriorityLabel(priorityOrder, language, t) {
  const labels = priorityOrder.map((value) => {
    if (value === "avoid_rematch") {
      return language === "fr" ? "éviter les rematches" : "avoid rematch";
    }
    if (value === "minimize_gap") {
      return language === "fr" ? "minimiser l'écart de rang" : "minimize ranking gap";
    }
    return language === "fr" ? "équité BYE" : "bye fairness";
  });

  const combined = labels.join(" → ");
  const map = {
    "avoid rematch → minimize ranking gap → bye fairness": "priorityAvoidRematch",
    "avoid rematch → bye fairness → minimize ranking gap": "priorityAvoidRematchByeFirst",
    "minimize ranking gap → avoid rematch → bye fairness": "priorityGapFirst",
    "minimize ranking gap → bye fairness → avoid rematch": "priorityGapByeFirst",
    "bye fairness → avoid rematch → minimize ranking gap": "priorityByeFirst",
    "bye fairness → minimize ranking gap → avoid rematch": "priorityByeGapFirst",
    "éviter les rematches → minimiser l'écart de rang → équité BYE": "priorityAvoidRematch",
    "éviter les rematches → équité BYE → minimiser l'écart de rang": "priorityAvoidRematchByeFirst",
    "minimiser l'écart de rang → éviter les rematches → équité BYE": "priorityGapFirst",
    "minimiser l'écart de rang → équité BYE → éviter les rematches": "priorityGapByeFirst",
    "équité BYE → éviter les rematches → minimiser l'écart de rang": "priorityByeFirst",
    "équité BYE → minimiser l'écart de rang → éviter les rematches": "priorityByeGapFirst",
  };

  const translatedKey = map[combined];
  if (!translatedKey) {
    return combined;
  }

  return t(translatedKey);
}

export function currentPlayerIds(tournament) {
  return tournament.players.map((player) => player.id);
}

function getPairingAssignedIds(draft) {
  const assigned = [];
  for (const table of draft.pairing.tables) {
    if (table.a) {
      assigned.push(table.a);
    }
    if (table.b) {
      assigned.push(table.b);
    }
  }
  if (draft.pairing.byePlayerId) {
    assigned.push(draft.pairing.byePlayerId);
  }
  return assigned;
}

function getPairingUnassignedIds(tournament) {
  const draft = tournament.currentRoundDraft;
  const assignedSet = new Set(getPairingAssignedIds(draft));
  return currentPlayerIds(tournament).filter((id) => !assignedSet.has(id));
}

function fallbackHueFromPlayerId(playerId) {
  const safe = `${playerId}`;
  let hash = 0;
  for (let index = 0; index < safe.length; index += 1) {
    hash = safe.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getPlayerHue(tournament, playerId) {
  const playerHue = tournament.players.find((player) => player.id === playerId)?.hue;
  if (Number.isFinite(playerHue)) {
    const normalized = Math.round(playerHue) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }
  return fallbackHueFromPlayerId(playerId);
}

function getPlayerColorStyle(hue) {
  const start = (hue + 18) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 80% 62%) 0%, hsl(${start} 80% 68%) 100%)`,
    boxShadow: `0 0.35rem 0.8rem hsl(${hue} 80% 55% / 25%)`,
  };
}

function renderPlayerChip(tournament, playerId, dragType, origin, getPlayerName, isDraggable = true) {
  const palette = getPlayerColorStyle(getPlayerHue(tournament, playerId));
  return `
    <button
      type="button"
      class="player-chip"
      draggable="${isDraggable ? "true" : "false"}"
      data-drag-type="${dragType}"
      data-player-id="${escapeHtml(playerId)}"
      data-origin="${escapeHtml(origin)}"
      style="background: ${palette.background}; box-shadow: ${palette.boxShadow};"
    >
      ${escapeHtml(getPlayerName(tournament, playerId))}
    </button>
  `;
}

export function renderAppBar({ t, language }) {
  return `
    <nav class="navbar navbar-expand-lg fairpair-appbar px-3 px-md-4 py-3 mb-4">
      <div class="container-fluid px-0">
        <div class="d-flex align-items-center justify-content-between w-100 gap-3">
          <div class="d-flex align-items-center gap-3">
            <img class="brand-logo appbar-logo" src="./fair-pair-logo.svg" alt="Fair Pair logo" />
          </div>
          <div class="d-flex align-items-center gap-2 ms-auto">
            <i class="bi bi-globe2 lang-icon" aria-hidden="true"></i>
            <div class="lang-switcher" role="group" aria-label="${t("language")}">
              <button type="button" class="lang-btn ${language === "en" ? "active" : ""}" data-lang="en">EN</button>
              <button type="button" class="lang-btn ${language === "fr" ? "active" : ""}" data-lang="fr">FR</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
}

export function renderHomeView({
  state,
  t,
  homeHeroContent = "",
  homeToolbarContent = "",
  homeEmptyStateContent = "",
}) {
  const cards = state.tournaments
    .map((tournament) => {
      const selected = tournament.id === state.selectedTournamentId;
      const footer = selected
        ? `
          <div class="card-footer border-top-0 pt-0">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-primary open-tournament" data-id="${escapeHtml(
                tournament.id
              )}">${t("openTournament")}</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-tournament" data-id="${escapeHtml(
                tournament.id
              )}">${t("deleteTournament")}</button>
            </div>
          </div>
        `
        : "";
      const tournamentTypeLabel =
        tournament.tournamentType === "swiss"
          ? t("tournamentTypeSwiss")
          : t("tournamentTypeManual");

      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 tournament-tile ${selected ? "tournament-tile-selected" : ""}">
            <button class="card-body text-start tournament-tile-select" type="button" data-id="${escapeHtml(
              tournament.id
            )}">
              <h3 class="h6 mb-2">${escapeHtml(tournament.name)}</h3>
              <p class="small text-muted mb-1">${t("playersCount")}: ${tournament.players.length}</p>
              <p class="small text-muted mb-1">${t("tournamentType")}: ${tournamentTypeLabel}</p>
              <p class="small text-muted mb-0">${t("roundsCount")}: ${tournament.rounds.length}</p>
            </button>
            ${footer}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    ${homeHeroContent}
    <section>
      ${homeToolbarContent}
      ${
        cards
          ? `<div class="row g-3">${cards}</div>`
          : homeEmptyStateContent || `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`
      }
    </section>
  `;
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

function renderRoundHistory(tournament, t, getPlayerName) {
  if (tournament.rounds.length === 0) {
    return "";
  }
  const rows = tournament.rounds
    .map((round, index) => {
      const matchesText = round.matches
        .map((match) => `${getPlayerName(tournament, match.a)} vs ${getPlayerName(tournament, match.b)}`)
        .join(" · ");
      const byeText = round.byePlayerId
        ? ` — ${t("byeSlot")}: ${getPlayerName(tournament, round.byePlayerId)}`
        : "";
      return `<li class="list-group-item">#${index + 1} — ${escapeHtml(matchesText + byeText)}</li>`;
    })
    .join("");
  return roundHistoryCardComponent.render({
    props: {
      t,
      rowsContent: rows,
    },
  });
}

function renderPairingDraft(tournament, state, t, getPlayerName) {
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

  const priorityOptions = PRIORITY_ORDERS.map(
    (order) =>
      `<option value="${order.join("|")}" ${
        order.join("|") === priorityValue ? "selected" : ""
      }>${escapeHtml(getPriorityLabel(order, state.language, t))}</option>`
  ).join("");

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

function renderSwissResultsDraft(tournament, t, getPlayerName) {
  const draft = tournament.currentRoundDraft;
  const rows = swissResultsTableListComponent.render({
    props: { draft, t, getPlayerName, tournament },
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
        <h3 class="h5 mb-3">${t("nextStepResults")}</h3>
        ${rows}
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" id="back-to-pairing" class="btn btn-outline-secondary">${t(
            "backToPairing"
          )}</button>
          <button type="button" id="finish-round" class="btn btn-primary">${t("finishRound")}</button>
        </div>
      </div>
    </div>
  `;
}

function renderRankingDraft(tournament, t, getPlayerName) {
  const draft = tournament.currentRoundDraft;
  const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
  while (normalized.length < tournament.players.length) {
    normalized.push([]);
  }

  const allRanked = new Set(flattenRankingGroups(normalized));
  const unranked = currentPlayerIds(tournament).filter((playerId) => !allRanked.has(playerId));

  const rows = normalized
    .map((group, index) => {
      const players = group
        .map((playerId) => renderPlayerChip(tournament, playerId, "ranking", `rank-${index}`, getPlayerName))
        .join("");
      return `
        <li class="list-group-item ranking-drop-zone" data-rank-index="${index}">
          <div class="d-flex gap-2 align-items-start ranking-row-content">
            <strong class="rank-label">${index + 1}.</strong>
            <div class="player-chip-list flex-grow-1 ranking-row-slot">
              ${players || `<span class="drop-empty">${t("dropPlayer")}</span>`}
            </div>
          </div>
        </li>
      `;
    })
    .join("");

  const roundStageHeader = roundStageBannerComponent.render({
    props: {
      t,
      phase: "ranking",
      roundNumber: tournament.rounds.length + 1,
    },
  });

  return `
    ${roundStageHeader}
    <div class="card shadow-sm mt-3">
      <div class="card-body">
        <h3 class="h5 mb-2">${t("rankingViewTitle")}</h3>
        <p class="text-muted">${t("rankingHelp")}</p>
        <div class="card mb-3 ranking-unassigned-drop-zone">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("rankingUnassigned")}</h4>
            <div class="player-chip-list">
              ${
                unranked
                  .map((playerId) => renderPlayerChip(tournament, playerId, "ranking", "unranked", getPlayerName))
                  .join("") || `<span class="text-muted small">${t("dropPlayer")}</span>`
              }
            </div>
          </div>
        </div>
        <ul class="list-group">${rows}</ul>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" id="back-to-pairing" class="btn btn-outline-secondary">${t(
            "backToPairing"
          )}</button>
          <button type="button" id="reset-ranking" class="btn btn-outline-warning">${t("resetRanking")}</button>
          <button type="button" id="finish-round" class="btn btn-primary">${t("finishRound")}</button>
        </div>
      </div>
    </div>
  `;
}

export function renderTournamentView({
  getCurrentTournament,
  state,
  t,
  getPlayerName,
  tournamentHeaderContent = "",
  tournamentRoundIntroContent = "",
  tournamentEmptyStateContent = "",
}) {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return tournamentEmptyStateContent || `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`;
  }

  let content = "";
  if (!tournament.currentRoundDraft) {
    content = `
      ${tournamentRoundIntroContent}
      ${rankingSnapshotCardComponent.render({ props: { tournament, t, getPlayerName } })}
      ${renderRoundHistory(tournament, t, getPlayerName)}
    `;
  } else if (tournament.currentRoundDraft.phase === "pairing") {
    content =
      tournament.tournamentType === "swiss"
        ? renderPairingDraft(tournament, state, t, getPlayerName)
        : renderPairingDraft(tournament, state, t, getPlayerName);
  } else if (tournament.currentRoundDraft.phase === "results") {
    content = renderSwissResultsDraft(tournament, t, getPlayerName);
  } else {
    content = renderRankingDraft(tournament, t, getPlayerName);
  }

  return `
    <section>
      ${tournamentHeaderContent}
      ${content}
    </section>
  `;
}

export function renderNotificationStack({ uiState, t, wrap = true }) {
  if (uiState.notifications.length === 0) {
    return "";
  }
  const items = uiState.notifications
    .map(
      (notification) => `
        <div class="alert alert-${escapeHtml(notification.variant)} alert-dismissible fade show fp-notification-shadow mb-2" role="status" aria-live="polite" data-notification-id="${escapeHtml(notification.id)}">
          ${escapeHtml(notification.message)}
          <button type="button" class="btn-close" aria-label="${t("closeNotification")}" data-notification-dismiss="${escapeHtml(notification.id)}"></button>
        </div>
      `
    )
    .join("");

  if (!wrap) {
    return items;
  }

  return `<section class="fp-notification-stack" aria-label="Notifications">${items}</section>`;
}
