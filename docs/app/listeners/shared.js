import { normalizeRankingGroups } from "../../tournament-state.js";
import { currentPlayerIds } from "../renderers.js";

export function removePlayerFromPairing(draft, playerId) {
  for (const table of draft.pairing.tables) {
    if (table.a === playerId) {
      table.a = null;
    }
    if (table.b === playerId) {
      table.b = null;
    }
  }
  if (draft.pairing.byePlayerId === playerId) {
    draft.pairing.byePlayerId = null;
  }
}

export function assignPlayerToPairingTarget(draft, playerId, target) {
  removePlayerFromPairing(draft, playerId);
  if (target.type === "pool") {
    return;
  }
  if (target.type === "bye") {
    if (draft.pairing.byePlayerId) {
      removePlayerFromPairing(draft, draft.pairing.byePlayerId);
    }
    draft.pairing.byePlayerId = playerId;
    return;
  }
  const table = draft.pairing.tables[target.tableIndex];
  if (!table) {
    return;
  }
  const slotKey = target.slot;
  if (table[slotKey]) {
    removePlayerFromPairing(draft, table[slotKey]);
  }
  table[slotKey] = playerId;
}

export function removePlayerFromRankingDraft(draft, playerId) {
  for (const group of draft.rankingGroups) {
    const index = group.indexOf(playerId);
    if (index !== -1) {
      group.splice(index, 1);
    }
  }
}

export function assignPlayerToRankingGroup(draft, playerId, targetRankIndex) {
  removePlayerFromRankingDraft(draft, playerId);
  if (targetRankIndex < 0 || targetRankIndex >= draft.rankingGroups.length) {
    return;
  }
  draft.rankingGroups[targetRankIndex].push(playerId);
}

export function insertPlayerIntoRankingDraft(draft, playerId, targetRankIndex, playerIds) {
  const maxGroups = playerIds.length;
  if (targetRankIndex < 0 || targetRankIndex > maxGroups) {
    return;
  }

  const compactGroups = normalizeRankingGroups(draft.rankingGroups, playerIds)
    .map((group) => group.filter((id) => id !== playerId))
    .filter((group) => group.length > 0);

  const insertIndex = Math.min(targetRankIndex, compactGroups.length);
  compactGroups.splice(insertIndex, 0, [playerId]);

  while (compactGroups.length < maxGroups) {
    compactGroups.push([]);
  }
  draft.rankingGroups = compactGroups;
}

export function normalizeDraftRanking(tournament) {
  const draft = tournament.currentRoundDraft;
  const ids = currentPlayerIds(tournament);
  draft.rankingGroups = normalizeRankingGroups(draft.rankingGroups, ids);
  while (draft.rankingGroups.length < ids.length) {
    draft.rankingGroups.push([]);
  }
}

export function commitTournamentChange(tournament, saveState, render, mutate) {
  mutate();
  tournament.updatedAt = Date.now();
  saveState();
  render();
}

export function touchTournament(tournament, saveState, render) {
  tournament.updatedAt = Date.now();
  saveState();
  render();
}
