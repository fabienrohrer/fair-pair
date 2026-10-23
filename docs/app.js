import { allResultsEntered, generateRoundPairings, getStandings } from "./pairing.js";
import {
  STORAGE_KEY,
  applyTournamentEdits,
  createInitialState,
  createTournamentFromForm,
  migrateLoadedState,
  needsRoundReset,
  removeTournamentFromCollection,
  selectDefaultTournamentId,
} from "./tournament-state.js";

const messages = {
  en: {
    appTitle: "Fair Pair",
    language: "Language",
    homeTitle: "Tournaments",
    noTournamentsYet: "No tournaments yet.",
    addTournament: "Add tournament",
    resetAll: "Reset all tournaments",
    selectedTournament: "Selected tournament",
    editTournament: "Edit",
    deleteTournament: "Delete",
    backToHome: "Back to home",
    configureTournament: "Edit setup",
    tournamentName: "Tournament name",
    setupTitleCreate: "Create tournament",
    setupTitleEdit: "Edit tournament setup",
    createTournament: "Create tournament",
    updateTournament: "Update tournament",
    cancel: "Cancel",
    pairingMode: "Default pairing mode",
    modeAutomatic: "Automatic (smart)",
    modeRandom: "Random",
    modeManual: "Manual (adjacent after ranking order)",
    byeStrategy: "BYE strategy",
    byeLowest: "Lowest-ranked eligible player",
    byeRandom: "Random eligible player",
    players: "Players (one per line)",
    standings: "Standings",
    rankingEditor: "Ranking order for next round",
    dragHint: "Drag players to adjust the ranking order used for pairings.",
    manualByeLabel: "Manual BYE override",
    none: "None",
    generateRound: "Generate next round",
    generatedRound: "Current round",
    roundHistory: "Round history",
    editRound: "Edit results",
    byeLabel: "BYE",
    player: "Player",
    points: "Points",
    wins: "W",
    draws: "D",
    losses: "L",
    byes: "BYE",
    played: "Played",
    rank: "Rank",
    table: "Table",
    result: "Result",
    resultPending: "Pending",
    resultA: "Player A wins",
    resultB: "Player B wins",
    resultDraw: "Draw",
    saveResults: "Save results",
    roundsCount: "Rounds",
    playersCount: "Players",
    setupRequired: "Please enter a tournament name and at least 2 players.",
    duplicatesPlayers: "Player names must be unique (case-insensitive).",
    roundSaved: "Round saved.",
    noTournamentSelected: "Select a tournament from the home screen.",
    confirmDeleteTournament: "Delete this tournament permanently?",
    confirmResetAll: "Reset all tournaments? This action cannot be undone.",
    confirmRegenerateAfterEdit:
      "Updating this round will remove all following rounds. Continue?",
    confirmSetupChange:
      "Changing settings or players will remove all rounds for this tournament. Continue?",
  },
  fr: {
    appTitle: "Fair Pair",
    language: "Langue",
    homeTitle: "Tournois",
    noTournamentsYet: "Aucun tournoi pour le moment.",
    addTournament: "Ajouter un tournoi",
    resetAll: "Réinitialiser tous les tournois",
    selectedTournament: "Tournoi sélectionné",
    editTournament: "Modifier",
    deleteTournament: "Supprimer",
    backToHome: "Retour à l'accueil",
    configureTournament: "Modifier la configuration",
    tournamentName: "Nom du tournoi",
    setupTitleCreate: "Créer un tournoi",
    setupTitleEdit: "Modifier la configuration du tournoi",
    createTournament: "Créer le tournoi",
    updateTournament: "Mettre à jour le tournoi",
    cancel: "Annuler",
    pairingMode: "Mode d'appariement par défaut",
    modeAutomatic: "Automatique (intelligent)",
    modeRandom: "Aléatoire",
    modeManual: "Manuel (adjacent selon le classement)",
    byeStrategy: "Stratégie BYE",
    byeLowest: "Joueur éligible le plus bas classé",
    byeRandom: "Joueur éligible aléatoire",
    players: "Joueurs (un par ligne)",
    standings: "Classement",
    rankingEditor: "Ordre de classement pour le prochain round",
    dragHint: "Glissez les joueurs pour ajuster l'ordre utilisé pour les appariements.",
    manualByeLabel: "BYE manuel",
    none: "Aucun",
    generateRound: "Générer le round suivant",
    generatedRound: "Round en cours",
    roundHistory: "Historique des rounds",
    editRound: "Modifier les résultats",
    byeLabel: "BYE",
    player: "Joueur",
    points: "Points",
    wins: "V",
    draws: "N",
    losses: "D",
    byes: "BYE",
    played: "Joués",
    rank: "Rang",
    table: "Table",
    result: "Résultat",
    resultPending: "En attente",
    resultA: "Victoire joueur A",
    resultB: "Victoire joueur B",
    resultDraw: "Nul",
    saveResults: "Enregistrer les résultats",
    roundsCount: "Rounds",
    playersCount: "Joueurs",
    setupRequired: "Veuillez saisir un nom de tournoi et au moins 2 joueurs.",
    duplicatesPlayers: "Les noms de joueurs doivent être uniques (insensible à la casse).",
    roundSaved: "Round enregistré.",
    noTournamentSelected: "Sélectionnez un tournoi depuis la page d'accueil.",
    confirmDeleteTournament: "Supprimer définitivement ce tournoi ?",
    confirmResetAll: "Réinitialiser tous les tournois ? Cette action est irréversible.",
    confirmRegenerateAfterEdit:
      "La modification de ce round supprimera les rounds suivants. Continuer ?",
    confirmSetupChange:
      "Modifier les paramètres ou joueurs supprimera tous les rounds de ce tournoi. Continuer ?",
  },
};

