import { createEmptyPairingSlots, flattenRankingGroups } from "./pairing.js";
import { normalizeSwissSettings } from "./swiss.js";

export const STORAGE_KEY = "fair-pair:tournaments:v4";

export const TOURNAMENT_TYPES = {
  manual: {
    id: "manual",
    label: "Manual ranking rounds",
    description: "Pair players from the current ranking and set the next order manually.",
  },
  swiss: {
    id: "swiss",
    label: "Swiss system",
    description: "Pair players by current score while avoiding rematches and tracking match results.",
  },
};

export function getTournamentTypeConfig(tournamentType) {
  return TOURNAMENT_TYPES[tournamentType] || TOURNAMENT_TYPES.manual;
}

export function getPairingStageRules(tournamentType, completedRoundsCount = 0) {
  const normalizedType = getTournamentTypeConfig(tournamentType).id;
  const roundsCount = Number.isFinite(completedRoundsCount)
    ? Math.max(0, Math.floor(completedRoundsCount))
    : 0;
  const isFirstRound = roundsCount === 0;
  const isSwissTournament = normalizedType === "swiss";
  const isLockedSwissRound = isSwissTournament && !isFirstRound;
  const allowedAutoModes = isFirstRound
    ? ["random", "registration"]
    : ["automatic", "random"];

  return {
    isFirstRound,
    isLockedSwissRound,
    allowManualPairing: !isLockedSwissRound,
    allowAutoPairingTools: !isLockedSwissRound,
    allowedAutoModes,
  };
}

export function resolveAutoPairingMode(mode, stageRules) {
  const allowedModes = stageRules?.allowedAutoModes;
  if (!Array.isArray(allowedModes) || allowedModes.length === 0) {
    return null;
  }
  if (allowedModes.includes(mode)) {
    return mode;
  }
  return allowedModes[0];
}

export function createPlayerId(index) {
  return `p${index + 1}`;
}

function normalizeHue(value) {
  const hue = Number(value);
  if (!Number.isFinite(hue)) {
    return null;
  }
  const normalized = Math.round(hue) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function sanitizeDateOfBirth(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const rawValue = `${value}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return null;
  }

  const safeDate = new Date(`${rawValue}T12:00:00`);
  if (Number.isNaN(safeDate.getTime())) {
    return null;
  }

  return rawValue;
}

export function getPlayerAge(player, referenceDate = new Date()) {
  const dateOfBirth = sanitizeDateOfBirth(player?.dateOfBirth);
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(`${dateOfBirth}T12:00:00`);
  const today = new Date(referenceDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

export function normalizePlayerEntries(playerEntries = []) {
  const entries = Array.isArray(playerEntries) ? playerEntries : [];
  return entries.map((entry, index) => {
    if (typeof entry === "string" || typeof entry === "number") {
      const name = `${entry}`.trim();
      return {
        id: createPlayerId(index),
        name: name || `Player ${index + 1}`,
        hue: createHueFromPlayerName(name || `Player ${index + 1}`, index),
        dateOfBirth: null,
      };
    }

    const rawName = `${entry?.name ?? ""}`.trim();
    const name = rawName || `Player ${index + 1}`;
    return {
      id: entry?.id || createPlayerId(index),
      name,
      hue: normalizeHue(entry?.hue) ?? createHueFromPlayerName(name, index),
      dateOfBirth: sanitizeDateOfBirth(entry?.dateOfBirth),
    };
  });
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createHueFromPlayerName(name, index) {
  const seed = `${name || "player"}-${index}`.split("").reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
  const random = createSeededRandom(seed);
  return Math.round(random() * 359);
}

function createRainbowHues(playerNames) {
  if (!Array.isArray(playerNames) || playerNames.length === 0) {
    return [];
  }

  return playerNames.map((playerName, index) => createHueFromPlayerName(playerName, index));
}

function createPlayersWithPersistentHues(playerEntries) {
  const normalizedEntries = normalizePlayerEntries(playerEntries);
  const hues = createRainbowHues(normalizedEntries.map((player) => player.name));
  return normalizedEntries.map((player, index) => ({
    ...player,
    hue: normalizeHue(player.hue) ?? hues[index],
    dateOfBirth: sanitizeDateOfBirth(player.dateOfBirth),
  }));
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

export function createRoundDraft(playerIds, tournamentType = "manual") {
  const draft = {
    phase: "pairing",
    autoOptions: {
      mode: "automatic",
      byeStrategy: "worst",
      priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
      randomSeed: 1,
    },
    pairing: {
      tables: createEmptyPairingSlots(playerIds.length),
      byePlayerId: null,
    },
    rankingGroups: createInitialRankingGroups(playerIds),
  };

  if (tournamentType === "swiss") {
    draft.results = [];
  }

  return draft;
}

export function createTournamentFromForm({
  id,
  name,
  playerNames,
  players,
  tournamentType = "manual",
  swissSettings,
}) {
  const normalizedPlayers = createPlayersWithPersistentHues(players ?? playerNames ?? []);
  const playerIds = normalizedPlayers.map((player) => player.id);
  const normalizedType = getTournamentTypeConfig(tournamentType).id;

  return {
    id,
    name,
    tournamentType: normalizedType,
    swissSettings: normalizeSwissSettings(
      normalizedType === "swiss" ? swissSettings : undefined
    ),
    players: normalizedPlayers,
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

  const nextPlayers = normalizePlayerEntries(formData.players ?? formData.playerNames ?? []);
  if (tournament.players.length !== nextPlayers.length) {
    return true;
  }

  for (let index = 0; index < tournament.players.length; index += 1) {
    const current = tournament.players[index];
    const next = nextPlayers[index];
    if (!current || !next) {
      return true;
    }
    if (current.name !== next.name || current.dateOfBirth !== next.dateOfBirth) {
      return true;
    }
  }

  return false;
}

export function applyTournamentEdits(
  tournament,
  formData,
  { resetRounds, tournamentType = tournament.tournamentType || "manual", swissSettings }
) {
  const normalizedType = getTournamentTypeConfig(tournamentType).id;
  const updated = {
    ...tournament,
    name: formData.name,
    tournamentType: normalizedType,
    swissSettings: normalizeSwissSettings(
      normalizedType === "swiss" ? swissSettings || tournament.swissSettings : undefined
    ),
    updatedAt: Date.now(),
  };
  if (!resetRounds) {
    return updated;
  }

  const players = createPlayersWithPersistentHues(formData.players ?? formData.playerNames ?? []);
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
  const legacyPlayers = tournament.players || [];
  const fallbackHues = createRainbowHues(
    legacyPlayers.map((player) => player?.name || `Player ${legacyPlayers.indexOf(player) + 1}`)
  );
  const players = legacyPlayers.map((player, index) => ({
    ...normalizePlayerEntries([player])[0],
    hue: normalizeHue(player.hue) ?? fallbackHues[index],
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

  const tournamentType = tournament.tournamentType === "swiss" ? "swiss" : "manual";

  return {
    id: tournament.id || idFallback,
    name: tournament.name || "Tournament",
    tournamentType: getTournamentTypeConfig(tournamentType).id,
    swissSettings: normalizeSwissSettings(
      tournamentType === "swiss" ? tournament.swissSettings : undefined
    ),
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
