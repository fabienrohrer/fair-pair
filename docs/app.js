import {
  createEmptyPairingSlots,
  flattenRankingGroups,
  generatePairingProposal,
  isValidPairingAssignment,
} from "./pairing.js";
import {
  STORAGE_KEY,
  applyTournamentEdits,
  createInitialState,
  createRoundDraft,
  createTournamentFromForm,
  migrateLoadedState,
  needsRoundReset,
  normalizeRankingGroups,
  removeTournamentFromCollection,
  selectDefaultTournamentId,
} from "./tournament-state.js";

const PRIORITY_ORDERS = [
  ["avoid_rematch", "minimize_gap", "bye_fairness"],
  ["avoid_rematch", "bye_fairness", "minimize_gap"],
  ["minimize_gap", "avoid_rematch", "bye_fairness"],
  ["minimize_gap", "bye_fairness", "avoid_rematch"],
  ["bye_fairness", "avoid_rematch", "minimize_gap"],
  ["bye_fairness", "minimize_gap", "avoid_rematch"],
];

const messages = {
  en: {
    appTitle: "Fair Pair",
    language: "Language",
    homeTitle: "Tournaments",
    noTournamentsYet: "No tournaments yet.",
    addTournament: "Add tournament",
    resetAll: "Reset all tournaments",
    editTournament: "Modify",
    deleteTournament: "Delete",
    openTournament: "Open",
    tournamentName: "Tournament name",
    players: "Players (one per line)",
    setupTitleCreate: "Create tournament",
    setupTitleEdit: "Edit tournament setup",
    createTournament: "Create tournament",
    updateTournament: "Update tournament",
    cancel: "Cancel",
    playersCount: "Players",
    roundsCount: "Rounds",
    backToHome: "Back to home",
    setupRequired: "Please enter a tournament name and at least 2 players.",
    duplicatesPlayers: "Player names must be unique (case-insensitive).",
    prepareRound: "Prepare next round",
    pairingViewTitle: "Round pairing",
    rankingViewTitle: "Round ranking",
    playerPool: "Player pool",
    tables: "Tables",
    byeSlot: "BYE",
    dropPlayer: "Drop player",
    automaticPairing: "Automatic pairing",
    mode: "Mode",
    random: "Random",
    automatic: "Automatic",
    byeStrategy: "BYE strategy",
    byeWorst: "Lowest-ranked eligible",
    byeRandom: "Random eligible",
    priorityOrder: "Priority order",
    tryAutoPairing: "Try",
    clearPairing: "Clear slots",
    startRound: "Start round",
    rankingHelp:
      "Set the global ranking by drag-and-drop. Players on the same row are tied (draw).",
    finishRound: "Save round",
    rankingUnassigned: "Unassigned ranking",
    roundHistory: "Round history",
    confirmDeleteTournament: "Delete this tournament permanently?",
    confirmResetAll: "Reset all tournaments? This action cannot be undone.",
    confirmSetupChange:
      "Changing players will remove all rounds and current draft for this tournament. Continue?",
    invalidPairing: "Please assign every player exactly once before starting the round.",
    invalidRanking: "Please rank every player exactly once before saving the round.",
    roundSaved: "Round saved.",
    manageSetup: "Edit setup",
  },
  fr: {
    appTitle: "Fair Pair",
    language: "Langue",
    homeTitle: "Tournois",
    noTournamentsYet: "Aucun tournoi pour le moment.",
    addTournament: "Ajouter un tournoi",
    resetAll: "Réinitialiser tous les tournois",
    editTournament: "Modifier",
    deleteTournament: "Supprimer",
    openTournament: "Ouvrir",
    tournamentName: "Nom du tournoi",
    players: "Joueurs (un par ligne)",
    setupTitleCreate: "Créer un tournoi",
    setupTitleEdit: "Modifier le setup du tournoi",
    createTournament: "Créer le tournoi",
    updateTournament: "Mettre à jour le tournoi",
    cancel: "Annuler",
    playersCount: "Joueurs",
    roundsCount: "Rounds",
    backToHome: "Retour à l'accueil",
    setupRequired: "Veuillez saisir un nom de tournoi et au moins 2 joueurs.",
    duplicatesPlayers: "Les noms de joueurs doivent être uniques (insensible à la casse).",
    prepareRound: "Préparer le prochain round",
    pairingViewTitle: "Appariement du round",
    rankingViewTitle: "Classement du round",
    playerPool: "Joueurs à placer",
    tables: "Tables",
    byeSlot: "BYE",
    dropPlayer: "Déposer un joueur",
    automaticPairing: "Appariement automatique",
    mode: "Mode",
    random: "Aléatoire",
    automatic: "Automatique",
    byeStrategy: "Stratégie BYE",
    byeWorst: "Dernier joueur éligible",
    byeRandom: "Joueur éligible aléatoire",
    priorityOrder: "Ordre des priorités",
    tryAutoPairing: "Essayer",
    clearPairing: "Vider les slots",
    startRound: "Démarrer le round",
    rankingHelp:
      "Définissez le classement global en glisser-déposer. Les joueurs sur la même ligne sont ex aequo.",
    finishRound: "Enregistrer le round",
    rankingUnassigned: "Joueurs non classés",
    roundHistory: "Historique des rounds",
    confirmDeleteTournament: "Supprimer définitivement ce tournoi ?",
    confirmResetAll: "Réinitialiser tous les tournois ? Cette action est irréversible.",
    confirmSetupChange:
      "Modifier les joueurs supprimera tous les rounds et le round en cours. Continuer ?",
    invalidPairing: "Assignez chaque joueur une seule fois avant de démarrer le round.",
    invalidRanking: "Classez chaque joueur une seule fois avant d'enregistrer le round.",
    roundSaved: "Round enregistré.",
    manageSetup: "Modifier le setup",
  },
};

