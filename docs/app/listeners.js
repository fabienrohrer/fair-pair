import {
  createEmptyPairingSlots,
  flattenRankingGroups,
  generatePairingProposal,
  isValidPairingAssignment,
} from "../pairing.js";
import {
  applyTournamentEdits,
  createRoundDraft,
  createTournamentFromForm,
  needsRoundReset,
  normalizeRankingGroups,
  removeTournamentFromCollection,
} from "../tournament-state.js";
import { createTournamentId, parsePlayersFromText } from "./utils.js";
import { currentPlayerIds } from "./renderers.js";

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

function normalizeDraftRanking(tournament) {
  const draft = tournament.currentRoundDraft;
  const ids = currentPlayerIds(tournament);
  draft.rankingGroups = normalizeRankingGroups(draft.rankingGroups, ids);
  while (draft.rankingGroups.length < ids.length) {
    draft.rankingGroups.push([]);
  }
}

function attachPairingDnD(tournament, { saveState, render }) {
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

function attachRankingDnD(tournament, { saveState, render }) {
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

export function attachGlobalListeners({ state, t, saveState, render, dismissNotification }) {
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

  document.querySelectorAll("[data-notification-dismiss]").forEach((button) => {
    button.addEventListener("click", () => {
      dismissNotification(button.dataset.notificationDismiss);
    });
  });
}

export function attachHomeListeners({
  state,
  t,
  saveState,
  render,
  openHomeView,
  openSetupView,
  openTournamentView,
  selectTournament,
}) {
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

export function attachSetupListeners({
  state,
  uiState,
  t,
  saveState,
  render,
  notify,
  openHomeView,
  openTournamentView,
  selectTournament,
  getTournamentById,
}) {
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
      notify(t("setupRequired"), { variant: "danger" });
      return;
    }
    const duplicateCheck = new Set(playerNames.map((value) => value.toLowerCase()));
    if (duplicateCheck.size !== playerNames.length) {
      notify(t("duplicatesPlayers"), { variant: "danger" });
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

export function attachTournamentListeners({
  state,
  t,
  saveState,
  render,
  notify,
  openHomeView,
  getCurrentTournament,
}) {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return;
  }

  document.getElementById("back-home")?.addEventListener("click", () => {
    openHomeView();
    render();
  });

  document.getElementById("prepare-round")?.addEventListener("click", () => {
    tournament.currentRoundDraft = createRoundDraft(currentPlayerIds(tournament));
    tournament.updatedAt = Date.now();
    saveState();
    render();
  });

  if (tournament.currentRoundDraft?.phase === "pairing") {
    attachPairingDnD(tournament, { saveState, render });

    document.getElementById("back-to-tournament")?.addEventListener("click", () => {
      if (!window.confirm(t("confirmDiscardDraft"))) {
        return;
      }
      tournament.currentRoundDraft = null;
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });

    document.getElementById("auto-mode")?.addEventListener("change", (event) => {
      const draft = tournament.currentRoundDraft;
      draft.autoOptions.mode = event.target.value;
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });

    document.getElementById("try-auto-pairing")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const selectedMode = document.getElementById("auto-mode")?.value || draft.autoOptions.mode;
      draft.autoOptions.mode = selectedMode;
      draft.autoOptions.byeStrategy =
        document.getElementById("auto-bye-strategy")?.value || draft.autoOptions.byeStrategy;
      draft.autoOptions.priorityOrder = document.getElementById("auto-priority-order")
        ? document.getElementById("auto-priority-order").value.split("|")
        : draft.autoOptions.priorityOrder;

      const nextRandomSeed = Date.now() + Math.floor(Math.random() * 1000000);
      draft.autoOptions.randomSeed = nextRandomSeed;

      const proposal = generatePairingProposal({
        players: tournament.players,
        rounds: tournament.rounds,
        rankingGroups: tournament.rankingGroups,
        mode: draft.autoOptions.mode,
        byeStrategy: draft.autoOptions.byeStrategy,
        priorityOrder: draft.autoOptions.priorityOrder,
        randomSeed: nextRandomSeed,
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
        notify(t("invalidPairing"), { variant: "danger" });
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
    attachRankingDnD(tournament, { saveState, render });

    document.getElementById("back-to-pairing")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      draft.phase = "pairing";
      normalizeDraftRanking(tournament);
      tournament.updatedAt = Date.now();
      saveState();
      render();
    });

    document.getElementById("finish-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
      const flattened = flattenRankingGroups(normalized);
      if (flattened.length !== tournament.players.length) {
        notify(t("invalidRanking"), { variant: "danger" });
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
      notify(t("roundSaved"), { variant: "success" });
    });
  }
}
