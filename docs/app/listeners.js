import {
  createEmptyPairingSlots,
  flattenRankingGroups,
  generateRegistrationOrderProposal,
  generatePairingProposal,
  isValidPairingAssignment,
} from "../pairing.js";
import {
  buildSwissRankingGroups,
  generateSwissPairingProposal,
  normalizeSwissSettings,
} from "../swiss.js";
import {
  applyTournamentEdits,
  createRoundDraft,
  createTournamentFromForm,
  getPairingStageRules,
  needsRoundReset,
  normalizeRankingGroups,
  removeTournamentFromCollection,
  resolveAutoPairingMode,
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

function commitTournamentChange(tournament, saveState, render, mutate) {
  mutate();
  tournament.updatedAt = Date.now();
  saveState();
  render();
}

function touchTournament(tournament, saveState, render) {
  tournament.updatedAt = Date.now();
  saveState();
  render();
}

function attachPlayerDragAndDrop({
  dragType,
  dropZoneSelector,
  onDropPlayer,
}) {
  const activeTouchDragClass = "fp-touch-drag-active";
  const activeDropTargetClass = "fp-drop-target-active";
  const touchMoveOptions = { passive: false };
  const preventTouchScroll = (moveEvent) => {
    moveEvent.preventDefault();
  };

  const setTouchDragActive = (isActive) => {
    document.body.classList.toggle(activeTouchDragClass, isActive);
    document.documentElement.classList.toggle(activeTouchDragClass, isActive);
    if (isActive) {
      window.addEventListener("touchmove", preventTouchScroll, touchMoveOptions);
      return;
    }
    window.removeEventListener("touchmove", preventTouchScroll, touchMoveOptions);
  };

  function applyDrop(playerId, zone) {
    if (!playerId || !zone) {
      return;
    }
    onDropPlayer(playerId, zone);
  }

  const createTouchGhost = (chip) => {
    const ghost = chip.cloneNode(true);
    ghost.classList.add("fp-drag-ghost");
    const rect = chip.getBoundingClientRect();
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    return ghost;
  };

  const moveTouchGhost = (ghost, clientX, clientY) => {
    if (!ghost) {
      return;
    }
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;
  };

  document.querySelectorAll(`[draggable="true"][data-drag-type="${dragType}"]`).forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", chip.dataset.playerId);
      event.dataTransfer.setData("application/x-fairpair-drag-type", dragType);
    });
  });

  document.querySelectorAll(dropZoneSelector).forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      if (event.dataTransfer.getData("application/x-fairpair-drag-type") !== dragType) {
        return;
      }
      applyDrop(event.dataTransfer.getData("text/plain"), zone);
    });
  });

  document
    .querySelectorAll(`[draggable="true"][data-drag-type="${dragType}"][data-player-id]`)
    .forEach((chip) => {
    chip.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }
      const playerId = chip.dataset.playerId;
      if (!playerId) {
        return;
      }

      let activeDropZone = null;
      let ghost = null;

      const clearActiveDropZone = () => {
        if (activeDropZone) {
          activeDropZone.classList.remove(activeDropTargetClass);
          activeDropZone = null;
        }
      };

      const cleanup = () => {
        clearActiveDropZone();
        setTouchDragActive(false);
        chip.classList.remove("fp-drag-source");
        if (ghost) {
          ghost.remove();
          ghost = null;
        }
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
      };

      const updateDropTargetFromPoint = (clientX, clientY) => {
        const topElement = document.elementFromPoint(clientX, clientY);
        const nextDropZone = topElement?.closest(dropZoneSelector) || null;
        if (nextDropZone === activeDropZone) {
          return;
        }
        clearActiveDropZone();
        if (nextDropZone) {
          nextDropZone.classList.add(activeDropTargetClass);
          activeDropZone = nextDropZone;
        }
      };

      const handlePointerMove = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) {
          return;
        }
        moveEvent.preventDefault();
        moveTouchGhost(ghost, moveEvent.clientX, moveEvent.clientY);
        updateDropTargetFromPoint(moveEvent.clientX, moveEvent.clientY);
      };

      const handlePointerUp = (upEvent) => {
        if (upEvent.pointerId !== event.pointerId) {
          return;
        }
        upEvent.preventDefault();
        const zoneToUse = activeDropZone;
        cleanup();
        if (zoneToUse) {
          applyDrop(playerId, zoneToUse);
        }
      };

      const handlePointerCancel = (cancelEvent) => {
        if (cancelEvent.pointerId !== event.pointerId) {
          return;
        }
        cleanup();
      };

      event.preventDefault();
      setTouchDragActive(true);
      chip.classList.add("fp-drag-source");
      ghost = createTouchGhost(chip);
      moveTouchGhost(ghost, event.clientX, event.clientY);
      if (typeof chip.setPointerCapture === "function") {
        chip.setPointerCapture(event.pointerId);
      }
      updateDropTargetFromPoint(event.clientX, event.clientY);
      window.addEventListener("pointermove", handlePointerMove, { passive: false });
      window.addEventListener("pointerup", handlePointerUp, { passive: false });
      window.addEventListener("pointercancel", handlePointerCancel, { passive: false });
    });
    });
}

