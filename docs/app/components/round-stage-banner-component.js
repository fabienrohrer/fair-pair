export const roundStageBannerComponent = {
  name: "round-stage-banner",
  render({ props }) {
    const { t, roundNumber, phase } = props;
    const stepLabel = phase === "ranking" ? t("stepRanking") : t("stepPairing");

    return `
      <div class="round-stage-banner mt-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <div class="round-stage-kicker text-uppercase">${t("currentRound")}</div>
            <h2 class="round-stage-title mb-0">#${roundNumber} — ${stepLabel}</h2>
          </div>
        </div>
      </div>
    `;
  },
};
