import { escapeHtml } from "../utils.js";

export function renderHomeView({
  state,
  t,
  homeHeroContent = "",
  homeToolbarContent = "",
  homeEmptyStateContent = "",
}) {
  const cards = state.tournaments
    .map((tournament) => {
      const selected = tournament.id === state.selectedTournamentId;
      const footer = selected
        ? `
          <div class="card-footer border-top-0 pt-0">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-primary open-tournament" data-id="${escapeHtml(
                tournament.id
              )}">${t("openTournament")}</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-tournament" data-id="${escapeHtml(
                tournament.id
              )}">${t("deleteTournament")}</button>
            </div>
          </div>
        `
        : "";
      const tournamentTypeLabel =
        tournament.tournamentType === "swiss"
          ? t("tournamentTypeSwiss")
          : t("tournamentTypeManual");

      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 tournament-tile ${selected ? "tournament-tile-selected" : ""}">
            <button class="card-body text-start tournament-tile-select" type="button" data-id="${escapeHtml(
              tournament.id
            )}">
              <h3 class="h6 mb-2">${escapeHtml(tournament.name)}</h3>
              <p class="small text-muted mb-1">${t("playersCount")}: ${tournament.players.length}</p>
              <p class="small text-muted mb-1">${t("tournamentType")}: ${tournamentTypeLabel}</p>
              <p class="small text-muted mb-0">${t("roundsCount")}: ${tournament.rounds.length}</p>
            </button>
            ${footer}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    ${homeHeroContent}
    <section>
      ${homeToolbarContent}
      ${
        cards
          ? `<div class="row g-3">${cards}</div>`
          : homeEmptyStateContent || `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`
      }
    </section>
  `;
}