function attachPairingDnD(tournament, { saveState, render }) {
  const draft = tournament.currentRoundDraft;
  attachPlayerDragAndDrop({
    dragType: "pairing",
    dropZoneSelector: ".pairing-drop-zone",
    onDropPlayer: (playerId, zone) => {
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
      touchTournament(tournament, saveState, render);
      return true;
    },
  });
}

function attachRankingDnD(tournament, { saveState, render }) {
  const draft = tournament.currentRoundDraft;
  attachPlayerDragAndDrop({
    dragType: "ranking",
    dropZoneSelector: ".ranking-drop-zone, .ranking-unassigned-drop-zone",
    onDropPlayer: (playerId, zone) => {
      if (zone.classList.contains("ranking-unassigned-drop-zone")) {
        removePlayerFromRankingDraft(draft, playerId);
      } else {
        assignPlayerToRankingGroup(draft, playerId, Number(zone.dataset.rankIndex));
      }
      touchTournament(tournament, saveState, render);
      return true;
    },
  });
}

export function attachGlobalListeners({ dismissNotification }) {
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

  const getSwissSettingsFromForm = () => {
    const scoreMode = document.getElementById("swiss-score-mode")?.value || "standard";
    const byeStrategy = document.getElementById("swiss-bye-policy")?.value || "lowest_score";
    return normalizeSwissSettings({ scoreMode, byeStrategy });
  };

  document.querySelectorAll(".tournament-type-option").forEach((button) => {
    button.addEventListener("click", () => {
      const nextType = button.dataset.tournamentType;
      uiState.setupTournamentType = nextType;
      const hiddenInput = document.getElementById("tournament-type");
      if (hiddenInput) {
        hiddenInput.value = nextType;
      }
      const swissSettingsPanel = document.getElementById("swiss-settings-panel");
      if (swissSettingsPanel) {
        swissSettingsPanel.classList.toggle("d-none", nextType !== "swiss");
      }
      if (nextType === "swiss") {
        uiState.setupSwissConfig = getSwissSettingsFromForm();
      }
      document.querySelectorAll(".tournament-type-option").forEach((option) => {
        option.classList.toggle("selected", option.dataset.tournamentType === nextType);
      });
    });
  });

  document.getElementById("setup-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("tournament-name").value.trim();
    const playerNames = parsePlayersFromText(document.getElementById("players-input").value);
    const selectedTournamentType = document.getElementById("tournament-type")?.value || uiState.setupTournamentType || "manual";
    const swissSettings = selectedTournamentType === "swiss" ? getSwissSettingsFromForm() : undefined;

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
      const updated = applyTournamentEdits(
        current,
        { name, playerNames },
        { resetRounds, tournamentType: selectedTournamentType, swissSettings }
      );
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
        tournamentType: selectedTournamentType,
        swissSettings,
      });
      state.tournaments.push(created);
      openTournamentView(created.id);
    }
    saveState();
    render();
  });
}

