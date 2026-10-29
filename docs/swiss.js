function seededValue(seed) {
  let value = Number(seed) || 1;
  value = (value * 1664525 + 1013904223) >>> 0;
  return value;
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

function buildSwissScoreMap(players, rounds) {
  const scoreMap = new Map();
  for (const player of players) {
    scoreMap.set(player.id, 0);
  }

  for (const round of rounds) {
    for (const result of round.results || []) {
      const { a, b, winner } = result || {};
      if (!a || !b || !scoreMap.has(a) || !scoreMap.has(b)) {
        continue;
      }
      if (winner === "draw") {
        scoreMap.set(a, (scoreMap.get(a) || 0) + 0.5);
        scoreMap.set(b, (scoreMap.get(b) || 0) + 0.5);
        continue;
      }
      if (winner === "a") {
        scoreMap.set(a, (scoreMap.get(a) || 0) + 1);
        continue;
      }
      if (winner === "b") {
        scoreMap.set(b, (scoreMap.get(b) || 0) + 1);
      }
    }
  }

  return scoreMap;
}

export function buildSwissStandings(players, rounds) {
  const scoreMap = buildSwissScoreMap(players, rounds);
  const nameMap = new Map(players.map((player) => [player.id, player.name || player.id]));

  return [...players]
    .map((player) => player.id)
    .sort((leftId, rightId) => {
      const scoreDiff = (scoreMap.get(rightId) || 0) - (scoreMap.get(leftId) || 0);
      if (scoreDiff !== 0) {
        return scoreDiff > 0 ? 1 : -1;
      }
      return (nameMap.get(leftId) || leftId).localeCompare(nameMap.get(rightId) || rightId);
    });
}

export function buildSwissRankingGroups(players, rounds) {
  const standings = buildSwissStandings(players, rounds);
  if (standings.length === 0) {
    return [];
  }

  const groups = [];
  let currentGroup = [];
  let currentScore = null;

  for (const playerId of standings) {
    const score = buildSwissScoreMap(players, rounds).get(playerId) || 0;
    if (currentScore === null) {
      currentScore = score;
    }
    if (score !== currentScore) {
      groups.push(currentGroup);
      currentGroup = [];
      currentScore = score;
    }
    currentGroup.push(playerId);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export function generateSwissPairingProposal({ players, rounds = [], randomSeed = 1 }) {
  const scoreMap = buildSwissScoreMap(players, rounds);
  const opponentMap = buildSwissOpponentMap(players, rounds);
  const playerIds = [...players].map((player) => player.id).sort((leftId, rightId) => {
    const scoreDiff = (scoreMap.get(rightId) || 0) - (scoreMap.get(leftId) || 0);
    if (scoreDiff !== 0) {
      return scoreDiff > 0 ? 1 : -1;
    }
    return leftId.localeCompare(rightId);
  });

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
      bestCandidateIndex = -1;
    } else {
      queue.splice(bestCandidateIndex, 1);
    }

    matches.push({ a: currentId, b: bestCandidate });
  }

  return {
    byePlayerId: queue.length === 1 ? queue[0] : null,
    matches,
  };
}
