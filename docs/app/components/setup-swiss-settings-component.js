export const setupSwissSettingsComponent = {
  name: "setup-swiss-settings",
  render({ props }) {
    const { t, swissSettingsVisible, swissSettings } = props;
    return `
      <div id="swiss-settings-panel" class="card border-0 bg-transparent ${swissSettingsVisible ? "" : "d-none"}">
        <div class="card-body px-0 pb-0">
          <h3 class="h6 mb-3">${t("swissOptions")}</h3>
          <div class="row g-3">
            <div class="col-12 col-md-5">
              <label for="swiss-score-mode" class="form-label">${t("swissScoring")}</label>
              <select id="swiss-score-mode" class="form-select">
                <option value="standard" ${swissSettings.scoreMode === "standard" ? "selected" : ""}>${t(
                  "swissScoringStandard"
                )}</option>
                <option value="double" ${swissSettings.scoreMode === "double" ? "selected" : ""}>${t(
                  "swissScoringDouble"
                )}</option>
              </select>
            </div>
            <div class="col-12 col-md-4">
              <label for="swiss-bye-policy" class="form-label">${t("swissByePolicy")}</label>
              <select id="swiss-bye-policy" class="form-select">
                <option value="lowest_score" ${swissSettings.byeStrategy === "lowest_score" ? "selected" : ""}>${t(
                  "swissByeLowest"
                )}</option>
                <option value="random" ${swissSettings.byeStrategy === "random" ? "selected" : ""}>${t(
                  "swissByeRandom"
                )}</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">${t("swissTiebreaker")}</label>
              <div class="form-control-plaintext text-muted pt-2">${t("swissTiebreakerBuchholz")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
};