const uiState = {
  view: "home",
  setupMode: "create",
  setupTournamentId: null,
  setupReturnView: "home",
  selectedTournamentId: null,
};

function detectDefaultLanguage() {
  const browserLanguage = navigator.language?.toLowerCase() || "en";
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

function parsePlayersFromText(text) {
  return text
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

function createTournamentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeHtml(value) {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  const defaultLanguage = detectDefaultLanguage();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState(defaultLanguage);
  }
  try {
    return migrateLoadedState(JSON.parse(raw), defaultLanguage);
  } catch {
    return createInitialState(defaultLanguage);
  }
}

const state = loadState();
const root = document.getElementById("app");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function t(key) {
  return messages[state.language][key];
}

function getTournamentById(tournamentId) {
  return state.tournaments.find((item) => item.id === tournamentId) || null;
}

function getCurrentTournament() {
  return getTournamentById(state.selectedTournamentId);
}

function getPlayerName(tournament, playerId) {
  return tournament.players.find((player) => player.id === playerId)?.name || playerId;
}

function selectTournament(tournamentId) {
  const selectedId = selectDefaultTournamentId(state.tournaments, tournamentId);
  uiState.selectedTournamentId = selectedId;
  state.selectedTournamentId = selectedId;
}

function openHomeView() {
  uiState.view = "home";
}

function openSetupView(mode, tournamentId = null, returnView = "home") {
  uiState.view = "setup";
  uiState.setupMode = mode;
  uiState.setupTournamentId = tournamentId;
  uiState.setupReturnView = returnView;
}

function openTournamentView(tournamentId) {
  selectTournament(tournamentId);
  uiState.view = "tournament";
}

function getPriorityLabel(priorityOrder) {
  return priorityOrder
    .map((value) => {
      if (value === "avoid_rematch") {
        return "avoid rematch";
      }
      if (value === "minimize_gap") {
        return "minimize ranking gap";
      }
      return "bye fairness";
    })
    .join(" → ");
}

function currentPlayerIds(tournament) {
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

function removePlayerFromPairing(draft, playerId) {
  for (const table of draft.pairing.tables) {
    if (table.a === playerId) {
      table.a = null;
    }
    if (table.b === playerId) {
      table.b = null;
    }
  }
  if (draft.pairing.byePlayerId === playerId) {
    draft.pairing.byePlayerId = null;
  }
}

function assignPlayerToPairingTarget(draft, playerId, target) {
  removePlayerFromPairing(draft, playerId);
  if (target.type === "pool") {
    return;
  }
  if (target.type === "bye") {
    if (draft.pairing.byePlayerId) {
      removePlayerFromPairing(draft, draft.pairing.byePlayerId);
    }
    draft.pairing.byePlayerId = playerId;
    return;
  }
  const table = draft.pairing.tables[target.tableIndex];
  if (!table) {
    return;
  }
  const slotKey = target.slot;
  if (table[slotKey]) {
    removePlayerFromPairing(draft, table[slotKey]);
  }
  table[slotKey] = playerId;
}

function normalizeDraftRanking(tournament) {
  const draft = tournament.currentRoundDraft;
  const ids = currentPlayerIds(tournament);
  draft.rankingGroups = normalizeRankingGroups(draft.rankingGroups, ids);
  while (draft.rankingGroups.length < ids.length) {
    draft.rankingGroups.push([]);
  }
}

function removePlayerFromRankingDraft(draft, playerId) {
  for (const group of draft.rankingGroups) {
    const index = group.indexOf(playerId);
    if (index !== -1) {
      group.splice(index, 1);
    }
  }
}

function assignPlayerToRankingGroup(draft, playerId, targetRankIndex) {
  removePlayerFromRankingDraft(draft, playerId);
  if (targetRankIndex < 0 || targetRankIndex >= draft.rankingGroups.length) {
    return;
  }
  draft.rankingGroups[targetRankIndex].push(playerId);
}

function renderAppBar() {
  return `
    <nav class="navbar navbar-expand-lg fairpair-appbar px-3 py-2 mb-4 rounded-3">
      <div class="container-fluid px-0">
        <span class="navbar-brand mb-0 fw-semibold">${t("appTitle")}</span>
        <div class="d-flex align-items-center gap-2 ms-auto">
          <span class="lang-icon" aria-hidden="true">🌐</span>
          <div class="lang-switcher" role="group" aria-label="${t("language")}">
            <button type="button" class="lang-btn ${state.language === "en" ? "active" : ""}" data-lang="en">EN</button>
            <button type="button" class="lang-btn ${state.language === "fr" ? "active" : ""}" data-lang="fr">FR</button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function renderPlayerChip(tournament, playerId, dragType, origin = "") {
  return `
    <button
      type="button"
      class="player-chip"
      draggable="true"
      data-drag-type="${dragType}"
      data-player-id="${escapeHtml(playerId)}"
      data-origin="${escapeHtml(origin)}"
    >
      ${escapeHtml(getPlayerName(tournament, playerId))}
    </button>
  `;
}

function renderHomeView() {
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
              <button type="button" class="btn btn-sm btn-outline-secondary edit-tournament" data-id="${escapeHtml(
                tournament.id
              )}">${t("editTournament")}</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-tournament" data-id="${escapeHtml(
                tournament.id
              )}">${t("deleteTournament")}</button>
            </div>
          </div>
        `
        : "";
      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 tournament-tile ${selected ? "tournament-tile-selected" : ""}">
            <button class="card-body text-start tournament-tile-select" type="button" data-id="${escapeHtml(
              tournament.id
            )}">
              <h3 class="h6 mb-2">${escapeHtml(tournament.name)}</h3>
              <p class="small text-muted mb-1">${t("playersCount")}: ${tournament.players.length}</p>
              <p class="small text-muted mb-0">${t("roundsCount")}: ${tournament.rounds.length}</p>
            </button>
            ${footer}
          </div>
        </div>
      `;
    })
    .join("");

  return `
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

function renderSetupView() {
  const isEdit = uiState.setupMode === "edit";
  const tournament = isEdit ? getTournamentById(uiState.setupTournamentId) : null;
  const name = tournament?.name || "";
  const playersText = tournament ? tournament.players.map((player) => player.name).join("\n") : "";
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

function renderRoundHistory(tournament) {
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

function renderRankingSnapshot(tournament) {
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

function renderPairingDraft(tournament) {
  const draft = tournament.currentRoundDraft;
  const unassigned = getPairingUnassignedIds(tournament);
  const byeEnabled = tournament.players.length % 2 === 1;
  const priorityValue = draft.autoOptions.priorityOrder.join("|");

  const tables = draft.pairing.tables
    .map((table, index) => {
      const aContent = table.a
        ? renderPlayerChip(tournament, table.a, "pairing", `table-${index}-a`)
        : `<div class="drop-empty">${t("dropPlayer")}</div>`;
      const bContent = table.b
        ? renderPlayerChip(tournament, table.b, "pairing", `table-${index}-b`)
        : `<div class="drop-empty">${t("dropPlayer")}</div>`;

      return `
        <div class="card mb-3">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("tables")} ${table.tableNumber}</h4>
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
    ? renderPlayerChip(tournament, draft.pairing.byePlayerId, "pairing", "bye")
    : `<div class="drop-empty">${t("dropPlayer")}</div>`;

  const poolContent =
    unassigned.map((playerId) => renderPlayerChip(tournament, playerId, "pairing", "pool")).join("") ||
    `<div class="text-muted small">${t("dropPlayer")}</div>`;

  const priorityOptions = PRIORITY_ORDERS.map(
    (order) =>
      `<option value="${order.join("|")}" ${
        order.join("|") === priorityValue ? "selected" : ""
      }>${escapeHtml(getPriorityLabel(order))}</option>`
  ).join("");

  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h5 mb-3">${t("pairingViewTitle")}</h3>
        <div class="card mb-3">
          <div class="card-body pairing-drop-zone" data-drop-type="pool">
            <h4 class="h6 mb-3">${t("playerPool")}</h4>
            <div class="player-chip-list">${poolContent}</div>
          </div>
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

        <div class="card mt-4 auto-pairing-panel">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("automaticPairing")}</h4>
            <div class="row g-2">
              <div class="col-12 col-md-3">
                <label class="form-label">${t("mode")}</label>
                <select id="auto-mode" class="form-select">
                  <option value="automatic" ${draft.autoOptions.mode === "automatic" ? "selected" : ""}>${t(
                    "automatic"
                  )}</option>
                  <option value="random" ${draft.autoOptions.mode === "random" ? "selected" : ""}>${t(
                    "random"
                  )}</option>
                </select>
              </div>
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
            <div class="d-flex gap-2 mt-3">
              <button type="button" id="try-auto-pairing" class="btn btn-outline-primary">${t(
                "tryAutoPairing"
              )}</button>
              <button type="button" id="clear-pairing" class="btn btn-outline-secondary">${t(
                "clearPairing"
              )}</button>
            </div>
          </div>
        </div>
        <button type="button" id="start-round" class="btn btn-primary mt-3">${t("startRound")}</button>
      </div>
    </div>
  `;
}

function renderRankingDraft(tournament) {
  const draft = tournament.currentRoundDraft;
  const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
  while (normalized.length < tournament.players.length) {
    normalized.push([]);
  }
  draft.rankingGroups = normalized;

  const allRanked = new Set(flattenRankingGroups(draft.rankingGroups));
  const unranked = currentPlayerIds(tournament).filter((playerId) => !allRanked.has(playerId));

  const rows = draft.rankingGroups
    .map((group, index) => {
      const players = group
        .map((playerId) => renderPlayerChip(tournament, playerId, "ranking", `rank-${index}`))
        .join("");
      return `
        <li class="list-group-item ranking-drop-zone" data-rank-index="${index}">
          <div class="d-flex gap-2 align-items-start">
            <strong class="rank-label">${index + 1}.</strong>
            <div class="player-chip-list flex-grow-1">${players || `<span class="drop-empty">${t("dropPlayer")}</span>`}</div>
          </div>
        </li>
      `;
    })
    .join("");

  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h5 mb-2">${t("rankingViewTitle")}</h3>
        <p class="text-muted">${t("rankingHelp")}</p>
        <div class="card mb-3 ranking-unassigned-drop-zone">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("rankingUnassigned")}</h4>
            <div class="player-chip-list">
              ${
                unranked.map((playerId) => renderPlayerChip(tournament, playerId, "ranking", "unranked")).join("") ||
                `<span class="text-muted small">${t("dropPlayer")}</span>`
              }
            </div>
          </div>
        </div>
        <ul class="list-group">${rows}</ul>
        <button type="button" id="finish-round" class="btn btn-primary mt-3">${t("finishRound")}</button>
      </div>
    </div>
  `;
}

function renderTournamentView() {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`;
  }

  const topActions = `
    <div class="d-flex gap-2">
      <button id="back-home" class="btn btn-outline-secondary">${t("backToHome")}</button>
      <button id="edit-setup" class="btn btn-outline-secondary">${t("manageSetup")}</button>
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
      ${renderRankingSnapshot(tournament)}
      ${renderRoundHistory(tournament)}
    `;
  } else if (tournament.currentRoundDraft.phase === "pairing") {
    content = renderPairingDraft(tournament);
  } else {
    content = renderRankingDraft(tournament);
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

function attachGlobalListeners() {
  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.lang === "fr" ? "fr" : "en";
      if (state.language === next) {
        return;
      }
      state.language = next;
      saveState();
      render();
    });
  });
}

function attachHomeListeners() {
  document.getElementById("add-tournament")?.addEventListener("click", () => {
    openSetupView("create");
    render();
  });
  document.getElementById("reset-all")?.addEventListener("click", () => {
    if (!window.confirm(t("confirmResetAll"))) {
      return;
    }
    state.tournaments = [];
    selectTournament(null);
    openHomeView();
    saveState();
    render();
  });

  document.querySelectorAll(".tournament-tile-select").forEach((button) => {
    button.addEventListener("click", () => {
      selectTournament(button.dataset.id);
      saveState();
      render();
    });
  });

  document.querySelectorAll(".open-tournament").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openTournamentView(button.dataset.id);
      saveState();
      render();
    });
  });

  document.querySelectorAll(".edit-tournament").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openSetupView("edit", button.dataset.id, "home");
      render();
    });
  });

  document.querySelectorAll(".delete-tournament").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!window.confirm(t("confirmDeleteTournament"))) {
        return;
      }
      const updated = removeTournamentFromCollection(
        state.tournaments,
        button.dataset.id,
        state.selectedTournamentId
      );
      state.tournaments = updated.tournaments;
      selectTournament(updated.selectedTournamentId);
      saveState();
      render();
    });
  });
}

