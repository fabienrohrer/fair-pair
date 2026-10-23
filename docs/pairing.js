const METRIC_KEYS = ["avoid_rematch", "minimize_gap", "bye_fairness"];

function seededRandomIndex(size, seedValue) {
  if (size <= 0) {
    return 0;
  }
  let seed = seedValue;
  seed ^= seed << 13;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  return Math.abs(seed) % size;
}

export function flattenRankingGroups(rankingGroups) {
  return rankingGroups.flatMap((group) => group);
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

function normalizePriorityOrder(priorityOrder) {
  if (!Array.isArray(priorityOrder) || priorityOrder.length !== 3) {
    return METRIC_KEYS.slice();
  }
  const clean = priorityOrder.filter((key) => METRIC_KEYS.includes(key));
  if (clean.length !== 3 || new Set(clean).size !== 3) {
    return METRIC_KEYS.slice();
  }
  return clean;
}

function buildRankIndexByOrder(orderedPlayerIds) {
  const rankIndex = {};
  orderedPlayerIds.forEach((id, index) => {
    rankIndex[id] = index;
  });
  return rankIndex;
}

function selectByeCandidate({
  orderedPlayerIds,
  byeCounts,
  byeStrategy,
  randomSeed,
  manualByePlayerId,
}) {
  if (orderedPlayerIds.length % 2 === 0) {
    return null;
  }
  if (manualByePlayerId && orderedPlayerIds.includes(manualByePlayerId)) {
    return manualByePlayerId;
  }

  const minByeCount = Math.min(...orderedPlayerIds.map((id) => byeCounts[id] ?? 0));
  const eligible = orderedPlayerIds.filter((id) => (byeCounts[id] ?? 0) === minByeCount);
  if (byeStrategy === "random") {
    const index = seededRandomIndex(eligible.length, randomSeed || Date.now());
    return eligible[index];
  }
  return eligible[eligible.length - 1];
}

function metricValue(metric, pair, context) {
  const { byeCounts, opponentMap, rankIndex } = context;
  if (metric === "avoid_rematch") {
    return opponentMap[pair.a]?.has(pair.b) ? 1 : 0;
  }
  if (metric === "minimize_gap") {
    return Math.abs((rankIndex[pair.a] ?? 0) - (rankIndex[pair.b] ?? 0));
  }
  return (byeCounts[pair.a] ?? 0) + (byeCounts[pair.b] ?? 0);
}

function buildScales(metricBounds, priorityOrder) {
  const scales = {};
  let current = 1n;
  scales[priorityOrder[2]] = current;
  current *= BigInt(metricBounds[priorityOrder[2]] + 1);
  scales[priorityOrder[1]] = current;
  current *= BigInt(metricBounds[priorityOrder[1]] + 1);
  scales[priorityOrder[0]] = current;
  return scales;
}

function pairCost(pair, context, priorityOrder, scales) {
  let total = 0n;
  for (const metric of METRIC_KEYS) {
    total += BigInt(metricValue(metric, pair, context)) * scales[metric];
  }
  return total;
}

function solveMinimumMatching(orderedPlayerIds, context, priorityOrder) {
  const n = orderedPlayerIds.length;
  if (n % 2 !== 0) {
    throw new Error("Expected an even number of players.");
  }
  if (n === 0) {
    return [];
  }

  const metricBounds = {
    avoid_rematch: 1,
    minimize_gap: Math.max(1, n - 1),
    bye_fairness: Math.max(
      1,
      ...orderedPlayerIds.map((id) => context.byeCounts[id] ?? 0).map((count) => count * 2)
    ),
  };
  const scales = buildScales(metricBounds, priorityOrder);
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
    const maskWithoutFirst = mask & ~(1 << first);
    let bestCost = null;
    let bestChoice = null;

    for (let second = first + 1; second < n; second += 1) {
      if (((maskWithoutFirst >> second) & 1) === 0) {
        continue;
      }
      const nextMask = maskWithoutFirst & ~(1 << second);
      const currentPair = { a: orderedPlayerIds[first], b: orderedPlayerIds[second] };
      const currentCost = pairCost(currentPair, context, priorityOrder, scales) + dp(nextMask);
      if (bestCost === null || currentCost < bestCost) {
        bestCost = currentCost;
        bestChoice = { first, second, nextMask };
      }
    }

    memo.set(mask, bestCost);
    choice.set(mask, bestChoice);
    return bestCost;
  }

  const fullMask = (1 << n) - 1;
  dp(fullMask);

  const pairs = [];
  let currentMask = fullMask;
  while (currentMask !== 0) {
    const selected = choice.get(currentMask);
    if (!selected) {
      throw new Error("Failed to reconstruct pairings.");
    }
    pairs.push({
      a: orderedPlayerIds[selected.first],
      b: orderedPlayerIds[selected.second],
    });
    currentMask = selected.nextMask;
  }
  return pairs;
}

