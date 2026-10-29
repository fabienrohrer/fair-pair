import { rankingSnapshotCardComponent } from "../../components/ranking-snapshot-card-component.js";
import { roundHistoryCardComponent } from "../../components/round-history-card-component.js";
import { escapeHtml } from "../../utils.js";

function renderRoundHistory(tournament, t, getPlayerName) {
  if (tournament.rounds.length === 0) {
    return "";
  }
  const rows = tournament.rounds
    .map((round, index) => {
      const matchesText = round.matches
        .map((match) => `${getPlayerName(tournament, match.a)} vs ${getPlayerName(tournament, match.b)}`)
        .join(" · ");
      const byeText = round.byePlayerId
        ? ` — ${t("byeSlot")}: ${getPlayerName(tournament, round.byePlayerId)}`
        : "";
      return `<li class="list-group-item">#${index + 1} — ${escapeHtml(matchesText + byeText)}</li>`;
    })
    .join("");
  return roundHistoryCardComponent.render({
    props: {
      t,
      rowsContent: rows,
    },
  });
}

export function renderTournamentOverview({
  tournament,
  t,
  getPlayerName,
  tournamentRoundIntroContent = "",
}) {
  return `
    ${tournamentRoundIntroContent}
    ${rankingSnapshotCardComponent.render({ props: { tournament, t, getPlayerName } })}
    ${renderRoundHistory(tournament, t, getPlayerName)}
  `;
}
