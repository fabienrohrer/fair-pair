import { renderPairingDraft } from "./pairing-renderers.js";
import { renderRankingDraft } from "./ranking-renderers.js";
import { renderSwissResultsDraft } from "./results-renderers.js";
import { renderTournamentOverview } from "./overview-renderers.js";

export function renderTournamentView({
  getCurrentTournament,
  state,
  t,
  getPlayerName,
  tournamentHeaderContent = "",
  tournamentRoundIntroContent = "",
  tournamentEmptyStateContent = "",
}) {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return tournamentEmptyStateContent || `<div class="alert alert-light border">${t("noTournamentsYet")}</div>`;
  }

  let content = "";
  if (!tournament.currentRoundDraft) {
    content = renderTournamentOverview({
      tournament,
      t,
      getPlayerName,
      tournamentRoundIntroContent,
    });
  } else if (tournament.currentRoundDraft.phase === "pairing") {
    content = renderPairingDraft(tournament, state, t, getPlayerName);
  } else if (tournament.currentRoundDraft.phase === "results") {
    content = renderSwissResultsDraft(tournament, t, getPlayerName);
  } else {
    content = renderRankingDraft(tournament, t, getPlayerName);
  }

  return `
    <section>
      ${tournamentHeaderContent}
      ${content}
    </section>
  `;
}
