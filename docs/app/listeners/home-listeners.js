import { removeTournamentFromCollection } from "../../tournament-state.js";

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
