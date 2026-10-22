import { allResultsEntered, generateRoundPairings, getStandings } from "./pairing.js";

const STORAGE_KEY = "fair-pair:tournament:v1";

const messages = {
  en: {
    appTitle: "Fair Pair",
    language: "Language",
    resetTournament: "Reset tournament",
    setupTitle: "Create tournament",
    tournamentName: "Tournament name",
    pairingMode: "Default pairing mode",
    modeAutomatic: "Automatic (smart)",
    modeRandom: "Random",
    modeManual: "Manual (adjacent after ranking order)",
    byeStrategy: "BYE strategy",
    byeLowest: "Lowest-ranked eligible player",
    byeRandom: "Random eligible player",
    players: "Players (one per line)",
    createTournament: "Create tournament",
    standings: "Standings",
    rankingEditor: "Ranking order for next round",
    dragHint: "Drag players to adjust the ranking order used for pairings.",
    manualByeLabel: "Manual BYE override",
    none: "None",
    generateRound: "Generate next round",
    generatedRound: "Current round",
    completeRound: "Complete round",
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
    setupRequired: "Please enter a tournament name and at least 2 players.",
    duplicatesPlayers: "Player names must be unique (case-insensitive).",
    roundSaved: "Round saved.",
    confirmReset: "Reset the current tournament? This action cannot be undone.",
    confirmRegenerateAfterEdit:
      "Updating this round will remove all following rounds. Continue?",
    confirmSetupChange:
      "Changing setup will remove all rounds. Continue?",
    noTournament: "No active tournament.",
  },
  fr: {
    appTitle: "Fair Pair",
    language: "Langue",
    resetTournament: "Réinitialiser le tournoi",
    setupTitle: "Créer un tournoi",
    tournamentName: "Nom du tournoi",
    pairingMode: "Mode d'appariement par défaut",
    modeAutomatic: "Automatique (intelligent)",
    modeRandom: "Aléatoire",
    modeManual: "Manuel (adjacent selon le classement)",
    byeStrategy: "Stratégie BYE",
    byeLowest: "Joueur éligible le plus bas classé",
    byeRandom: "Joueur éligible aléatoire",
    players: "Joueurs (un par ligne)",
    createTournament: "Créer le tournoi",
    standings: "Classement",
    rankingEditor: "Ordre de classement pour le prochain round",
    dragHint: "Glissez les joueurs pour ajuster l'ordre utilisé pour les appariements.",
    manualByeLabel: "BYE manuel",
    none: "Aucun",
    generateRound: "Générer le round suivant",
    generatedRound: "Round en cours",
    completeRound: "Valider le round",
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
    setupRequired: "Veuillez saisir un nom de tournoi et au moins 2 joueurs.",
    duplicatesPlayers: "Les noms de joueurs doivent être uniques (insensible à la casse).",
    roundSaved: "Round enregistré.",
    confirmReset: "Réinitialiser le tournoi en cours ? Cette action est irréversible.",
    confirmRegenerateAfterEdit:
      "La modification de ce round supprimera les rounds suivants. Continuer ?",
    confirmSetupChange:
      "La modification de la configuration supprimera tous les rounds. Continuer ?",
    noTournament: "Aucun tournoi actif.",
  },
};

