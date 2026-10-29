function seededValue(seed) {
  let value = Number(seed) || 1;
  value = (value * 1664525 + 1013904223) >>> 0;
  return value;
}

export const DEFAULT_SWISS_SETTINGS = Object.freeze({
  scoreMode: "standard",
  winPoints: 1,
  drawPoints: 0.5,
  lossPoints: 0,
  byePoints: 1,
  byeStrategy: "lowest_score",
  tiebreaker: "buchholz",
});

export function normalizeSwissSettings(settings = {}) {
  const next = {
    ...DEFAULT_SWISS_SETTINGS,
    ...settings,
  };

  if (next.scoreMode === "double") {
    next.winPoints = 2;
    next.drawPoints = 1;
    next.lossPoints = 0;
    next.byePoints = 2;
  } else {
    next.scoreMode = "standard";
    next.winPoints = 1;
    next.drawPoints = 0.5;
    next.lossPoints = 0;
    next.byePoints = 1;
  }

  next.byeStrategy = next.byeStrategy === "random" ? "random" : "lowest_score";
  next.tiebreaker = next.tiebreaker === "buchholz" ? "buchholz" : "buchholz";

  return {
    ...next,
    winPoints: Number(next.winPoints) || 0,
    drawPoints: Number(next.drawPoints) || 0,
    lossPoints: Number(next.lossPoints) || 0,
    byePoints: Number(next.byePoints) || 0,
  };
}

function buildSwissOpponentMap(players, rounds) {
  const map = new Map();
  for (const player of players) {
    map.set(player.id, new Set());
  }
  for (const round of rounds) {
    for (const match of round.matches || []) {
      if (!match || !match.a || !match.b) {
        continue;
      }
      if (!map.has(match.a)) {
        map.set(match.a, new Set());
      }
      if (!map.has(match.b)) {
        map.set(match.b, new Set());
      }
      map.get(match.a).add(match.b);
      map.get(match.b).add(match.a);
    }
  }
  return map;
}

function countSwissResultsForPlayer(rounds, playerId) {
  let count = 0;
  for (const round of rounds) {
    const matches = round.matches || [];
    for (const match of matches) {
      if (!match) {
        continue;
      }
      if (match.a === playerId || match.b === playerId) {
        count += 1;
      }
    }
    if (round.byePlayerId === playerId) {
      count += 1;
    }
  }
  return count;
}

export function buildSwissScoreMap(players, rounds, settings = DEFAULT_SWISS_SETTINGS) {
  const swissSettings = normalizeSwissSettings(settings);
  const scoreMap = new Map();
  for (const player of players) {
    scoreMap.set(player.id, 0);
  }

  for (const round of rounds) {
    if (round.byePlayerId && scoreMap.has(round.byePlayerId)) {
      scoreMap.set(round.byePlayerId, (scoreMap.get(round.byePlayerId) || 0) + swissSettings.byePoints);
    }

    for (const result of round.results || []) {
      const { a, b, winner } = result || {};
      if (!a || !b || !scoreMap.has(a) || !scoreMap.has(b)) {
        continue;
      }
      if (winner === "draw") {
        scoreMap.set(a, (scoreMap.get(a) || 0) + swissSettings.drawPoints);
        scoreMap.set(b, (scoreMap.get(b) || 0) + swissSettings.drawPoints);
        continue;
      }
      if (winner === "a") {
        scoreMap.set(a, (scoreMap.get(a) || 0) + swissSettings.winPoints);
        scoreMap.set(b, (scoreMap.get(b) || 0) + swissSettings.lossPoints);
        continue;
      }
      if (winner === "b") {
        scoreMap.set(b, (scoreMap.get(b) || 0) + swissSettings.winPoints);
        scoreMap.set(a, (scoreMap.get(a) || 0) + swissSettings.lossPoints);
      }
    }
  }

  return scoreMap;
}

export function calculateBuchholzScore(players, rounds, playerId, settings = DEFAULT_SWISS_SETTINGS) {
  const swissSettings = normalizeSwissSettings(settings);
  const scoreMap = buildSwissScoreMap(players, rounds, swissSettings);
  const opponentIds = new Set();

  for (const round of rounds) {
    for (const match of round.matches || []) {
      if (!match) {
        continue;
      }
      if (match.a === playerId) {
        opponentIds.add(match.b);
      }
      if (match.b === playerId) {
        opponentIds.add(match.a);
      }
    }
  }

  let total = 0;
  for (const opponentId of opponentIds) {
    total += scoreMap.get(opponentId) || 0;
  }
  return total;
}

