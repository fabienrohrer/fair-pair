import { createEmptyPairingSlots, flattenRankingGroups } from "./pairing.js";

export const STORAGE_KEY = "fair-pair:tournaments:v3";

export function createPlayerId(index) {
  return `p${index + 1}`;
}

export function createInitialRankingGroups(playerIds) {
  return playerIds.map((id) => [id]);
}

export function normalizeRankingGroups(rankingGroups, playerIds) {
  const known = new Set(playerIds);
  const seen = new Set();
  const normalized = [];

  for (const group of rankingGroups) {
    const nextGroup = [];
    for (const playerId of group) {
      if (!known.has(playerId) || seen.has(playerId)) {
        continue;
      }
      seen.add(playerId);
      nextGroup.push(playerId);
    }
    if (nextGroup.length > 0) {
      normalized.push(nextGroup);
    }
  }

  for (const playerId of playerIds) {
    if (!seen.has(playerId)) {
      normalized.push([playerId]);
    }
  }
  return normalized;
}

export function createRoundDraft(playerIds) {
  return {
    phase: "pairing",
    autoOptions: {
      mode: "automatic",
      byeStrategy: "worst",
      priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    },
    pairing: {
      tables: createEmptyPairingSlots(playerIds.length),
      byePlayerId: null,
    },
    rankingGroups: createInitialRankingGroups(playerIds),
  };
}

export function createTournamentFromForm({ id, name, playerNames }) {
  const players = playerNames.map((playerName, index) => ({
    id: createPlayerId(index),
    name: playerName,
  }));
  const playerIds = players.map((player) => player.id);

  return {
    id,
    name,
    players,
    rounds: [],
    rankingGroups: createInitialRankingGroups(playerIds),
    currentRoundDraft: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function needsRoundReset(tournament, formData) {
  if (!tournament) {
    return false;
  }
  if (tournament.players.length !== formData.playerNames.length) {
    return true;
  }
  for (let index = 0; index < tournament.players.length; index += 1) {
    if (tournament.players[index].name !== formData.playerNames[index]) {
      return true;
    }
  }
  return false;
}

export function applyTournamentEdits(tournament, formData, { resetRounds }) {
  const updated = {
    ...tournament,
    name: formData.name,
    updatedAt: Date.now(),
  };
  if (!resetRounds) {
    return updated;
  }

  const players = formData.playerNames.map((playerName, index) => ({
    id: createPlayerId(index),
    name: playerName,
  }));
  const playerIds = players.map((player) => player.id);
  return {
    ...updated,
    players,
    rounds: [],
    rankingGroups: createInitialRankingGroups(playerIds),
    currentRoundDraft: null,
  };
}

export function createInitialState(language) {
  return {
    language,
    selectedTournamentId: null,
    tournaments: [],
  };
}

export function selectDefaultTournamentId(tournaments, preferredId) {
  if (preferredId && tournaments.some((item) => item.id === preferredId)) {
    return preferredId;
  }
  return tournaments[0]?.id || null;
}

export function removeTournamentFromCollection(tournaments, tournamentId, selectedTournamentId) {
  const nextTournaments = tournaments.filter((item) => item.id !== tournamentId);
  const nextSelectedTournamentId =
    selectedTournamentId === tournamentId
      ? selectDefaultTournamentId(nextTournaments, null)
      : selectDefaultTournamentId(nextTournaments, selectedTournamentId);
  return {
    tournaments: nextTournaments,
    selectedTournamentId: nextSelectedTournamentId,
  };
}

function migrateLegacyRound(round) {
  return {
    byePlayerId: round.byePlayerId || null,
    matches: (round.matches || []).map((match) => ({ a: match.a, b: match.b })),
    rankingGroups: [],
  };
}

function migrateLegacyTournament(tournament, idFallback = "legacy-1") {
  const players = (tournament.players || []).map((player, index) => ({
    id: player.id || createPlayerId(index),
    name: player.name || `Player ${index + 1}`,
  }));
  const playerIds = players.map((player) => player.id);
  const baseRanking =
    Array.isArray(tournament.rankingGroups) && tournament.rankingGroups.length > 0
      ? normalizeRankingGroups(tournament.rankingGroups, playerIds)
      : Array.isArray(tournament.rankingOrder) && tournament.rankingOrder.length > 0
        ? normalizeRankingGroups(tournament.rankingOrder.map((id) => [id]), playerIds)
        : createInitialRankingGroups(playerIds);

  const rounds = Array.isArray(tournament.rounds)
    ? tournament.rounds.map((round) =>
        round.rankingGroups
          ? {
              byePlayerId: round.byePlayerId || null,
              matches: (round.matches || []).map((match) => ({ a: match.a, b: match.b })),
              rankingGroups: normalizeRankingGroups(round.rankingGroups, playerIds),
            }
          : migrateLegacyRound(round)
      )
    : [];

  const lastRanking =
    rounds.length > 0 && rounds[rounds.length - 1].rankingGroups.length > 0
      ? rounds[rounds.length - 1].rankingGroups
      : baseRanking;

  return {
    id: tournament.id || idFallback,
    name: tournament.name || "Tournament",
    players,
    rounds,
    rankingGroups: normalizeRankingGroups(lastRanking, playerIds),
    currentRoundDraft: null,
    createdAt: tournament.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

export function migrateLoadedState(parsedState, defaultLanguage) {
  if (!parsedState || typeof parsedState !== "object") {
    return createInitialState(defaultLanguage);
  }

  if (Array.isArray(parsedState.tournaments)) {
    const tournaments = parsedState.tournaments.map((item, index) =>
      migrateLegacyTournament(item, `migrated-${index + 1}`)
    );
    return {
      language: parsedState.language === "fr" ? "fr" : "en",
      selectedTournamentId: selectDefaultTournamentId(
        tournaments,
        parsedState.selectedTournamentId || null
      ),
      tournaments,
    };
  }

  if (parsedState.tournament) {
    const migratedTournament = migrateLegacyTournament(parsedState.tournament, "legacy-1");
    return {
      language: parsedState.language === "fr" ? "fr" : "en",
      selectedTournamentId: migratedTournament.id,
      tournaments: [migratedTournament],
    };
  }
  return createInitialState(defaultLanguage);
}

export function rankingGroupsToOrder(rankingGroups) {
  return flattenRankingGroups(rankingGroups);
}
