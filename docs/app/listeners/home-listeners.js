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
  openConfirmDialog,
}) {
  document.getElementById("add-tournament")?.addEventListener("click", () => {
    openSetupView("create");
    render();
  });
  document.getElementById("reset-all")?.addEventListener("click", () => {
    openConfirmDialog({
      title: t("resetAll"),
      message: t("confirmResetAll"),
      confirmLabel: t("resetAll"),
      onConfirm: () => {
        state.tournaments = [];
        selectTournament(null);
        openHomeView();
        saveState();
        render();
      },
    });
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
      openConfirmDialog({
        title: t("deleteTournament"),
        message: t("confirmDeleteTournament"),
        confirmLabel: t("deleteTournament"),
        onConfirm: () => {
          const updated = removeTournamentFromCollection(
            state.tournaments,
            button.dataset.id,
            state.selectedTournamentId
          );
          state.tournaments = updated.tournaments;
          selectTournament(updated.selectedTournamentId);
          saveState();
          render();
        },
      });
    });
  });
}