function attachSetupListeners() {
  document.getElementById("cancel-setup")?.addEventListener("click", () => {
    if (uiState.setupReturnView === "tournament" && state.selectedTournamentId) {
      uiState.view = "tournament";
    } else {
      openHomeView();
    }
    render();
  });

  document.getElementById("setup-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("tournament-name").value.trim();
    const playerNames = parsePlayersFromText(document.getElementById("players-input").value);

    if (!name || playerNames.length < 2) {
      window.alert(t("setupRequired"));
      return;
    }
    const duplicateCheck = new Set(playerNames.map((value) => value.toLowerCase()));
    if (duplicateCheck.size !== playerNames.length) {
      window.alert(t("duplicatesPlayers"));
      return;
    }

    if (uiState.setupMode === "edit") {
      const current = getTournamentById(uiState.setupTournamentId);
      if (!current) {
        openHomeView();
        render();
        return;
      }
      const resetRounds = needsRoundReset(current, { name, playerNames });
      if (resetRounds && (current.rounds.length > 0 || current.currentRoundDraft)) {
        if (!window.confirm(t("confirmSetupChange"))) {
          return;
        }
      }
      const updated = applyTournamentEdits(current, { name, playerNames }, { resetRounds });
      state.tournaments = state.tournaments.map((item) => (item.id === updated.id ? updated : item));
      selectTournament(updated.id);
      if (uiState.setupReturnView === "tournament") {
        uiState.view = "tournament";
      } else {
        openHomeView();
      }
    } else {
      const created = createTournamentFromForm({
        id: createTournamentId(),
        name,
        playerNames,
      });
      state.tournaments.push(created);
      openTournamentView(created.id);
    }
    saveState();
    render();
  });
}

