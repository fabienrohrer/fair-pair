const RESULT_WIN = 1;
const RESULT_DRAW = 0.5;

function normalizePoints(value) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}

export function getByeCounts(players, rounds) {
  const byeCounts = {};
  for (const player of players) {
    byeCounts[player.id] = 0;
  }
  for (const round of rounds) {
    if (round.byePlayerId && byeCounts[round.byePlayerId] !== undefined) {
      byeCounts[round.byePlayerId] += 1;
    }
  }
  return byeCounts;
}

export function getOpponentMap(players, rounds) {
  const map = {};
  for (const player of players) {
    map[player.id] = new Set();
  }
  for (const round of rounds) {
    for (const match of round.matches) {
      if (!map[match.a]) {
        map[match.a] = new Set();
      }
      if (!map[match.b]) {
        map[match.b] = new Set();
      }
      map[match.a].add(match.b);
      map[match.b].add(match.a);
    }
  }
  return map;
}

function buildCostScales(playerCount) {
  const maxRankGap = Math.max(1, playerCount - 1);
  const maxByeTie = Math.max(1, playerCount * 3);
  const tertiaryScale = BigInt(maxByeTie + 1);
  const secondaryScale = BigInt(maxRankGap + 1) * tertiaryScale;
  return { secondaryScale, tertiaryScale };
}

function computePairCost(aIndex, bIndex, orderedPlayerIds, byeCounts, opponentMap, scales) {
  const aId = orderedPlayerIds[aIndex];
  const bId = orderedPlayerIds[bIndex];
  const isRematch = opponentMap[aId]?.has(bId) ? 1n : 0n;
  const rankGap = BigInt(Math.abs(aIndex - bIndex));
  const byeTie = BigInt((byeCounts[aId] ?? 0) + (byeCounts[bId] ?? 0));
  return (isRematch * scales.secondaryScale) + (rankGap * scales.tertiaryScale) + byeTie;
}

function solveMinimumMatching(orderedPlayerIds, byeCounts, opponentMap) {
  const n = orderedPlayerIds.length;
  if (n === 0) {
    return { cost: 0n, pairs: [] };
  }
  if (n % 2 !== 0) {
    throw new Error("Expected an even number of players for matching.");
  }

  const scales = buildCostScales(n);
  const memo = new Map();
  const choice = new Map();

  function dp(mask) {
    if (mask === 0) {
      return 0n;
    }
    if (memo.has(mask)) {
      return memo.get(mask);
    }

    let first = 0;
    while (((mask >> first) & 1) === 0) {
      first += 1;
    }

    let bestCost = null;
    let bestPair = null;
    const maskWithoutFirst = mask & ~(1 << first);
    for (let j = first + 1; j < n; j += 1) {
      if (((maskWithoutFirst >> j) & 1) === 0) {
        continue;
      }
      const nextMask = maskWithoutFirst & ~(1 << j);
      const pairCost = computePairCost(first, j, orderedPlayerIds, byeCounts, opponentMap, scales);
      const totalCost = pairCost + dp(nextMask);
      if (bestCost === null || totalCost < bestCost) {
        bestCost = totalCost;
        bestPair = [first, j, nextMask];
      }
    }

    memo.set(mask, bestCost);
    choice.set(mask, bestPair);
    return bestCost;
  }

  const fullMask = (1 << n) - 1;
  const cost = dp(fullMask);
  const pairs = [];
  let currentMask = fullMask;
  while (currentMask !== 0) {
    const selected = choice.get(currentMask);
    if (!selected) {
      throw new Error("Failed to reconstruct matching.");
    }
    const [aIndex, bIndex, nextMask] = selected;
    pairs.push({
      a: orderedPlayerIds[aIndex],
      b: orderedPlayerIds[bIndex],
    });
    currentMask = nextMask;
  }
  return { cost, pairs };
}

function seededRandomIndex(size, seedValue) {
  if (size <= 0) {
    return 0;
  }
  let seed = seedValue;
  seed ^= seed << 13;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  const normalized = Math.abs(seed) % size;
  return normalized;
}