function sortPairsByOrder(pairs, orderedPlayerIds) {
  const rankMap = new Map();
  orderedPlayerIds.forEach((id, index) => rankMap.set(id, index));
  return [...pairs].sort((left, right) => {
    const leftMin = Math.min(rankMap.get(left.a), rankMap.get(left.b));
    const rightMin = Math.min(rankMap.get(right.a), rankMap.get(right.b));
    return leftMin - rightMin;
  });
}

export function generatePairingProposal({
  players,
  rounds,
  rankingGroups,
  mode,
  byeStrategy,
  priorityOrder,
  manualByePlayerId = null,
  randomSeed = 1,
}) {
  const orderedPlayerIds = flattenRankingGroups(rankingGroups);
  const knownPlayers = new Set(players.map((player) => player.id));
  if (orderedPlayerIds.length !== players.length || orderedPlayerIds.some((id) => !knownPlayers.has(id))) {
    throw new Error("Ranking groups must include all players exactly once.");
  }

  const byeCounts = getByeCounts(players, rounds);

  if (mode === "random") {
    const shuffled = orderedPlayerIds.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = seededRandomIndex(index + 1, randomSeed + index * 97 + 13);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    let byePlayerId = null;
    if (shuffled.length % 2 !== 0) {
      byePlayerId = shuffled.shift();
    }

    const pairs = [];
    for (let index = 0; index < shuffled.length; index += 2) {
      pairs.push({ a: shuffled[index], b: shuffled[index + 1] });
    }

    return {
      byePlayerId,
      matches: sortPairsByOrder(pairs, orderedPlayerIds),
    };
  }

  const byePlayerId = selectByeCandidate({
    orderedPlayerIds,
    byeCounts,
    byeStrategy,
    randomSeed,
    manualByePlayerId,
  });
  const activePlayers = byePlayerId
    ? orderedPlayerIds.filter((id) => id !== byePlayerId)
    : orderedPlayerIds.slice();

  const normalizedOrder = normalizePriorityOrder(priorityOrder);
  const context = {
    byeCounts,
    opponentMap: getOpponentMap(players, rounds),
    rankIndex: buildRankIndexByOrder(orderedPlayerIds),
  };
  const pairs = solveMinimumMatching(activePlayers, context, normalizedOrder);

  return {
    byePlayerId,
    matches: sortPairsByOrder(pairs, orderedPlayerIds),
  };
}

export function createEmptyPairingSlots(playerCount) {
  const tableCount = Math.floor(playerCount / 2);
  return Array.from({ length: tableCount }, (_, index) => ({
    tableNumber: index + 1,
    a: null,
    b: null,
  }));
}

export function isValidPairingAssignment({ playerIds, tables, byePlayerId }) {
  const seen = new Set();
  for (const table of tables) {
    if (!table.a || !table.b) {
      return false;
    }
    if (table.a === table.b) {
      return false;
    }
    if (seen.has(table.a) || seen.has(table.b)) {
      return false;
    }
    seen.add(table.a);
    seen.add(table.b);
  }
  if (byePlayerId) {
    if (seen.has(byePlayerId)) {
      return false;
    }
    seen.add(byePlayerId);
  }
  return seen.size === playerIds.length;
}
