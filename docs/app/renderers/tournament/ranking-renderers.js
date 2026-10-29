import { flattenRankingGroups } from "../../../pairing.js";
import { normalizeRankingGroups } from "../../../tournament-state.js";
import { roundStageBannerComponent } from "../../components/round-stage-banner-component.js";
import { currentPlayerIds, renderPlayerChip } from "../shared-renderers.js";

export function renderRankingDraft(tournament, t, getPlayerName) {
  const draft = tournament.currentRoundDraft;
  const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
  while (normalized.length < tournament.players.length) {
    normalized.push([]);
  }

  const allRanked = new Set(flattenRankingGroups(normalized));
  const unranked = currentPlayerIds(tournament).filter((playerId) => !allRanked.has(playerId));

  const rows = normalized
    .map((group, index) => {
      const players = group
        .map((playerId) => renderPlayerChip(tournament, playerId, "ranking", `rank-${index}`, getPlayerName))
        .join("");
      return `
        <li class="list-group-item ranking-drop-zone" data-rank-index="${index}">
          <div class="d-flex gap-2 align-items-start ranking-row-content">
            <strong class="rank-label">${index + 1}.</strong>
            <div class="player-chip-list flex-grow-1 ranking-row-slot">
              ${players || `<span class="drop-empty">${t("dropPlayer")}</span>`}
            </div>
          </div>
        </li>
      `;
    })
    .join("");

  const roundStageHeader = roundStageBannerComponent.render({
    props: {
      t,
      phase: "ranking",
      roundNumber: tournament.rounds.length + 1,
    },
  });

  return `
    ${roundStageHeader}
    <div class="card shadow-sm mt-3">
      <div class="card-body">
        <h3 class="h5 mb-2">${t("rankingViewTitle")}</h3>
        <p class="text-muted">${t("rankingHelp")}</p>
        <div class="card mb-3 ranking-unassigned-drop-zone">
          <div class="card-body">
            <h4 class="h6 mb-3">${t("rankingUnassigned")}</h4>
            <div class="player-chip-list">
              ${
                unranked
                  .map((playerId) => renderPlayerChip(tournament, playerId, "ranking", "unranked", getPlayerName))
                  .join("") || `<span class="text-muted small">${t("dropPlayer")}</span>`
              }
            </div>
          </div>
        </div>
        <ul class="list-group">${rows}</ul>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" id="back-to-pairing" class="btn btn-outline-secondary">${t(
            "backToPairing"
          )}</button>
          <button type="button" id="reset-ranking" class="btn btn-outline-warning">${t("resetRanking")}</button>
          <button type="button" id="finish-round" class="btn btn-primary">${t("finishRound")}</button>
        </div>
      </div>
    </div>
  `;
}