function attachPairingDnD(tournament) {
  const draft = tournament.currentRoundDraft;
  document.querySelectorAll('[draggable="true"][data-drag-type="pairing"]').forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", chip.dataset.playerId);
      event.dataTransfer.setData("application/x-fairpair-drag-type", "pairing");
    });
  });

  document.querySelectorAll(".pairing-drop-zone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      if (event.dataTransfer.getData("application/x-fairpair-drag-type") !== "pairing") {
        return;
      }
      const playerId = event.dataTransfer.getData("text/plain");
      if (!playerId) {
        return;
      }
      const type = zone.dataset.dropType;
      if (type === "pool") {
        assignPlayerToPairingTarget(draft, playerId, { type: "pool" });
      } else if (type === "bye") {
        assignPlayerToPairingTarget(draft, playerId, { type: "bye" });
      } else {
        assignPlayerToPairingTarget(draft, playerId, {
          type: "slot",
          tableIndex: Number(zone.dataset.tableIndex),
          slot: zone.dataset.slot,
        });
      }
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });
  });
}

function attachRankingDnD(tournament) {
  const draft = tournament.currentRoundDraft;
  document.querySelectorAll('[draggable="true"][data-drag-type="ranking"]').forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", chip.dataset.playerId);
      event.dataTransfer.setData("application/x-fairpair-drag-type", "ranking");
    });
  });

  document.querySelectorAll(".ranking-drop-zone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      if (event.dataTransfer.getData("application/x-fairpair-drag-type") !== "ranking") {
        return;
      }
      const playerId = event.dataTransfer.getData("text/plain");
      assignPlayerToRankingGroup(draft, playerId, Number(zone.dataset.rankIndex));
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });
  });

  document.querySelector(".ranking-unassigned-drop-zone")?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  document.querySelector(".ranking-unassigned-drop-zone")?.addEventListener("drop", (event) => {
    event.preventDefault();
    if (event.dataTransfer.getData("application/x-fairpair-drag-type") !== "ranking") {
      return;
    }
    const playerId = event.dataTransfer.getData("text/plain");
    removePlayerFromRankingDraft(draft, playerId);
    tournament.updatedAt = Date.now();
    saveState();
    render();
  });
}

