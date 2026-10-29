export const pairingToolsPanelComponent = {
  name: "pairing-tools-panel",
  render({ props }) {
    const {
      t,
      isSwissTournament,
      allowAutoPairingTools,
      modeOptions,
      automaticSettings,
      allowManualPairing,
    } = props;

    if (!allowAutoPairingTools) {
      return `<div class="alert alert-info mt-4 mb-0">${t("swissPairingLocked")}</div>`;
    }

    return `
      <div class="card mt-4 auto-pairing-panel">
        <div class="card-body">
          <h4 class="h6 mb-3">${isSwissTournament ? t("swissPairing") : t("automaticPairing")}</h4>
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">${t("mode")}</label>
              <select id="auto-mode" class="form-select">
                ${modeOptions}
              </select>
            </div>
          </div>
          ${automaticSettings}
          <div class="d-flex gap-2 mt-3">
            <button type="button" id="try-auto-pairing" class="btn btn-outline-primary">${t("tryAutoPairing")}</button>
            ${
              allowManualPairing
                ? `<button type="button" id="clear-pairing" class="btn btn-outline-secondary">${t("clearPairing")}</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  },
};