const uiState = {
  currentView: "home",
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

function parseSetupFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const players = params.getAll("player").map((name) => name.trim()).filter(Boolean);
  const bye = params.get("bye");
  const mode = params.get("mode");
  return {
    players,
    byeStrategy: bye === "random" ? "random" : "lowest",
    pairingMode:
      mode === "manual" || mode === "random" || mode === "automatic" ? mode : "automatic",
  };
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
    const parsed = JSON.parse(raw);
    return migrateLoadedState(parsed, defaultLanguage);
  } catch {
    return createInitialState(defaultLanguage);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();
const root = document.getElementById("app");

uiState.selectedTournamentId = selectDefaultTournamentId(
  state.tournaments,
  state.selectedTournamentId
);
state.selectedTournamentId = uiState.selectedTournamentId;

function t(key) {
  return messages[state.language][key];
}

function getTournamentById(tournamentId) {
  return state.tournaments.find((item) => item.id === tournamentId) || null;
}

function getCurrentTournament() {
  return getTournamentById(state.selectedTournamentId);
}

function selectTournament(tournamentId) {
  const nextId = selectDefaultTournamentId(state.tournaments, tournamentId);
  uiState.selectedTournamentId = nextId;
  state.selectedTournamentId = nextId;
}

function updateTournament(updatedTournament) {
  state.tournaments = state.tournaments.map((item) =>
    item.id === updatedTournament.id ? updatedTournament : item
  );
}

function getPlayerName(tournament, playerId) {
  return tournament.players.find((player) => player.id === playerId)?.name || playerId;
}

function getCurrentEditableRound(tournament) {
  if (!tournament || tournament.rounds.length === 0) {
    return null;
  }
  if (tournament.editRoundIndex === null) {
    return tournament.rounds[tournament.rounds.length - 1];
  }
  return tournament.rounds[tournament.editRoundIndex] || null;
}

function updateRankingFromStandings(tournament) {
  const standings = getStandings(tournament.players, tournament.rounds);
  const ordered = standings.map((entry) => entry.id);
  const known = new Set(ordered);
  for (const id of tournament.rankingOrder) {
    if (!known.has(id)) {
      ordered.push(id);
    }
  }
  tournament.rankingOrder = ordered;
}

function canGenerateNextRound(tournament) {
  const lastRound = tournament.rounds[tournament.rounds.length - 1];
  if (!lastRound) {
    return true;
  }
  return allResultsEntered(lastRound);
}

function openHomeView() {
  uiState.currentView = "home";
}

function openSetupView({ mode, tournamentId = null, returnView = "home" }) {
  uiState.currentView = "setup";
  uiState.setupMode = mode;
  uiState.setupTournamentId = tournamentId;
  uiState.setupReturnView = returnView;
}

function openTournamentView(tournamentId) {
  selectTournament(tournamentId);
  uiState.currentView = "tournament";
}

function getSetupDefaults(urlSetup) {
  if (uiState.setupMode === "edit") {
    const tournament = getTournamentById(uiState.setupTournamentId);
    if (!tournament) {
      return {
        name: "",
        playersText: "",
        pairingMode: "automatic",
        byeStrategy: "lowest",
      };
    }
    return {
      name: tournament.name,
      playersText: tournament.players.map((player) => player.name).join("\n"),
      pairingMode: tournament.settings.pairingMode,
      byeStrategy: tournament.settings.byeStrategy,
    };
  }
  if (state.tournaments.length === 0 && urlSetup.players.length > 0) {
    return {
      name: "",
      playersText: urlSetup.players.join("\n"),
      pairingMode: urlSetup.pairingMode,
      byeStrategy: urlSetup.byeStrategy,
    };
  }
  return {
    name: "",
    playersText: "",
    pairingMode: "automatic",
    byeStrategy: "lowest",
  };
}

function renderAppBar() {
  return `
    <nav class="navbar navbar-expand-lg fairpair-appbar px-3 py-2 mb-4 rounded-3">
      <div class="container-fluid px-0">
        <span class="navbar-brand mb-0 fw-semibold">${t("appTitle")}</span>
        <div class="d-flex align-items-center gap-2 ms-auto">
          <span class="lang-icon" aria-hidden="true">🌐</span>
          <div class="lang-switcher" role="group" aria-label="${t("language")}">
            <button
              type="button"
              class="lang-btn ${state.language === "en" ? "active" : ""}"
              data-lang="en"
              aria-pressed="${state.language === "en"}"
            >
              EN
            </button>
            <button
              type="button"
              class="lang-btn ${state.language === "fr" ? "active" : ""}"
              data-lang="fr"
              aria-pressed="${state.language === "fr"}"
            >
              FR
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function renderHomeView() {
  const gridItems = state.tournaments
    .map((tournament) => {
      const selected = tournament.id === uiState.selectedTournamentId;
      const tileActions = selected
        ? `
          <div class="card-footer border-top-0 pt-0">
            <div class="d-flex gap-2">
            <button
              type="button"
              class="btn btn-sm btn-primary open-from-tile"
              data-tournament-id="${escapeHtml(tournament.id)}"
            >
              ${t("editTournament")}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger delete-from-tile"
              data-tournament-id="${escapeHtml(tournament.id)}"
            >
              ${t("deleteTournament")}
            </button>
            </div>
          </div>
        `
        : "";
      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 tournament-tile ${selected ? "tournament-tile-selected" : ""}">
            <button
              class="card-body text-start tournament-tile-select"
              data-tournament-id="${escapeHtml(tournament.id)}"
              type="button"
            >
              <h3 class="h6 mb-2">${escapeHtml(tournament.name)}</h3>
              <p class="small text-muted mb-1">${t("playersCount")}: ${tournament.players.length}</p>
              <p class="small text-muted mb-0">${t("roundsCount")}: ${tournament.rounds.length}</p>
            </button>
            ${tileActions}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <section aria-label="${t("homeTitle")}">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="h4 mb-0">${t("homeTitle")}</h1>
        <div class="d-flex gap-2">
          <button id="add-tournament" class="btn btn-primary">+ ${t("addTournament")}</button>
          <button id="reset-all-tournaments" class="btn btn-outline-danger">${t("resetAll")}</button>
        </div>
      </div>
      ${
        gridItems
          ? `<div class="row g-3">${gridItems}</div>`
          : `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`
      }
    </section>
  `;
}

function renderSetupView(urlSetup) {
  const defaults = getSetupDefaults(urlSetup);
  const isEditing = uiState.setupMode === "edit";
  return `
    <section aria-label="${isEditing ? t("setupTitleEdit") : t("setupTitleCreate")}">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h4 mb-0">${isEditing ? t("setupTitleEdit") : t("setupTitleCreate")}</h1>
        <button id="cancel-setup" class="btn btn-outline-secondary">${t("cancel")}</button>
      </div>
      <div class="card shadow-sm">
        <div class="card-body">
          <form id="setup-form">
            <div class="mb-3">
              <label for="tournament-name" class="form-label">${t("tournamentName")}</label>
              <input id="tournament-name" class="form-control" value="${escapeHtml(
                defaults.name
              )}" required />
            </div>
            <div class="mb-3">
              <label for="pairing-mode" class="form-label">${t("pairingMode")}</label>
              <select id="pairing-mode" class="form-select">
                <option value="automatic" ${defaults.pairingMode === "automatic" ? "selected" : ""}>${t(
                  "modeAutomatic"
                )}</option>
                <option value="random" ${defaults.pairingMode === "random" ? "selected" : ""}>${t(
                  "modeRandom"
                )}</option>
                <option value="manual" ${defaults.pairingMode === "manual" ? "selected" : ""}>${t(
                  "modeManual"
                )}</option>
              </select>
            </div>
            <div class="mb-3">
              <label for="bye-strategy" class="form-label">${t("byeStrategy")}</label>
              <select id="bye-strategy" class="form-select">
                <option value="lowest" ${defaults.byeStrategy === "lowest" ? "selected" : ""}>${t(
                  "byeLowest"
                )}</option>
                <option value="random" ${defaults.byeStrategy === "random" ? "selected" : ""}>${t(
                  "byeRandom"
                )}</option>
              </select>
            </div>
            <div class="mb-3">
              <label for="players-input" class="form-label">${t("players")}</label>
              <textarea id="players-input" class="form-control" rows="8" required>${escapeHtml(
                defaults.playersText
              )}</textarea>
            </div>
            <button type="submit" class="btn btn-primary">${
              isEditing ? t("updateTournament") : t("createTournament")
            }</button>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderRoundCard(tournament) {
  const editableRound = getCurrentEditableRound(tournament);
  if (!editableRound) {
    return "";
  }
  const roundIndex = tournament.rounds.indexOf(editableRound);
  const roundNumber = roundIndex + 1;

  const byeLine = editableRound.byePlayerId
    ? `<div class="alert alert-light border">${t("byeLabel")}: <strong>${escapeHtml(
        getPlayerName(tournament, editableRound.byePlayerId)
      )}</strong></div>`
    : "";

  const rows = editableRound.matches
    .map((match, index) => {
      const value = match.result || "";
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(getPlayerName(tournament, match.a))}</td>
          <td>${escapeHtml(getPlayerName(tournament, match.b))}</td>
          <td>
            <select class="form-select form-select-sm result-select" data-match-index="${index}">
              <option value="" ${value === "" ? "selected" : ""}>${t("resultPending")}</option>
              <option value="a" ${value === "a" ? "selected" : ""}>${t("resultA")}</option>
              <option value="b" ${value === "b" ? "selected" : ""}>${t("resultB")}</option>
              <option value="draw" ${value === "draw" ? "selected" : ""}>${t("resultDraw")}</option>
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h5">${t("generatedRound")} #${roundNumber}</h3>
        ${byeLine}
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>${t("table")}</th>
                <th>A</th>
                <th>B</th>
                <th>${t("result")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button id="save-round-results" class="btn btn-success">${t("saveResults")}</button>
      </div>
    </div>
  `;
}

function renderStandingsCard(tournament) {
  const standings = getStandings(tournament.players, tournament.rounds);
  const rows = standings
    .map(
      (entry) => `
      <tr>
        <td>${entry.rank}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${entry.displayPoints}</td>
        <td>${entry.wins}</td>
        <td>${entry.draws}</td>
        <td>${entry.losses}</td>
        <td>${entry.byes}</td>
        <td>${entry.played}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h5">${t("standings")}</h3>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>${t("rank")}</th>
                <th>${t("player")}</th>
                <th>${t("points")}</th>
                <th>${t("wins")}</th>
                <th>${t("draws")}</th>
                <th>${t("losses")}</th>
                <th>${t("byes")}</th>
                <th>${t("played")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderRankingEditorCard(tournament) {
  const rankingItems = tournament.rankingOrder
    .map(
      (playerId) => `
      <li class="list-group-item d-flex align-items-center justify-content-between draggable-player"
          draggable="true"
          data-player-id="${escapeHtml(playerId)}">
        <span>${escapeHtml(getPlayerName(tournament, playerId))}</span>
        <span class="text-muted">⇅</span>
      </li>`
    )
    .join("");

  const options = [`<option value="">${t("none")}</option>`]
    .concat(
      tournament.rankingOrder.map(
        (id) => `<option value="${escapeHtml(id)}">${escapeHtml(getPlayerName(tournament, id))}</option>`
      )
    )
    .join("");

  const disabled = canGenerateNextRound(tournament) ? "" : "disabled";

  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h5">${t("rankingEditor")}</h3>
        <p class="text-muted mb-3">${t("dragHint")}</p>
        <ul id="ranking-list" class="list-group mb-3">${rankingItems}</ul>
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label" for="manual-bye">${t("manualByeLabel")}</label>
            <select id="manual-bye" class="form-select">${options}</select>
          </div>
          <div class="col-md-4">
            <label class="form-label" for="round-mode">${t("pairingMode")}</label>
            <select id="round-mode" class="form-select">
              <option value="automatic">${t("modeAutomatic")}</option>
              <option value="random">${t("modeRandom")}</option>
              <option value="manual">${t("modeManual")}</option>
            </select>
          </div>
          <div class="col-md-4">
            <button id="generate-round" class="btn btn-primary w-100" ${disabled}>${t(
              "generateRound"
            )}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRoundHistoryCard(tournament) {
  const entries = tournament.rounds
    .map((round, index) => {
      const complete = allResultsEntered(round);
      return `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>Round #${index + 1} ${complete ? "✅" : "⏳"}</span>
        <button class="btn btn-sm btn-outline-secondary edit-round" data-round-index="${index}">
          ${t("editRound")}
        </button>
      </li>`;
    })
    .join("");
  return `
    <div class="card shadow-sm mt-4">
      <div class="card-body">
        <h3 class="h5">${t("roundHistory")}</h3>
        <ul class="list-group">${entries}</ul>
      </div>
    </div>
  `;
}

function renderTournamentView() {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return `<div class="alert alert-light border">${t("noTournamentSelected")}</div>`;
  }
  return `
    <section aria-label="${escapeHtml(tournament.name)}">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 class="h4 mb-0">${escapeHtml(tournament.name)}</h1>
          <p class="text-muted mb-0">${t("roundsCount")}: ${tournament.rounds.length}</p>
        </div>
        <div class="d-flex gap-2">
          <button id="back-to-home" class="btn btn-outline-secondary">${t("backToHome")}</button>
          <button id="edit-current-tournament" class="btn btn-outline-primary">${t(
            "configureTournament"
          )}</button>
        </div>
      </div>
      ${renderRankingEditorCard(tournament)}
      ${renderRoundCard(tournament)}
      ${renderStandingsCard(tournament)}
      ${renderRoundHistoryCard(tournament)}
    </section>
  `;
}

function attachGlobalListeners() {
  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedLanguage = button.dataset.lang === "fr" ? "fr" : "en";
      if (state.language === selectedLanguage) {
        return;
      }
      state.language = selectedLanguage;
      saveState(state);
      render();
    });
  });
}

function attachHomeListeners() {
  document.getElementById("add-tournament")?.addEventListener("click", () => {
    openSetupView({ mode: "create", returnView: "home" });
    render();
  });

  document.getElementById("reset-all-tournaments")?.addEventListener("click", () => {
    if (!window.confirm(t("confirmResetAll"))) {
      return;
    }
    state.tournaments = [];
    state.selectedTournamentId = null;
    uiState.selectedTournamentId = null;
    openHomeView();
    saveState(state);
    render();
  });

  document.querySelectorAll(".tournament-tile-select").forEach((button) => {
    button.addEventListener("click", () => {
      selectTournament(button.dataset.tournamentId);
      saveState(state);
      render();
    });
  });

  document.querySelectorAll(".open-from-tile").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const tournamentId = button.dataset.tournamentId;
      if (!tournamentId) {
        return;
      }
      openTournamentView(tournamentId);
      saveState(state);
      render();
    });
  });

  document.querySelectorAll(".delete-from-tile").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const tournamentId = button.dataset.tournamentId;
      if (!tournamentId) {
        return;
      }
      if (!window.confirm(t("confirmDeleteTournament"))) {
        return;
      }
      const updated = removeTournamentFromCollection(
        state.tournaments,
        tournamentId,
        state.selectedTournamentId
      );
      state.tournaments = updated.tournaments;
      state.selectedTournamentId = updated.selectedTournamentId;
      uiState.selectedTournamentId = updated.selectedTournamentId;
      saveState(state);
      render();
    });
  });
}

function attachSetupListeners() {
  const form = document.getElementById("setup-form");
  if (!form) {
    return;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("tournament-name").value.trim();
    const playerNames = parsePlayersFromText(document.getElementById("players-input").value);
    const pairingMode = document.getElementById("pairing-mode").value;
    const byeStrategy = document.getElementById("bye-strategy").value;

    if (!name || playerNames.length < 2) {
      window.alert(t("setupRequired"));
      return;
    }
    const uniqueCheck = new Set(playerNames.map((value) => value.toLowerCase()));
    if (uniqueCheck.size !== playerNames.length) {
      window.alert(t("duplicatesPlayers"));
      return;
    }

    const formData = { name, playerNames, pairingMode, byeStrategy };
    if (uiState.setupMode === "edit") {
      const tournament = getTournamentById(uiState.setupTournamentId);
      if (!tournament) {
        openHomeView();
        render();
        return;
      }
      const mustReset = needsRoundReset(tournament, formData);
      if (mustReset && tournament.rounds.length > 0) {
        if (!window.confirm(t("confirmSetupChange"))) {
          return;
        }
      }
      const updated = applyTournamentEdits(tournament, formData, { resetRounds: mustReset });
      updateTournament(updated);
      selectTournament(updated.id);
    } else {
      const created = createTournamentFromForm({
        id: createTournamentId(),
        ...formData,
      });
      state.tournaments.push(created);
      selectTournament(created.id);
    }

    openTournamentView(state.selectedTournamentId);
    saveState(state);
    render();
  });

  document.getElementById("cancel-setup")?.addEventListener("click", () => {
    if (uiState.setupReturnView === "tournament" && state.selectedTournamentId) {
      uiState.currentView = "tournament";
    } else {
      openHomeView();
    }
    render();
  });
}

function attachRankingDnD(tournament) {
  const list = document.getElementById("ranking-list");
  if (!list) {
    return;
  }
  let dragged = null;

  list.querySelectorAll(".draggable-player").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!dragged || dragged === item) {
        return;
      }
      const draggedId = dragged.dataset.playerId;
      const targetId = item.dataset.playerId;
      const order = tournament.rankingOrder.filter((id) => id !== draggedId);
      const targetIndex = order.indexOf(targetId);
      order.splice(targetIndex, 0, draggedId);
      tournament.rankingOrder = order;
      saveState(state);
      render();
    });
  });
}

function attachTournamentListeners() {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return;
  }
  const roundMode = document.getElementById("round-mode");
  if (roundMode) {
    roundMode.value = tournament.settings.pairingMode;
  }

  document.getElementById("back-to-home")?.addEventListener("click", () => {
    openHomeView();
    saveState(state);
    render();
  });

  document.getElementById("edit-current-tournament")?.addEventListener("click", () => {
    openSetupView({
      mode: "edit",
      tournamentId: tournament.id,
      returnView: "tournament",
    });
    render();
  });

  document.getElementById("generate-round")?.addEventListener("click", () => {
    const current = getCurrentTournament();
    if (!current || !canGenerateNextRound(current)) {
      return;
    }
    const manualByePlayerId = document.getElementById("manual-bye").value || null;
    current.settings.pairingMode = document.getElementById("round-mode").value;
    const mode = current.settings.pairingMode;

    if (mode === "manual") {
      const matches = [];
      let ordered = current.rankingOrder.slice();
      let byePlayerId = null;
      if (ordered.length % 2 === 1) {
        byePlayerId = manualByePlayerId || ordered[ordered.length - 1];
        ordered = ordered.filter((id) => id !== byePlayerId);
      }
      for (let i = 0; i < ordered.length; i += 2) {
        matches.push({ a: ordered[i], b: ordered[i + 1], result: null });
      }
      current.rounds.push({
        matches,
        byePlayerId,
      });
    } else {
      const generated = generateRoundPairings({
        players: current.players,
        orderedPlayerIds: current.rankingOrder,
        rounds: current.rounds,
        byeStrategy: current.settings.byeStrategy,
        mode,
        manualByePlayerId,
        randomSeed: current.rounds.length + 1,
      });
      current.rounds.push(generated);
    }
    current.editRoundIndex = current.rounds.length - 1;
    current.updatedAt = Date.now();
    saveState(state);
    render();
  });

  document.querySelectorAll(".edit-round").forEach((button) => {
    button.addEventListener("click", () => {
      const current = getCurrentTournament();
      if (!current) {
        return;
      }
      current.editRoundIndex = Number(button.dataset.roundIndex);
      current.updatedAt = Date.now();
      saveState(state);
      render();
    });
  });

  document.querySelectorAll(".result-select").forEach((select) => {
    select.addEventListener("change", () => {
      const current = getCurrentTournament();
      if (!current) {
        return;
      }
      const roundIndex =
        current.editRoundIndex === null ? current.rounds.length - 1 : current.editRoundIndex;
      const round = current.rounds[roundIndex];
      const matchIndex = Number(select.dataset.matchIndex);
      round.matches[matchIndex].result = select.value || null;
      current.updatedAt = Date.now();
      saveState(state);
      render();
    });
  });

  document.getElementById("save-round-results")?.addEventListener("click", () => {
    const current = getCurrentTournament();
    if (!current) {
      return;
    }
    const roundIndex =
      current.editRoundIndex === null ? current.rounds.length - 1 : current.editRoundIndex;
    const round = current.rounds[roundIndex];
    if (!allResultsEntered(round)) {
      window.alert(t("resultPending"));
      return;
    }
    const hasFutureRounds = roundIndex < current.rounds.length - 1;
    if (hasFutureRounds) {
      const confirmed = window.confirm(t("confirmRegenerateAfterEdit"));
      if (!confirmed) {
        return;
      }
      current.rounds = current.rounds.slice(0, roundIndex + 1);
    }
    updateRankingFromStandings(current);
    current.editRoundIndex = null;
    current.updatedAt = Date.now();
    saveState(state);
    render();
    window.alert(t("roundSaved"));
  });

  attachRankingDnD(tournament);
}

function render() {
  const urlSetup = parseSetupFromUrl();
  let pageContent = "";
  if (uiState.currentView === "setup") {
    pageContent = renderSetupView(urlSetup);
  } else if (uiState.currentView === "tournament") {
    pageContent = renderTournamentView();
  } else {
    pageContent = renderHomeView();
  }

  root.innerHTML = `
    ${renderAppBar()}
    ${pageContent}
  `;
  attachGlobalListeners();
  if (uiState.currentView === "setup") {
    attachSetupListeners();
  } else if (uiState.currentView === "tournament") {
    attachTournamentListeners();
  } else {
    attachHomeListeners();
  }
}

if (state.selectedTournamentId) {
  selectTournament(state.selectedTournamentId);
}
const currentTournament = getCurrentTournament();
if (currentTournament) {
  updateRankingFromStandings(currentTournament);
}
saveState(state);
render();
