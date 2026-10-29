import { normalizeSwissSettings } from "../../swiss.js";
import {
  applyTournamentEdits,
  createTournamentFromForm,
  needsRoundReset,
} from "../../tournament-state.js";
import { createTournamentId, parsePlayersFromText } from "../utils.js";

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