function selectByeCandidate({
  orderedPlayerIds,
  byeCounts,
  strategy,
  manualByePlayerId,
  randomSeed,
}) {
  if (orderedPlayerIds.length % 2 === 0) {
    return null;
  }
  if (manualByePlayerId && orderedPlayerIds.includes(manualByePlayerId)) {
    return manualByePlayerId;
  }

  const minByeCount = Math.min(...orderedPlayerIds.map((id) => byeCounts[id] ?? 0));
  const eligible = orderedPlayerIds.filter((id) => (byeCounts[id] ?? 0) === minByeCount);
  if (strategy === "random") {
    const index = seededRandomIndex(eligible.length, randomSeed || Date.now());
    return eligible[index];
  }
  return eligible[eligible.length - 1];
}

function sortPairsByOrder(pairs, orderedPlayerIds) {
  const rankMap = new Map();
  orderedPlayerIds.forEach((playerId, index) => rankMap.set(playerId, index));
  return [...pairs].sort((left, right) => {
    const leftBest = Math.min(rankMap.get(left.a), rankMap.get(left.b));
    const rightBest = Math.min(rankMap.get(right.a), rankMap.get(right.b));
    return leftBest - rightBest;
  });
}

export function generateRoundPairings({
  players,
  orderedPlayerIds,
  rounds,
  byeStrategy,
  mode,
  manualByePlayerId = null,
  randomSeed = 1,
}) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const cleanOrder = orderedPlayerIds.filter((id) => byId.has(id));
  if (cleanOrder.length !== players.length) {
    throw new Error("Ranking order does not match current players.");
  }
  const byeCounts = getByeCounts(players, rounds);
  const byePlayerId = selectByeCandidate({
    orderedPlayerIds: cleanOrder,
    byeCounts,
    strategy: byeStrategy,
    manualByePlayerId,
    randomSeed,
  });
  const activePlayers = byePlayerId ? cleanOrder.filter((id) => id !== byePlayerId) : cleanOrder.slice();
  const opponentMap = getOpponentMap(players, rounds);

  let pairs;
  if (mode === "random") {
    const randomized = activePlayers.slice();
    for (let i = randomized.length - 1; i > 0; i -= 1) {
      const j = seededRandomIndex(i + 1, randomSeed + i * 97);
      [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
    }
    pairs = [];
    for (let i = 0; i < randomized.length; i += 2) {
      pairs.push({ a: randomized[i], b: randomized[i + 1] });
    }
  } else {
    const matching = solveMinimumMatching(activePlayers, byeCounts, opponentMap);
    pairs = matching.pairs;
  }

  const sortedPairs = sortPairsByOrder(pairs, cleanOrder);
  return {
    byePlayerId,
    matches: sortedPairs.map((pair) => ({
      a: pair.a,
      b: pair.b,
      result: null,
    })),
  };
}

export function getStandings(players, rounds) {
  const stats = new Map();
  for (const player of players) {
    stats.set(player.id, {
      id: player.id,
      name: player.name,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      byes: 0,
      played: 0,
    });
  }

  for (const round of rounds) {
    if (round.byePlayerId && stats.has(round.byePlayerId)) {
      const byePlayer = stats.get(round.byePlayerId);
      byePlayer.points += RESULT_WIN;
      byePlayer.wins += 1;
      byePlayer.byes += 1;
    }
    for (const match of round.matches) {
      if (!match.result) {
        continue;
      }
      const a = stats.get(match.a);
      const b = stats.get(match.b);
      if (!a || !b) {
        continue;
      }
      a.played += 1;
      b.played += 1;
      if (match.result === "a") {
        a.points += RESULT_WIN;
        a.wins += 1;
        b.losses += 1;
      } else if (match.result === "b") {
        b.points += RESULT_WIN;
        b.wins += 1;
        a.losses += 1;
      } else {
        a.points += RESULT_DRAW;
        b.points += RESULT_DRAW;
        a.draws += 1;
        b.draws += 1;
      }
    }
  }

  const ordered = Array.from(stats.values()).sort((left, right) => {
    if (right.points !== left.points) {
      return right.points - left.points;
    }
    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }
    return left.name.localeCompare(right.name);
  });

  let currentRank = 1;
  for (let index = 0; index < ordered.length; index += 1) {
    if (index > 0) {
      const prev = ordered[index - 1];
      const curr = ordered[index];
      if (curr.points !== prev.points || curr.wins !== prev.wins) {
        currentRank = index + 1;
      }
    }
    ordered[index].rank = currentRank;
    ordered[index].displayPoints = normalizePoints(ordered[index].points);
  }
  return ordered;
}

export function allResultsEntered(round) {
  return round.matches.every((match) => Boolean(match.result));
}
