import { renderPlayerChip } from "../renderers/shared-renderers.js";

export const swissResultsTableListComponent = {
  name: "swiss-results-table-list",
  render({ props }) {
    const { draft, t, getPlayerName, tournament } = props;
    const tableResults = draft.results || [];

    return draft.pairing.tables
      .map((table, index) => {
        if (!table.a || !table.b) {
          return "";
        }

        const currentResult = tableResults[index] || { winner: "" };
        const buttonA = currentResult.winner === "a" ? "selected" : "";
        const buttonB = currentResult.winner === "b" ? "selected" : "";
        const buttonDraw = currentResult.winner === "draw" ? "selected" : "";
        const playerAName = getPlayerName(tournament, table.a);
        const playerBName = getPlayerName(tournament, table.b);
        const playerAResultLabel = `${playerAName} ${t("resultWinA")}`;
        const playerBResultLabel = `${playerBName} ${t("resultWinB")}`;
        const playerAChip = renderPlayerChip(tournament, table.a, "results", `result-${index}-a`, getPlayerName, false);
        const playerBChip = renderPlayerChip(tournament, table.b, "results", `result-${index}-b`, getPlayerName, false);

        return `
          <div class="card mb-3">
            <div class="card-body">
              <h4 class="h6 mb-3">${t("tables")} #${table.tableNumber}</h4>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                ${playerAChip}
                <span class="fw-semibold text-muted">vs</span>
                ${playerBChip}
              </div>
              <div>
                <select class="form-select swiss-result-select" data-result-index="${index}">
                  <option value="">${t("resultSelect")}</option>
                  <option value="a" ${buttonA ? "selected" : ""}>${playerAResultLabel}</option>
                  <option value="b" ${buttonB ? "selected" : ""}>${playerBResultLabel}</option>
                  <option value="draw" ${buttonDraw ? "selected" : ""}>${t("resultDraw")}</option>
                </select>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  },
};