function attachTournamentListeners() {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return;
  }

  document.getElementById("back-home")?.addEventListener("click", () => {
    openHomeView();
    render();
  });

  document.getElementById("edit-setup")?.addEventListener("click", () => {
    openSetupView("edit", tournament.id, "tournament");
    render();
  });

  document.getElementById("prepare-round")?.addEventListener("click", () => {
    tournament.currentRoundDraft = createRoundDraft(currentPlayerIds(tournament));
    tournament.updatedAt = Date.now();
    saveState();
    render();
  });

  if (tournament.currentRoundDraft?.phase === "pairing") {
    attachPairingDnD(tournament);

    document.getElementById("try-auto-pairing")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      draft.autoOptions.mode = document.getElementById("auto-mode").value;
      draft.autoOptions.byeStrategy = document.getElementById("auto-bye-strategy").value;
      draft.autoOptions.priorityOrder = document
        .getElementById("auto-priority-order")
        .value.split("|");

      const proposal = generatePairingProposal({
        players: tournament.players,
        rounds: tournament.rounds,
        rankingGroups: tournament.rankingGroups,
        mode: draft.autoOptions.mode,
        byeStrategy: draft.autoOptions.byeStrategy,
        priorityOrder: draft.autoOptions.priorityOrder,
        randomSeed: tournament.rounds.length + 1,
      });

      const freshSlots = createEmptyPairingSlots(tournament.players.length);
      proposal.matches.forEach((match, index) => {
        freshSlots[index].a = match.a;
        freshSlots[index].b = match.b;
      });
      draft.pairing.tables = freshSlots;
      draft.pairing.byePlayerId = proposal.byePlayerId;
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });

    document.getElementById("clear-pairing")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      draft.pairing.tables = createEmptyPairingSlots(tournament.players.length);
      draft.pairing.byePlayerId = null;
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });

    document.getElementById("start-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const valid = isValidPairingAssignment({
        playerIds: currentPlayerIds(tournament),
        tables: draft.pairing.tables,
        byePlayerId: draft.pairing.byePlayerId,
      });
      if (!valid) {
        window.alert(t("invalidPairing"));
        return;
      }
      draft.phase = "ranking";
      normalizeDraftRanking(tournament);
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });
  }

  if (tournament.currentRoundDraft?.phase === "ranking") {
    attachRankingDnD(tournament);
    document.getElementById("finish-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
      const flattened = flattenRankingGroups(normalized);
      if (flattened.length !== tournament.players.length) {
        window.alert(t("invalidRanking"));
        return;
      }
      tournament.rounds.push({
        byePlayerId: draft.pairing.byePlayerId || null,
        matches: draft.pairing.tables.map((table) => ({ a: table.a, b: table.b })),
        rankingGroups: normalized,
      });
      tournament.rankingGroups = normalized;
      tournament.currentRoundDraft = null;
      tournament.updatedAt = Date.now();
      saveState();
      render();
      window.alert(t("roundSaved"));
    });
  }
}

function render() {
  let viewContent = "";
  if (uiState.view === "setup") {
    viewContent = renderSetupView();
  } else if (uiState.view === "tournament") {
    viewContent = renderTournamentView();
  } else {
    viewContent = renderHomeView();
  }

  root.innerHTML = `
    ${renderAppBar()}
    ${viewContent}
  `;

  attachGlobalListeners();
  if (uiState.view === "setup") {
    attachSetupListeners();
  } else if (uiState.view === "tournament") {
    attachTournamentListeners();
  } else {
    attachHomeListeners();
  }
}

selectTournament(state.selectedTournamentId);
saveState();
render();
