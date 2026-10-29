export const homeEmptyStateComponent = {
  name: "home-empty-state",
  render({ props }) {
    return `<div class="alert alert-light border">${props.t("noTournamentsYet")}</div>`;
  },
};
