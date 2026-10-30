import { normalizeSwissSettings } from "../../swiss.js";
import {
  applyTournamentEdits,
  createTournamentFromForm,
  needsRoundReset,
  normalizePlayerEntries,
} from "../../tournament-state.js";
import { createTournamentId, parseImportedPlayersText } from "../utils.js";

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
  openConfirmDialog,
}) {
  const getSetupPlayers = () =>
    Array.isArray(uiState.setupPlayers) ? normalizePlayerEntries(uiState.setupPlayers) : [];

  const resetPlayerModal = () => {
    const modal = document.getElementById("player-modal");
    if (modal) {
      const form = document.getElementById("player-modal-form");
      if (form) {
        form.reset();
      }
      document.getElementById("player-modal-index").value = "-1";
    }
  };

  const openPlayerModal = (playerIndex = -1) => {
    const modal = document.getElementById("player-modal");
    const indexInput = document.getElementById("player-modal-index");
    const nameInput = document.getElementById("player-name");
    const dateInput = document.getElementById("player-date-of-birth");
    const players = getSetupPlayers();
    const player = Number.isInteger(playerIndex) && playerIndex >= 0 ? players[playerIndex] : null;

    if (indexInput) {
      indexInput.value = String(playerIndex);
    }
    if (nameInput) {
      nameInput.value = player?.name || "";
    }
    if (dateInput) {
      dateInput.value = player?.dateOfBirth || "";
    }
    if (window.bootstrap?.Modal) {
      const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modal);
      modalInstance.show();
    }
  };

  const closePlayerModal = () => {
    if (window.bootstrap?.Modal) {
      const modal = document.getElementById("player-modal");
      const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modal);
      modalInstance.hide();
    }
    resetPlayerModal();
  };

  const openImportPlayersModal = () => {
    const modal = document.getElementById("import-players-modal");
    if (window.bootstrap?.Modal) {
      const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modal);
      modalInstance.show();
    }
  };

  const closeImportPlayersModal = () => {
    if (window.bootstrap?.Modal) {
      const modal = document.getElementById("import-players-modal");
      const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modal);
      modalInstance.hide();
    }
    const textInput = document.getElementById("import-players-text");
    if (textInput) {
      textInput.value = "";
    }
  };

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

  document.getElementById("add-player-button")?.addEventListener("click", () => {
    openPlayerModal(-1);
  });

  document.getElementById("import-players-button")?.addEventListener("click", () => {
    openImportPlayersModal();
  });

  document.querySelectorAll(".edit-player-button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.playerIndex);
      openPlayerModal(index);
    });
  });

  document.querySelectorAll(".delete-player-button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.playerIndex);
      uiState.setupPlayers = getSetupPlayers().filter((_, currentIndex) => currentIndex !== index);
      render();
    });
  });

  document.getElementById("player-modal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const players = getSetupPlayers();
    const name = document.getElementById("player-name")?.value.trim();
    const dateOfBirth = document.getElementById("player-date-of-birth")?.value || null;
    const playerIndex = Number(document.getElementById("player-modal-index")?.value || -1);

    if (!name) {
      notify(t("setupRequired"), { variant: "danger" });
      return;
    }

    const duplicateCheck = players
      .filter((_, currentIndex) => currentIndex !== playerIndex)
      .map((player) => player.name.toLowerCase());
    if (duplicateCheck.includes(name.toLowerCase())) {
      notify(t("duplicatesPlayers"), { variant: "danger" });
      return;
    }

    const nextPlayer = {
      ...(playerIndex >= 0 ? players[playerIndex] : {}),
      id: playerIndex >= 0 ? players[playerIndex].id : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      dateOfBirth,
    };

    if (playerIndex >= 0) {
      players[playerIndex] = nextPlayer;
    } else {
      players.push(nextPlayer);
    }

    uiState.setupPlayers = normalizePlayerEntries(players);
    closePlayerModal();
    render();
  });

  document.getElementById("player-modal")?.addEventListener("hidden.bs.modal", () => {
    resetPlayerModal();
  });

  document.getElementById("import-players-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const importedPlayers = parseImportedPlayersText(
      document.getElementById("import-players-text")?.value || ""
    );

    if (importedPlayers.length === 0) {
      notify(t("setupRequired"), { variant: "danger" });
      return;
    }

    const currentPlayers = getSetupPlayers();
    const duplicates = new Set(currentPlayers.map((player) => player.name.toLowerCase()));
    const nextPlayers = [...currentPlayers];

    for (const player of importedPlayers) {
      if (!player.name || !player.name.trim()) {
        continue;
      }
      const normalizedName = player.name.trim();
      if (duplicates.has(normalizedName.toLowerCase())) {
        notify(t("duplicatesPlayers"), { variant: "danger" });
        return;
      }
      duplicates.add(normalizedName.toLowerCase());
      nextPlayers.push({
        id: `player-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: normalizedName,
        dateOfBirth: player.dateOfBirth || null,
      });
    }

    uiState.setupPlayers = normalizePlayerEntries(nextPlayers);
    closeImportPlayersModal();
    render();
  });

  document.getElementById("setup-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("tournament-name").value.trim();
    const players = getSetupPlayers();
    const playerNames = players.map((player) => player.name);
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
      const resetRounds = needsRoundReset(current, { name, players });
      if (resetRounds && (current.rounds.length > 0 || current.currentRoundDraft)) {
        openConfirmDialog({
          title: t("setupTitleEdit"),
          message: t("confirmSetupChange"),
          confirmLabel: t("updateTournament"),
          onConfirm: () => {
            const updated = applyTournamentEdits(
              current,
              { name, players },
              { resetRounds, tournamentType: selectedTournamentType, swissSettings }
            );
            state.tournaments = state.tournaments.map((item) => (item.id === updated.id ? updated : item));
            selectTournament(updated.id);
            if (uiState.setupReturnView === "tournament") {
              uiState.view = "tournament";
            } else {
              openHomeView();
            }
            saveState();
            render();
          },
        });
        return;
      }
      const updated = applyTournamentEdits(
        current,
        { name, players },
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
        players,
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