export function buildSwissStandingsData(players, rounds, settings = DEFAULT_SWISS_SETTINGS) {
  const swissSettings = normalizeSwissSettings(settings);
  const scoreMap = buildSwissScoreMap(players, rounds, swissSettings);
  const nameMap = new Map(players.map((player) => [player.id, player.name || player.id]));

  return [...players]
    .map((player) => ({
      playerId: player.id,
      name: player.name || player.id,
      score: scoreMap.get(player.id) || 0,
      buchholz: calculateBuchholzScore(players, rounds, player.id, swissSettings),
      played: countSwissResultsForPlayer(rounds, player.id),
    }))
    .sort((left, right) => {
      const scoreDiff = (right.score || 0) - (left.score || 0);
      if (scoreDiff !== 0) {
        return scoreDiff > 0 ? 1 : -1;
      }
      const buchholzDiff = (right.buchholz || 0) - (left.buchholz || 0);
      if (buchholzDiff !== 0) {
        return buchholzDiff > 0 ? 1 : -1;
      }
      return (nameMap.get(left.playerId) || left.playerId).localeCompare(
        nameMap.get(right.playerId) || right.playerId
      );
    });
}

export function buildSwissStandings(players, rounds, settings = DEFAULT_SWISS_SETTINGS) {
  return buildSwissStandingsData(players, rounds, settings).map((entry) => entry.playerId);
}

export function buildSwissRankingGroups(players, rounds, settings = DEFAULT_SWISS_SETTINGS) {
  const standings = buildSwissStandingsData(players, rounds, settings);
  if (standings.length === 0) {
    return [];
  }

  const groups = [];
  let currentGroup = [];
  let currentScore = null;

  for (const entry of standings) {
    if (currentScore === null) {
      currentScore = entry.score;
    }
    if (entry.score !== currentScore) {
      groups.push(currentGroup);
      currentGroup = [];
      currentScore = entry.score;
    }
    currentGroup.push(entry.playerId);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function selectSwissByePlayer({ eligiblePlayerIds, scoreMap, randomSeed, byeStrategy }) {
  if (eligiblePlayerIds.length === 0) {
    return null;
  }

  if (byeStrategy === "random") {
    const safeSeed = Number(randomSeed) || 1;
    const index = Math.abs(seededValue(safeSeed + 17)) % eligiblePlayerIds.length;
    return eligiblePlayerIds[index];
  }

  const sorted = eligiblePlayerIds.slice().sort((leftId, rightId) => {
    const scoreDiff = (scoreMap.get(leftId) || 0) - (scoreMap.get(rightId) || 0);
    if (scoreDiff !== 0) {
      return scoreDiff < 0 ? -1 : 1;
    }
    return leftId.localeCompare(rightId);
  });

  return sorted[0];
}

export function generateSwissPairingProposal({
  players,
  rounds = [],
  randomSeed = 1,
  settings = DEFAULT_SWISS_SETTINGS,
}) {
  const swissSettings = normalizeSwissSettings(settings);
  const scoreMap = buildSwissScoreMap(players, rounds, swissSettings);
  const opponentMap = buildSwissOpponentMap(players, rounds);
  const playerIds = buildSwissStandings(players, rounds, swissSettings);

  let seed = Number(randomSeed) || 1;
  const queue = playerIds.slice();
  const matches = [];

  while (queue.length >= 2) {
    const currentId = queue.shift();
    let bestCandidate = null;
    let bestCandidateIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < queue.length; index += 1) {
      const candidateId = queue[index];
      const rematchPenalty = opponentMap.get(currentId)?.has(candidateId) ? 1000 : 0;
      const scoreGap = Math.abs((scoreMap.get(currentId) || 0) - (scoreMap.get(candidateId) || 0));
      const candidateScore = rematchPenalty + scoreGap;
      const shouldReplace =
        candidateScore < bestScore ||
        (candidateScore === bestScore && ((seededValue(seed + index + 1) & 1) === 0));
      if (shouldReplace) {
        bestCandidate = candidateId;
        bestCandidateIndex = index;
        bestScore = candidateScore;
      }
      seed = seededValue(seed + index + 1);
    }

    if (!bestCandidate) {
      bestCandidate = queue.shift();
    } else {
      queue.splice(bestCandidateIndex, 1);
    }

    matches.push({ a: currentId, b: bestCandidate });
  }

  const byePlayerId = queue.length === 1 ? selectSwissByePlayer({
    eligiblePlayerIds: queue.slice(),
    scoreMap,
    randomSeed: seed,
    byeStrategy: swissSettings.byeStrategy,
  }) : null;

  return {
    byePlayerId,
    matches,
  };
}
