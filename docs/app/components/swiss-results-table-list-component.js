import { escapeHtml } from "../utils.js";

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
        const playerAName = escapeHtml(getPlayerName(tournament, table.a));
        const playerBName = escapeHtml(getPlayerName(tournament, table.b));
        const playerAResultLabel = `${playerAName} ${t("resultWinA")}`;
        const playerBResultLabel = `${playerBName} ${t("resultWinB")}`;

        return `
          <div class="card mb-3">
            <div class="card-body">
              <h4 class="h6 mb-3">${t("tables")} #${table.tableNumber}</h4>
              <div class="d-flex flex-column flex-md-row gap-2">
                <div class="fw-semibold">${playerAName}</div>
                <div class="fw-semibold">vs</div>
                <div class="fw-semibold">${playerBName}</div>
              </div>
              <div class="mt-3">
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