function detectDefaultLanguage() {
  const browserLanguage = navigator.language?.toLowerCase() || "en";
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

function createPlayerId(index) {
  return `p${index + 1}`;
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

function createTournament({ name, pairingMode, byeStrategy, players }) {
  return {
    name,
    settings: {
      pairingMode,
      byeStrategy,
    },
    players: players.map((playerName, index) => ({
      id: createPlayerId(index),
      name: playerName,
    })),
    rounds: [],
    rankingOrder: players.map((_, index) => createPlayerId(index)),
    editRoundIndex: null,
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      language: detectDefaultLanguage(),
      tournament: null,
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      language: parsed.language === "fr" ? "fr" : "en",
      tournament: parsed.tournament || null,
    };
  } catch {
    return {
      language: detectDefaultLanguage(),
      tournament: null,
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();
const root = document.getElementById("app");

function t(key) {
  return messages[state.language][key];
}

function getPlayerName(playerId) {
  return state.tournament.players.find((player) => player.id === playerId)?.name || playerId;
}

function getCurrentEditableRound() {
  if (!state.tournament || state.tournament.rounds.length === 0) {
    return null;
  }
  if (state.tournament.editRoundIndex === null) {
    return state.tournament.rounds[state.tournament.rounds.length - 1];
  }
  return state.tournament.rounds[state.tournament.editRoundIndex] || null;
}

function updateRankingFromStandings() {
  const standings = getStandings(state.tournament.players, state.tournament.rounds);
  const ordered = standings.map((entry) => entry.id);
  const known = new Set(ordered);
  for (const id of state.tournament.rankingOrder) {
    if (!known.has(id)) {
      ordered.push(id);
    }
  }
  state.tournament.rankingOrder = ordered;
}

function canGenerateNextRound() {
  if (!state.tournament) {
    return false;
  }
  const lastRound = state.tournament.rounds[state.tournament.rounds.length - 1];
  if (!lastRound) {
    return true;
  }
  return allResultsEntered(lastRound);
}

function renderSetupView(urlSetup) {
  return `
    <div class="card shadow-sm">
      <div class="card-body">
        <h2 class="h4 mb-3">${t("setupTitle")}</h2>
        <form id="setup-form">
          <div class="mb-3">
            <label for="tournament-name" class="form-label">${t("tournamentName")}</label>
            <input id="tournament-name" class="form-control" required />
          </div>
          <div class="mb-3">
            <label for="pairing-mode" class="form-label">${t("pairingMode")}</label>
            <select id="pairing-mode" class="form-select">
              <option value="automatic">${t("modeAutomatic")}</option>
              <option value="random">${t("modeRandom")}</option>
              <option value="manual">${t("modeManual")}</option>
            </select>
          </div>
          <div class="mb-3">
            <label for="bye-strategy" class="form-label">${t("byeStrategy")}</label>
            <select id="bye-strategy" class="form-select">
              <option value="lowest">${t("byeLowest")}</option>
              <option value="random">${t("byeRandom")}</option>
            </select>
          </div>
          <div class="mb-3">
            <label for="players-input" class="form-label">${t("players")}</label>
            <textarea id="players-input" class="form-control" rows="8" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">${t("createTournament")}</button>
        </form>
      </div>
    </div>
  `;
}

function renderRoundCard() {
  const editableRound = getCurrentEditableRound();
  if (!editableRound) {
    return "";
  }
  const roundIndex = state.tournament.rounds.indexOf(editableRound);
  const roundNumber = roundIndex + 1;
  const disabledAttr = roundIndex !== state.tournament.rounds.length - 1 ? "" : "";

  const byeLine = editableRound.byePlayerId
    ? `<div class="alert alert-light border">${t("byeLabel")}: <strong>${getPlayerName(
        editableRound.byePlayerId
      )}</strong></div>`
    : "";

  const rows = editableRound.matches
    .map((match, index) => {
      const value = match.result || "";
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${getPlayerName(match.a)}</td>
        <td>${getPlayerName(match.b)}</td>
        <td>
          <select class="form-select form-select-sm result-select" data-match-index="${index}" ${disabledAttr}>
            <option value="" ${value === "" ? "selected" : ""}>${t("resultPending")}</option>
            <option value="a" ${value === "a" ? "selected" : ""}>${t("resultA")}</option>
            <option value="b" ${value === "b" ? "selected" : ""}>${t("resultB")}</option>
            <option value="draw" ${value === "draw" ? "selected" : ""}>${t("resultDraw")}</option>
          </select>
        </td>
      </tr>`;
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

function renderStandingsCard() {
  const standings = getStandings(state.tournament.players, state.tournament.rounds);
  const rows = standings
    .map(
      (entry) => `
      <tr>
        <td>${entry.rank}</td>
        <td>${entry.name}</td>
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

function renderRankingEditorCard() {
  const rankingItems = state.tournament.rankingOrder
    .map(
      (playerId) => `
      <li class="list-group-item d-flex align-items-center justify-content-between draggable-player"
          draggable="true"
          data-player-id="${playerId}">
        <span>${getPlayerName(playerId)}</span>
        <span class="text-muted">⇅</span>
      </li>`
    )
    .join("");

  const options = [`<option value="">${t("none")}</option>`]
    .concat(
      state.tournament.rankingOrder.map(
        (id) => `<option value="${id}">${getPlayerName(id)}</option>`
      )
    )
    .join("");

  const disabled = canGenerateNextRound() ? "" : "disabled";

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

function renderRoundHistoryCard() {
  const entries = state.tournament.rounds
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
        <ul class="list-group">${entries || `<li class="list-group-item">${t("noTournament")}</li>`}</ul>
      </div>
    </div>
  `;
}

function renderTournamentView() {
  return `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="h4 mb-0">${state.tournament.name}</h2>
      <span class="badge text-bg-secondary">Rounds: ${state.tournament.rounds.length}</span>
    </div>
    ${renderRankingEditorCard()}
    ${renderRoundCard()}
    ${renderStandingsCard()}
    ${renderRoundHistoryCard()}
  `;
}

function attachSetupListeners(urlSetup) {
  const form = document.getElementById("setup-form");
  const playersInput = document.getElementById("players-input");
  const pairingSelect = document.getElementById("pairing-mode");
  const byeSelect = document.getElementById("bye-strategy");

  if (urlSetup.players.length > 0) {
    playersInput.value = urlSetup.players.join("\n");
  }
  pairingSelect.value = urlSetup.pairingMode;
  byeSelect.value = urlSetup.byeStrategy;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("tournament-name").value.trim();
    const playerNames = parsePlayersFromText(playersInput.value);
    if (!name || playerNames.length < 2) {
      window.alert(t("setupRequired"));
      return;
    }
    const uniqueCheck = new Set(playerNames.map((value) => value.toLowerCase()));
    if (uniqueCheck.size !== playerNames.length) {
      window.alert(t("duplicatesPlayers"));
      return;
    }
    state.tournament = createTournament({
      name,
      pairingMode: pairingSelect.value,
      byeStrategy: byeSelect.value,
      players: playerNames,
    });
    saveState(state);
    render();
  });
}

function attachRankingDnD() {
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
      const order = state.tournament.rankingOrder.filter((id) => id !== draggedId);
      const targetIndex = order.indexOf(targetId);
      order.splice(targetIndex, 0, draggedId);
      state.tournament.rankingOrder = order;
      saveState(state);
      render();
    });
  });
}

function attachTournamentListeners() {
  const manualByeSelect = document.getElementById("manual-bye");
  const roundMode = document.getElementById("round-mode");
  if (roundMode) {
    roundMode.value = state.tournament.settings.pairingMode;
  }

  document.getElementById("generate-round")?.addEventListener("click", () => {
    if (!canGenerateNextRound()) {
      return;
    }
    state.tournament.settings.pairingMode = roundMode.value;
    const mode = roundMode.value;
    const manualByePlayerId = manualByeSelect.value || null;

    let matches;
    if (mode === "manual") {
      matches = [];
      let ordered = state.tournament.rankingOrder.slice();
      let byePlayerId = null;
      if (ordered.length % 2 === 1) {
        byePlayerId = manualByePlayerId || ordered[ordered.length - 1];
        ordered = ordered.filter((id) => id !== byePlayerId);
      }
      for (let i = 0; i < ordered.length; i += 2) {
        matches.push({ a: ordered[i], b: ordered[i + 1], result: null });
      }
      state.tournament.rounds.push({
        matches,
        byePlayerId,
      });
    } else {
      const generated = generateRoundPairings({
        players: state.tournament.players,
        orderedPlayerIds: state.tournament.rankingOrder,
        rounds: state.tournament.rounds,
        byeStrategy: state.tournament.settings.byeStrategy,
        mode,
        manualByePlayerId,
        randomSeed: state.tournament.rounds.length + 1,
      });
      state.tournament.rounds.push(generated);
    }
    state.tournament.editRoundIndex = state.tournament.rounds.length - 1;
    saveState(state);
    render();
  });

  document.querySelectorAll(".edit-round").forEach((button) => {
    button.addEventListener("click", () => {
      state.tournament.editRoundIndex = Number(button.dataset.roundIndex);
      saveState(state);
      render();
    });
  });

  document.querySelectorAll(".result-select").forEach((select) => {
    select.addEventListener("change", () => {
      const roundIndex =
        state.tournament.editRoundIndex === null
          ? state.tournament.rounds.length - 1
          : state.tournament.editRoundIndex;
      const round = state.tournament.rounds[roundIndex];
      const matchIndex = Number(select.dataset.matchIndex);
      round.matches[matchIndex].result = select.value || null;
      saveState(state);
      renderStandingsOnly();
    });
  });

  document.getElementById("save-round-results")?.addEventListener("click", () => {
    const roundIndex =
      state.tournament.editRoundIndex === null
        ? state.tournament.rounds.length - 1
        : state.tournament.editRoundIndex;
    const round = state.tournament.rounds[roundIndex];
    if (!allResultsEntered(round)) {
      window.alert(t("resultPending"));
      return;
    }
    const hasFutureRounds = roundIndex < state.tournament.rounds.length - 1;
    if (hasFutureRounds) {
      const confirmed = window.confirm(t("confirmRegenerateAfterEdit"));
      if (!confirmed) {
        return;
      }
      state.tournament.rounds = state.tournament.rounds.slice(0, roundIndex + 1);
    }
    updateRankingFromStandings();
    state.tournament.editRoundIndex = null;
    saveState(state);
    render();
    window.alert(t("roundSaved"));
  });

  attachRankingDnD();
}

function renderStandingsOnly() {
  const standingsContainer = root.querySelector(".card.shadow-sm.mt-4:last-of-type");
  if (!standingsContainer) {
    return;
  }
  render();
}

function renderToolbar() {
  return `
    <nav class="navbar navbar-expand bg-body-tertiary border rounded px-3 mb-4">
      <span class="navbar-brand mb-0 h1">${t("appTitle")}</span>
      <div class="ms-auto d-flex align-items-center gap-2">
        <label for="lang-switch" class="form-label mb-0">${t("language")}</label>
        <select id="lang-switch" class="form-select form-select-sm">
          <option value="en" ${state.language === "en" ? "selected" : ""}>EN</option>
          <option value="fr" ${state.language === "fr" ? "selected" : ""}>FR</option>
        </select>
        <button id="reset-tournament" class="btn btn-sm btn-outline-danger">${t(
          "resetTournament"
        )}</button>
      </div>
    </nav>
  `;
}

function attachGlobalListeners() {
  document.getElementById("lang-switch").addEventListener("change", (event) => {
    state.language = event.target.value === "fr" ? "fr" : "en";
    saveState(state);
    render();
  });

  document.getElementById("reset-tournament").addEventListener("click", () => {
    if (!window.confirm(t("confirmReset"))) {
      return;
    }
    state.tournament = null;
    saveState(state);
    render();
  });
}

function render() {
  const urlSetup = parseSetupFromUrl();
  const content = state.tournament ? renderTournamentView() : renderSetupView(urlSetup);
  root.innerHTML = `
    ${renderToolbar()}
    ${content}
  `;
  attachGlobalListeners();
  if (!state.tournament) {
    attachSetupListeners(urlSetup);
  } else {
    attachTournamentListeners();
  }
}

if (state.tournament) {
  updateRankingFromStandings();
  saveState(state);
}
render();
