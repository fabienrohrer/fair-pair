export const roundHistoryCardComponent = {
  name: "round-history-card",
  render({ props }) {
    const { t, rowsContent } = props;
    return `
      <div class="card shadow-sm mt-4">
        <div class="card-body">
          <h3 class="h6 mb-3">${t("roundHistory")}</h3>
          <ul class="list-group">${rowsContent}</ul>
        </div>
      </div>
    `;
  },
};
