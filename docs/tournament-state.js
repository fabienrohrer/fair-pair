export const STORAGE_KEY = "fair-pair:tournaments:v2";

export function createPlayerId(index) {
  return `p${index + 1}`;
}

export function createTournamentFromForm({ id, name, pairingMode, byeStrategy, playerNames }) {
  return {
    id,
    name,
    settings: {
      pairingMode,
      byeStrategy,
    },
    players: playerNames.map((playerName, index) => ({
      id: createPlayerId(index),
      name: playerName,
    })),
    rounds: [],
    rankingOrder: playerNames.map((_, index) => createPlayerId(index)),
    editRoundIndex: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function needsRoundReset(tournament, formData) {
  if (!tournament) {
    return false;
  }
  if (tournament.settings.pairingMode !== formData.pairingMode) {
    return true;
  }
  if (tournament.settings.byeStrategy !== formData.byeStrategy) {
    return true;
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
    settings: {
      pairingMode: formData.pairingMode,
      byeStrategy: formData.byeStrategy,
    },
    updatedAt: Date.now(),
  };
  if (!resetRounds) {
    return updated;
  }
  return {
    ...updated,
    players: formData.playerNames.map((playerName, index) => ({
      id: createPlayerId(index),
      name: playerName,
    })),
    rounds: [],
    rankingOrder: formData.playerNames.map((_, index) => createPlayerId(index)),
    editRoundIndex: null,
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

export function migrateLoadedState(parsedState, defaultLanguage) {
  if (!parsedState || typeof parsedState !== "object") {
    return createInitialState(defaultLanguage);
  }
  if (Array.isArray(parsedState.tournaments)) {
    return {
      language: parsedState.language === "fr" ? "fr" : "en",
      selectedTournamentId: parsedState.selectedTournamentId || null,
      tournaments: parsedState.tournaments,
    };
  }
  if (parsedState.tournament) {
    const migratedTournament = {
      ...parsedState.tournament,
      id: "legacy-1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      language: parsedState.language === "fr" ? "fr" : "en",
      selectedTournamentId: migratedTournament.id,
      tournaments: [migratedTournament],
    };
  }
  return createInitialState(defaultLanguage);
}
