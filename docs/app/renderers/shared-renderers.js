import { PRIORITY_ORDERS } from "../constants.js";
import { playerChipComponent } from "../components/player-chip-component.js";
import { escapeHtml } from "../utils.js";

export function getPriorityLabel(priorityOrder, language, t) {
  const labels = priorityOrder.map((value) => {
    if (value === "avoid_rematch") {
      return language === "fr" ? "éviter les rematches" : "avoid rematch";
    }
    if (value === "minimize_gap") {
      return language === "fr" ? "minimiser l'écart de rang" : "minimize ranking gap";
    }
    return language === "fr" ? "équité BYE" : "bye fairness";
  });

  const combined = labels.join(" → ");
  const map = {
    "avoid rematch → minimize ranking gap → bye fairness": "priorityAvoidRematch",
    "avoid rematch → bye fairness → minimize ranking gap": "priorityAvoidRematchByeFirst",
    "minimize ranking gap → avoid rematch → bye fairness": "priorityGapFirst",
    "minimize ranking gap → bye fairness → avoid rematch": "priorityGapByeFirst",
    "bye fairness → avoid rematch → minimize ranking gap": "priorityByeFirst",
    "bye fairness → minimize ranking gap → avoid rematch": "priorityByeGapFirst",
    "éviter les rematches → minimiser l'écart de rang → équité BYE": "priorityAvoidRematch",
    "éviter les rematches → équité BYE → minimiser l'écart de rang": "priorityAvoidRematchByeFirst",
    "minimiser l'écart de rang → éviter les rematches → équité BYE": "priorityGapFirst",
    "minimiser l'écart de rang → équité BYE → éviter les rematches": "priorityGapByeFirst",
    "équité BYE → éviter les rematches → minimiser l'écart de rang": "priorityByeFirst",
    "équité BYE → minimiser l'écart de rang → éviter les rematches": "priorityByeGapFirst",
  };

  const translatedKey = map[combined];
  if (!translatedKey) {
    return combined;
  }

  return t(translatedKey);
}

export function currentPlayerIds(tournament) {
  return tournament.players.map((player) => player.id);
}

function getPairingAssignedIds(draft) {
  const assigned = [];
  for (const table of draft.pairing.tables) {
    if (table.a) {
      assigned.push(table.a);
    }
    if (table.b) {
      assigned.push(table.b);
    }
  }
  if (draft.pairing.byePlayerId) {
    assigned.push(draft.pairing.byePlayerId);
  }
  return assigned;
}

export function getPairingUnassignedIds(tournament) {
  const draft = tournament.currentRoundDraft;
  const assignedSet = new Set(getPairingAssignedIds(draft));
  return currentPlayerIds(tournament).filter((id) => !assignedSet.has(id));
}

export function renderPlayerChip(
  tournament,
  playerId,
  dragType,
  origin,
  getPlayerName,
  isDraggable = true
) {
  return playerChipComponent.render({
    props: {
      tournament,
      playerId,
      dragType,
      origin,
      getPlayerName,
      isDraggable,
    },
  });
}

export function buildPriorityOptions(priorityValue, language, t) {
  return PRIORITY_ORDERS.map(
    (order) =>
      `<option value="${order.join("|")}" ${
        order.join("|") === priorityValue ? "selected" : ""
      }>${escapeHtml(getPriorityLabel(order, language, t))}</option>`
  ).join("");
}