export function attachTournamentListeners({
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
    commitTournamentChange(tournament, saveState, render, () => {
      const draft = createRoundDraft(
        currentPlayerIds(tournament),
        tournament.tournamentType || "manual"
      );
      const stageRules = getPairingStageRules(tournament.tournamentType, tournament.rounds.length);
      if (stageRules.isLockedSwissRound) {
        const randomSeed = Date.now() + Math.floor(Math.random() * 1000000);
        const proposal = generateSwissPairingProposal({
          players: tournament.players,
          rounds: tournament.rounds,
          randomSeed,
          settings: tournament.swissSettings || normalizeSwissSettings(),
        });
        const freshSlots = createEmptyPairingSlots(tournament.players.length);
        proposal.matches.forEach((match, index) => {
          freshSlots[index].a = match.a;
          freshSlots[index].b = match.b;
        });
        draft.pairing.tables = freshSlots;
        draft.pairing.byePlayerId = proposal.byePlayerId;
        draft.autoOptions.randomSeed = randomSeed;
      }
      tournament.currentRoundDraft = draft;
    });
  });

  if (tournament.currentRoundDraft?.phase === "pairing") {
    const stageRules = getPairingStageRules(tournament.tournamentType, tournament.rounds.length);

    if (stageRules.allowManualPairing) {
      attachPairingDnD(tournament, { saveState, render });
    }

    document.getElementById("back-to-tournament")?.addEventListener("click", () => {
      if (!window.confirm(t("confirmDiscardDraft"))) {
        return;
      }
      commitTournamentChange(tournament, saveState, render, () => {
        tournament.currentRoundDraft = null;
      });
    });

    if (stageRules.allowAutoPairingTools) {
      document.getElementById("auto-mode")?.addEventListener("change", (event) => {
        const draft = tournament.currentRoundDraft;
        const nextMode = resolveAutoPairingMode(event.target.value, stageRules);
        if (!nextMode) {
          return;
        }
        commitTournamentChange(tournament, saveState, render, () => {
          draft.autoOptions.mode = nextMode;
        });
      });

      document.getElementById("try-auto-pairing")?.addEventListener("click", () => {
        const draft = tournament.currentRoundDraft;
        const selectedMode = document.getElementById("auto-mode")?.value || draft.autoOptions.mode;
        const resolvedMode = resolveAutoPairingMode(selectedMode, stageRules);
        if (!resolvedMode) {
          return;
        }
        draft.autoOptions.mode = resolvedMode;
        draft.autoOptions.byeStrategy =
          document.getElementById("auto-bye-strategy")?.value || draft.autoOptions.byeStrategy;
        draft.autoOptions.priorityOrder = document.getElementById("auto-priority-order")
          ? document.getElementById("auto-priority-order").value.split("|")
          : draft.autoOptions.priorityOrder;

        const nextRandomSeed = Date.now() + Math.floor(Math.random() * 1000000);
        draft.autoOptions.randomSeed = nextRandomSeed;

        const proposal =
          resolvedMode === "registration"
            ? generateRegistrationOrderProposal({
                rankingGroups: tournament.rankingGroups,
              })
            : generatePairingProposal({
                players: tournament.players,
                rounds: tournament.rounds,
                rankingGroups: tournament.rankingGroups,
                mode: resolvedMode,
                byeStrategy: draft.autoOptions.byeStrategy,
                priorityOrder: draft.autoOptions.priorityOrder,
                randomSeed: nextRandomSeed,
              });
        const freshSlots = createEmptyPairingSlots(tournament.players.length);
        proposal.matches.forEach((match, index) => {
          freshSlots[index].a = match.a;
          freshSlots[index].b = match.b;
        });
        commitTournamentChange(tournament, saveState, render, () => {
          draft.pairing.tables = freshSlots;
          draft.pairing.byePlayerId = proposal.byePlayerId;
        });
      });
    }

    if (stageRules.allowManualPairing) {
      document.getElementById("clear-pairing")?.addEventListener("click", () => {
        const draft = tournament.currentRoundDraft;
        commitTournamentChange(tournament, saveState, render, () => {
          draft.pairing.tables = createEmptyPairingSlots(tournament.players.length);
          draft.pairing.byePlayerId = null;
        });
      });
    }

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
      commitTournamentChange(tournament, saveState, render, () => {
        draft.phase = tournament.tournamentType === "swiss" ? "results" : "ranking";
        if (tournament.tournamentType !== "swiss") {
          normalizeDraftRanking(tournament);
        }
        if (tournament.tournamentType === "swiss") {
          draft.results = draft.pairing.tables.map((table) => ({
            a: table.a,
            b: table.b,
            winner: "",
          }));
        }
      });
    });
  }

  if (tournament.currentRoundDraft?.phase === "results") {
    document.querySelectorAll(".swiss-result-select").forEach((element) => {
      element.addEventListener("change", () => {
        const draft = tournament.currentRoundDraft;
        const index = Number(element.dataset.resultIndex);
        if (!draft || Number.isNaN(index)) {
          return;
        }
        draft.results[index] = {
          a: draft.pairing.tables[index]?.a || null,
          b: draft.pairing.tables[index]?.b || null,
          winner: element.value,
        };
        touchTournament(tournament, saveState, render);
      });
    });

    document.getElementById("back-to-pairing")?.addEventListener("click", () => {
      if (!window.confirm(t("confirmDiscardDraft"))) {
        return;
      }
      const draft = tournament.currentRoundDraft;
      commitTournamentChange(tournament, saveState, render, () => {
        draft.phase = "pairing";
      });
    });

    document.getElementById("finish-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const hasMissingResult = draft.results.some((result) => !result || !result.winner);
      if (hasMissingResult) {
        notify(t("resultRequired"), { variant: "danger" });
        return;
      }
      commitTournamentChange(tournament, saveState, render, () => {
        const nextRound = {
          byePlayerId: draft.pairing.byePlayerId || null,
          matches: draft.pairing.tables
            .filter((table) => table.a && table.b)
            .map((table) => ({ a: table.a, b: table.b })),
          results: draft.results,
          rankingGroups: [],
        };
        tournament.rounds.push(nextRound);
        tournament.rankingGroups = buildSwissRankingGroups(
          tournament.players,
          tournament.rounds,
          tournament.swissSettings || normalizeSwissSettings()
        );
        tournament.currentRoundDraft = null;
      });
      notify(t("roundSaved"), { variant: "success" });
    });
  }

  if (tournament.currentRoundDraft?.phase === "ranking") {
    attachRankingDnD(tournament, { saveState, render });

    document.getElementById("back-to-pairing")?.addEventListener("click", () => {
      if (!window.confirm(t("confirmDiscardDraft"))) {
        return;
      }
      const draft = tournament.currentRoundDraft;
      commitTournamentChange(tournament, saveState, render, () => {
        draft.phase = "pairing";
        normalizeDraftRanking(tournament);
      });
    });

    document.getElementById("reset-ranking")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      commitTournamentChange(tournament, saveState, render, () => {
        draft.rankingGroups = currentPlayerIds(tournament).map(() => []);
      });
    });

    document.getElementById("finish-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
      const flattened = flattenRankingGroups(normalized);
      if (flattened.length !== tournament.players.length) {
        notify(t("invalidRanking"), { variant: "danger" });
        return;
      }
      commitTournamentChange(tournament, saveState, render, () => {
        tournament.rounds.push({
          byePlayerId: draft.pairing.byePlayerId || null,
          matches: draft.pairing.tables.map((table) => ({ a: table.a, b: table.b })),
          rankingGroups: normalized,
        });
        tournament.rankingGroups = normalized;
        tournament.currentRoundDraft = null;
      });
      notify(t("roundSaved"), { variant: "success" });
    });
  }
}
