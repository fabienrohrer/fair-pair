export const tournamentEmptyStateComponent = {
  name: "tournament-empty-state",
  render({ props }) {
    return `<div class="alert alert-light border">${props.t("noTournamentsYet")}</div>`;
  },
};
