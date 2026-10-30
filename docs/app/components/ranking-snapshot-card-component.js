import { buildSwissStandingsData, normalizeSwissSettings } from "../../swiss.js";
import { renderPlayerChip } from "../renderers/shared-renderers.js";
import { escapeHtml } from "../utils.js";

export const rankingSnapshotCardComponent = {
  name: "ranking-snapshot-card",
  render({ props }) {
    const { tournament, t, getPlayerName } = props;

    if (tournament.tournamentType === "swiss") {
      const standings = buildSwissStandingsData(
        tournament.players,
        tournament.rounds,
        tournament.swissSettings || normalizeSwissSettings()
      );

      const rows = standings
        .map(
          (entry, index) => `
            <li class="list-group-item d-flex justify-content-between align-items-center gap-3">
              <div class="d-flex align-items-center gap-2">
                <strong>${index + 1}.</strong>
                ${renderPlayerChip(tournament, entry.id, "standings", `standing-${index}`, getPlayerName, false)}
              </div>
              <div class="d-flex align-items-center gap-2 text-end">
                <span class="badge bg-primary-subtle text-primary-emphasis">${t("points") || "Points"}: ${Number(entry.score).toFixed(1)}</span>
                <small class="text-muted">Buchholz: ${Number(entry.buchholz).toFixed(1)}</small>
              </div>
            </li>
          `
        )
        .join("");

      return `
        <div class="card shadow-sm mt-4">
          <div class="card-body">
            <h3 class="h6 mb-3">${t("rankingViewTitle")}</h3>
            <ul class="list-group">${rows}</ul>
          </div>
        </div>
      `;
    }

    const rows = tournament.rankingGroups
      .filter((group) => group.length > 0)
      .map((group, index) => {
        const players = group
          .map((playerId) => renderPlayerChip(tournament, playerId, "standings", `rank-${index}`, getPlayerName, false))
          .join("");
        return `<li class="list-group-item"><strong>${index + 1}.</strong> <span class="player-chip-list">${players}</span></li>`;
      })
      .join("");

    return `
      <div class="card shadow-sm mt-4">
        <div class="card-body">
          <h3 class="h6 mb-3">${t("rankingViewTitle")}</h3>
          <ul class="list-group">${rows}</ul>
        </div>
      </div>
    `;
  },
};
