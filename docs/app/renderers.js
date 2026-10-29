import { flattenRankingGroups } from "../pairing.js";
import {
  getPairingStageRules,
  normalizeRankingGroups,
  resolveAutoPairingMode,
} from "../tournament-state.js";
import { buildSwissStandingsData, normalizeSwissSettings } from "../swiss.js";
import { PRIORITY_ORDERS } from "./constants.js";
import { escapeHtml } from "./utils.js";

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

export function renderAppBar({ t, state }) {
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
              <button type="button" class="lang-btn ${state.language === "en" ? "active" : ""}" data-lang="en">EN</button>
              <button type="button" class="lang-btn ${state.language === "fr" ? "active" : ""}" data-lang="fr">FR</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
}

export function renderHomeView({ state, t }) {
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
    <section class="fp-hero mb-4">
      <div class="row align-items-center g-4">
        <div class="col-12">
          <h1 class="fp-hero-title">${t("homeHeroTitle")}</h1>
          <p class="fp-hero-copy">${t("homeHeroIntro")}</p>
          <div class="fp-hero-points">
            <div class="fp-hero-point"><i class="bi bi-check-circle-fill"></i><span>${t("homeHeroPoint1")}</span></div>
            <div class="fp-hero-point"><i class="bi bi-check-circle-fill"></i><span>${t("homeHeroPoint2")}</span></div>
            <div class="fp-hero-point"><i class="bi bi-check-circle-fill"></i><span>${t("homeHeroPoint3")}</span></div>
          </div>
        </div>
      </div>
    </section>
    <section>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="h4 mb-0">${t("homeTitle")}</h1>
        <div class="d-flex gap-2">
          <button id="add-tournament" class="btn btn-primary">+ ${t("addTournament")}</button>
          <button id="reset-all" class="btn btn-outline-danger">${t("resetAll")}</button>
        </div>
      </div>
      ${
        cards
          ? `<div class="row g-3">${cards}</div>`
          : `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`
      }
    </section>
  `;
}

export function renderSetupView({ uiState, getTournamentById, t }) {
  const isEdit = uiState.setupMode === "edit";
  const tournament = isEdit ? getTournamentById(uiState.setupTournamentId) : null;
  const name = tournament?.name || "";
  const playersText = tournament ? tournament.players.map((player) => player.name).join("\n") : "";
  const swissSettings = normalizeSwissSettings(
    tournament?.swissSettings || uiState.setupSwissConfig || undefined
  );
  const swissSettingsVisible = uiState.setupTournamentType === "swiss";

  return `
    <section>
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h4 mb-0">${isEdit ? t("setupTitleEdit") : t("setupTitleCreate")}</h1>
        <button id="cancel-setup" class="btn btn-outline-secondary">${t("cancel")}</button>
      </div>
      <div class="card shadow-sm">
        <div class="card-body">
          <form id="setup-form">
            <div class="mb-3">
              <label for="tournament-name" class="form-label">${t("tournamentName")}</label>
              <input id="tournament-name" class="form-control" value="${escapeHtml(name)}" required />
            </div>
            <div class="mb-3">
              <label class="form-label">${t("tournamentType")}</label>
              <div class="row g-3 tournament-type-cards">
                <div class="col-12 col-md-6">
                  <button
                    type="button"
                    class="card tournament-type-option ${uiState.setupTournamentType === "manual" ? "selected" : ""}"
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
                    class="card tournament-type-option ${uiState.setupTournamentType === "swiss" ? "selected" : ""}"
                    data-tournament-type="swiss"
                  >
                    <div class="card-body">
                      <h3 class="h6 mb-2">${t("tournamentTypeSwiss")}</h3>
                      <p class="mb-0 small text-muted">${t("tournamentTypeSwissDescription")}</p>
                    </div>
                  </button>
                </div>
              </div>
              <input id="tournament-type" type="hidden" value="${escapeHtml(uiState.setupTournamentType || "manual")}" />
            </div>
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
  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h6 mb-3">${t("roundHistory")}</h3>
        <ul class="list-group">${rows}</ul>
      </div>
    </div>
  `;
}

function renderRoundStageHeader(tournament, phase, t) {
  const roundNumber = tournament.rounds.length + 1;
  const stepLabel = phase === "ranking" ? t("stepRanking") : t("stepPairing");

  return `
    <div class="round-stage-banner mt-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div class="round-stage-kicker text-uppercase">${t("currentRound")}</div>
          <h2 class="round-stage-title mb-0">#${roundNumber} — ${stepLabel}</h2>
        </div>
      </div>
    </div>
  `;
}

function renderRankingSnapshot(tournament, t, getPlayerName) {
  if (tournament.tournamentType === "swiss") {
    const standings = buildSwissStandingsData(
      tournament.players,
      tournament.rounds,
      tournament.swissSettings || normalizeSwissSettings()
    );

    const rows = standings
      .map(
        (entry, index) => `
          <li class="list-group-item d-flex justify-content-between align-items-center gap-3">
            <div>
              <strong>${index + 1}.</strong> ${escapeHtml(entry.name)}
            </div>
            <div class="d-flex align-items-center gap-2 text-end">
              <span class="badge bg-primary-subtle text-primary-emphasis">${t("points") || "Points"}: ${Number(entry.score).toFixed(1)}</span>
              <small class="text-muted">Buchholz: ${Number(entry.buchholz).toFixed(1)}</small>
            </div>
          </li>
        `
      )
      .join("");

    return `
      <div class="card shadow-sm mt-4">
        <div class="card-body">
          <h3 class="h6 mb-3">${t("rankingViewTitle")}</h3>
          <ul class="list-group">${rows}</ul>
        </div>
      </div>
    `;
  }

  const rows = tournament.rankingGroups
    .filter((group) => group.length > 0)
    .map((group, index) => {
      const players = group.map((playerId) => escapeHtml(getPlayerName(tournament, playerId))).join(", ");
      return `<li class="list-group-item"><strong>${index + 1}.</strong> ${players}</li>`;
    })
    .join("");

  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h6 mb-3">${t("rankingViewTitle")}</h3>
        <ul class="list-group">${rows}</ul>
      </div>
    </div>
  `;
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

  const pairingToolsPanel = allowAutoPairingTools
    ? `
        <div class="card mt-4 auto-pairing-panel">
          <div class="card-body">
            <h4 class="h6 mb-3">${isSwissTournament ? t("swissPairing") : t("automaticPairing")}</h4>
            <div class="row g-2">
              <div class="col-12 col-md-3">
                <label class="form-label">${t("mode")}</label>
                <select id="auto-mode" class="form-select">
                  ${modeOptions}
                </select>
              </div>
            </div>
            ${automaticSettings}
            <div class="d-flex gap-2 mt-3">
              <button type="button" id="try-auto-pairing" class="btn btn-outline-primary">${t(
                "tryAutoPairing"
              )}</button>
              ${
                allowManualPairing
                  ? `<button type="button" id="clear-pairing" class="btn btn-outline-secondary">${t(
                      "clearPairing"
                    )}</button>`
                  : ""
              }
            </div>
          </div>
        </div>
      `
    : `
        <div class="alert alert-info mt-4 mb-0">${t("swissPairingLocked")}</div>
      `;

  return `
    ${renderRoundStageHeader(tournament, "pairing", t)}
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
  const tableResults = draft.results || [];

  const rows = draft.pairing.tables
    .map((table, index) => {
      if (!table.a || !table.b) {
        return "";
      }

      const currentResult = tableResults[index] || { winner: "" };
      const buttonA = currentResult.winner === "a" ? "selected" : "";
      const buttonB = currentResult.winner === "b" ? "selected" : "";
      const buttonDraw = currentResult.winner === "draw" ? "selected" : "";
      const playerAName = escapeHtml(getPlayerName(tournament, table.a));
      const playerBName = escapeHtml(getPlayerName(tournament, table.b));
      const playerAResultLabel = `${playerAName} ${t("resultWinA")}`;
      const playerBResultLabel = `${playerBName} ${t("resultWinB")}`;

      return `
        <div class="card mb-3">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("tables")} #${table.tableNumber}</h4>
            <div class="d-flex flex-column flex-md-row gap-2">
              <div class="fw-semibold">${playerAName}</div>
              <div class="fw-semibold">vs</div>
              <div class="fw-semibold">${playerBName}</div>
            </div>
            <div class="mt-3">
              <select class="form-select swiss-result-select" data-result-index="${index}">
                <option value="">${t("resultSelect")}</option>
                <option value="a" ${buttonA ? "selected" : ""}>${playerAResultLabel}</option>
                <option value="b" ${buttonB ? "selected" : ""}>${playerBResultLabel}</option>
                <option value="draw" ${buttonDraw ? "selected" : ""}>${t("resultDraw")}</option>
              </select>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    ${renderRoundStageHeader(tournament, "pairing", t)}
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

  return `
    ${renderRoundStageHeader(tournament, "ranking", t)}
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

export function renderTournamentView({ getCurrentTournament, state, t, getPlayerName }) {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`;
  }

  const topActions = `
    <div class="d-flex gap-2">
      <button id="back-home" class="btn btn-outline-secondary">${t("backToHome")}</button>
    </div>
  `;

  let content = "";
  if (!tournament.currentRoundDraft) {
    content = `
      <div class="card shadow-sm mt-4">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h3 class="h5 mb-1">${escapeHtml(tournament.name)}</h3>
            <p class="text-muted mb-0">${t("roundsCount")}: ${tournament.rounds.length}</p>
          </div>
          <button id="prepare-round" class="btn btn-primary">${t("prepareRound")}</button>
        </div>
      </div>
      ${renderRankingSnapshot(tournament, t, getPlayerName)}
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
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h1 class="h4 mb-0">${escapeHtml(tournament.name)}</h1>
        ${topActions}
      </div>
      ${content}
    </section>
  `;
}

export function renderNotificationStack({ uiState, t }) {
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

  return `<section class="fp-notification-stack" aria-label="Notifications">${items}</section>`;
}
