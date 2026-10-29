import { roundStageBannerComponent } from "../../components/round-stage-banner-component.js";
import { swissResultsTableListComponent } from "../../components/swiss-results-table-list-component.js";

export function renderSwissResultsDraft(tournament, t, getPlayerName) {
  const draft = tournament.currentRoundDraft;
  const rows = swissResultsTableListComponent.render({
    props: { draft, t, getPlayerName, tournament },
  });

  const roundStageHeader = roundStageBannerComponent.render({
    props: {
      t,
      phase: "pairing",
      roundNumber: tournament.rounds.length + 1,
    },
  });

  return `
    ${roundStageHeader}
    <div class="card shadow-sm mt-3">
      <div class="card-body">
        <h3 class="h5 mb-3">${t("nextStepResults")}</h3>
        ${rows}
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" id="back-to-pairing" class="btn btn-outline-secondary">${t(
            "backToPairing"
          )}</button>
          <button type="button" id="finish-round" class="btn btn-primary">${t("finishRound")}</button>
        </div>
      </div>
    </div>
  `;
}
