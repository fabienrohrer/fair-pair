import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyPairingSlots,
  flattenRankingGroups,
  generateRegistrationOrderProposal,
  generatePairingProposal,
  getByeCounts,
  isValidPairingAssignment,
} from "../docs/pairing.js";
import {
  buildSwissStandingsData,
  generateSwissPairingProposal,
  normalizeSwissSettings,
} from "../docs/swiss.js";

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  }));
}

function parseRanking(spec) {
  return spec.split(">").map((group) => group.split(",").map((playerNumber) => `p${playerNumber}`));
}

function parseMatches(spec) {
  if (!spec) {
    return [];
  }
  return spec.split("|").map((pair) => {
    const [a, b] = pair.split("-");
    return { a: `p${a}`, b: `p${b}` };
  });
}

function seededNext(seed) {
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >> 17;
  value ^= value << 5;
  return value | 0;
}

function buildRandomRankingGroups(playerIds, seed) {
  const shuffled = playerIds.slice();
  let nextSeed = seed;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    nextSeed = seededNext(nextSeed + index * 17 + 11);
    const swapIndex = Math.abs(nextSeed) % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const groups = [];
  let cursor = 0;
  while (cursor < shuffled.length) {
    nextSeed = seededNext(nextSeed + cursor * 31 + 7);
    const remaining = shuffled.length - cursor;
    const size = Math.min(remaining, 1 + (Math.abs(nextSeed) % 3));
    groups.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }
  return { groups, seed: nextSeed };
}

function runAutoScenario(scenario) {
  const players = makePlayers(scenario.playerCount);
  const rankingGroups = parseRanking(scenario.ranking);
  const rounds = (scenario.rounds || []).map((round) => ({
    byePlayerId: round.bye ? `p${round.bye}` : null,
    matches: parseMatches(round.matches),
    rankingGroups,
  }));

  return generatePairingProposal({
    players,
    rounds,
    rankingGroups,
    mode: "automatic",
    byeStrategy: scenario.byeStrategy || "worst",
    priorityOrder: scenario.priorityOrder || ["avoid_rematch", "minimize_gap", "bye_fairness"],
    randomSeed: scenario.randomSeed || 1,
  });
}

test("compact scenario matrix covers rematch, priorities, and BYE fairness", () => {
  const scenarios = [
    {
      name: "avoid rematch when possible",
      playerCount: 4,
      ranking: "1>2>3>4",
      rounds: [{ matches: "1-2|3-4" }],
      expectPairs: ["p1-p3", "p2-p4"],
    },
    {
      name: "allow rematch when ranking gap is first priority",
      playerCount: 4,
      ranking: "1>2>3>4",
      rounds: [{ matches: "1-2|3-4" }],
      priorityOrder: ["minimize_gap", "avoid_rematch", "bye_fairness"],
      expectPairs: ["p1-p2", "p3-p4"],
    },
    {
      name: "odd roster gives BYE to lowest ranked eligible player",
      playerCount: 5,
      ranking: "1>2>3>4>5",
      rounds: [{ bye: "5", matches: "1-2|3-4" }],
      expectBye: "p4",
      expectPairs: ["p1-p3", "p2-p5"],
    },
  ];

  for (const scenario of scenarios) {
    const proposal = runAutoScenario(scenario);
    const normalized = proposal.matches.map((match) => [match.a, match.b].sort().join("-")).sort();
    assert.deepEqual(normalized, scenario.expectPairs, scenario.name);
    if (scenario.expectBye) {
      assert.equal(proposal.byePlayerId, scenario.expectBye, scenario.name);
    } else {
      assert.equal(proposal.byePlayerId, null, scenario.name);
    }
  }
});

test("automatic proposal avoids rematches when avoidable", () => {
  const players = makePlayers(4);
  const rounds = [
    {
      byePlayerId: null,
      matches: [
        { a: "p1", b: "p2" },
        { a: "p3", b: "p4" },
      ],
      rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]],
    },
  ];

  const proposal = generatePairingProposal({
    players,
    rounds,
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]],
    mode: "automatic",
    byeStrategy: "worst",
    priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    randomSeed: 2,
  });

  const normalized = proposal.matches.map((match) => [match.a, match.b].sort().join("-")).sort();
  assert.deepEqual(normalized, ["p1-p3", "p2-p4"]);
});

test("priority order can prefer ranking gap over rematch when requested", () => {
  const players = makePlayers(4);
  const rounds = [
    {
      byePlayerId: null,
      matches: [
        { a: "p1", b: "p2" },
        { a: "p3", b: "p4" },
      ],
      rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]],
    },
  ];

  const proposal = generatePairingProposal({
    players,
    rounds,
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]],
    mode: "automatic",
    byeStrategy: "worst",
    priorityOrder: ["minimize_gap", "avoid_rematch", "bye_fairness"],
    randomSeed: 2,
  });

  const normalized = proposal.matches.map((match) => [match.a, match.b].sort().join("-")).sort();
  assert.deepEqual(normalized, ["p1-p2", "p3-p4"]);
});

test("worst bye strategy avoids repeating BYE before others receive one", () => {
  const players = makePlayers(5);
  const rounds = [
    {
      byePlayerId: "p5",
      matches: [
        { a: "p1", b: "p2" },
        { a: "p3", b: "p4" },
      ],
      rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]],
    },
  ];

  const proposal = generatePairingProposal({
    players,
    rounds,
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]],
    mode: "automatic",
    byeStrategy: "worst",
    priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    randomSeed: 3,
  });

  assert.notEqual(proposal.byePlayerId, "p5");
});

test("manual bye override is respected", () => {
  const players = makePlayers(5);
  const proposal = generatePairingProposal({
    players,
    rounds: [],
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]],
    mode: "automatic",
    byeStrategy: "worst",
    priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    manualByePlayerId: "p2",
  });
  assert.equal(proposal.byePlayerId, "p2");
});

test("random mode still returns valid pair list", () => {
  const players = makePlayers(6);
  const proposal = generatePairingProposal({
    players,
    rounds: [],
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"], ["p6"]],
    mode: "random",
    byeStrategy: "random",
    priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    randomSeed: 7,
  });
  assert.equal(proposal.matches.length, 3);
  const seen = new Set();
  proposal.matches.forEach((match) => {
    seen.add(match.a);
    seen.add(match.b);
  });
  assert.equal(seen.size, 6);
});

test("random mode reshuffles the bye as well as all other players", () => {
  const players = makePlayers(5);
  const first = generatePairingProposal({
    players,
    rounds: [],
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]],
    mode: "random",
    byeStrategy: "random",
    priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    randomSeed: 1,
  });
  const second = generatePairingProposal({
    players,
    rounds: [],
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]],
    mode: "random",
    byeStrategy: "random",
    priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
    randomSeed: 2,
  });

  assert.notEqual(first.byePlayerId, second.byePlayerId);
  assert.notDeepEqual(
    first.matches.map((match) => [match.a, match.b].sort().join("-")),
    second.matches.map((match) => [match.a, match.b].sort().join("-"))
  );
});

test("registration-order proposal pairs players sequentially", () => {
  const proposal = generateRegistrationOrderProposal({
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]],
  });

  assert.equal(proposal.byePlayerId, null);
  assert.deepEqual(proposal.matches, [
    { a: "p1", b: "p2" },
    { a: "p3", b: "p4" },
  ]);
});

test("registration-order proposal assigns BYE to last registered player on odd count", () => {
  const proposal = generateRegistrationOrderProposal({
    rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]],
  });

  assert.equal(proposal.byePlayerId, "p5");
  assert.deepEqual(proposal.matches, [
    { a: "p1", b: "p2" },
    { a: "p3", b: "p4" },
  ]);
});

test("swiss settings normalize common chess presets", () => {
  const standard = normalizeSwissSettings({ scoreMode: "standard", byeStrategy: "lowest_score" });
  assert.equal(standard.winPoints, 1);
  assert.equal(standard.drawPoints, 0.5);
  assert.equal(standard.byePoints, 1);
  assert.equal(standard.byeStrategy, "lowest_score");

  const double = normalizeSwissSettings({ scoreMode: "double", byeStrategy: "random" });
  assert.equal(double.winPoints, 2);
  assert.equal(double.drawPoints, 1);
  assert.equal(double.byePoints, 2);
  assert.equal(double.byeStrategy, "random");
});

test("swiss standings expose points and Buchholz", () => {
  const players = makePlayers(4);
  const rounds = [
    {
      matches: [
        { a: "p1", b: "p2" },
        { a: "p3", b: "p4" },
      ],
      results: [
        { a: "p1", b: "p2", winner: "a" },
        { a: "p3", b: "p4", winner: "draw" },
      ],
    },
    {
      matches: [
        { a: "p1", b: "p3" },
        { a: "p2", b: "p4" },
      ],
      results: [
        { a: "p1", b: "p3", winner: "a" },
        { a: "p2", b: "p4", winner: "b" },
      ],
    },
  ];

  const standings = buildSwissStandingsData(players, rounds, normalizeSwissSettings());
  assert.equal(standings[0].id, "p1");
  assert.equal(standings[0].playerId, "p1");
  assert.equal(standings[0].score, 2);
  assert.equal(standings[0].buchholz, 0.5);
  assert.equal(standings[1].playerId, "p4");
  assert.equal(standings[1].score, 1.5);
  assert.equal(standings[1].buchholz, 0.5);
  assert.equal(standings[2].playerId, "p3");
  assert.equal(standings[2].score, 0.5);
  assert.equal(standings[2].buchholz, 3.5);
  assert.equal(standings[3].playerId, "p2");
  assert.equal(standings[3].score, 0);
  assert.equal(standings[3].buchholz, 3.5);
});

test("swiss pairing prioritizes similar scores and avoids prior opponents", () => {
  const players = makePlayers(6);
  const rounds = [
    {
      matches: [
        { a: "p1", b: "p2" },
        { a: "p3", b: "p4" },
        { a: "p5", b: "p6" },
      ],
      results: [
        { a: "p1", b: "p2", winner: "a" },
        { a: "p3", b: "p4", winner: "b" },
        { a: "p5", b: "p6", winner: "draw" },
      ],
    },
  ];

  const proposal = generateSwissPairingProposal({ players, rounds, randomSeed: 9 });
  assert.equal(proposal.byePlayerId, null);
  assert.equal(proposal.matches.length, 3);

  const pairIds = proposal.matches.map((match) => [match.a, match.b].sort().join("-"));
  const observedPairs = new Set(pairIds);
  assert.equal(observedPairs.has("p1-p2"), false);
  assert.equal(observedPairs.has("p3-p4"), false);
  assert.equal(observedPairs.has("p5-p6"), false);
});

test("swiss pairing gives a bye when the field is odd", () => {
  const players = makePlayers(5);
  const proposal = generateSwissPairingProposal({ players, rounds: [], randomSeed: 4 });
  assert.equal(proposal.matches.length, 2);
  assert.ok(proposal.byePlayerId);
});

test("pairing validation enforces complete unique assignments", () => {
  const slots = createEmptyPairingSlots(4);
  slots[0].a = "p1";
  slots[0].b = "p2";
  slots[1].a = "p3";
  slots[1].b = "p4";
  assert.equal(
    isValidPairingAssignment({
      playerIds: ["p1", "p2", "p3", "p4"],
      tables: slots,
      byePlayerId: null,
    }),
    true
  );

  slots[1].b = "p1";
  assert.equal(
    isValidPairingAssignment({
      playerIds: ["p1", "p2", "p3", "p4"],
      tables: slots,
      byePlayerId: null,
    }),
    false
  );
});

test("ranking flattening preserves order with ties", () => {
  assert.deepEqual(flattenRankingGroups([["p1", "p2"], ["p3"], ["p4", "p5"]]), [
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
  ]);
});

test("bye counters are derived from rounds", () => {
  const players = makePlayers(4);
  const counts = getByeCounts(players, [
    { byePlayerId: "p1", matches: [{ a: "p2", b: "p3" }], rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]] },
    { byePlayerId: "p1", matches: [{ a: "p2", b: "p4" }], rankingGroups: [["p1"], ["p2"], ["p3"], ["p4"]] },
  ]);
  assert.equal(counts.p1, 2);
  assert.equal(counts.p2, 0);
});

test("high-level flow with 25 players keeps unique opponents and unique BYEs", () => {
  const playerNames = "abcdefghijklmnopqrstuvwxy".split("");
  const players = playerNames.map((name, index) => ({
    id: `p${index + 1}`,
    name,
  }));
  const playerIds = players.map((player) => player.id);
  const baseSeed = Math.floor(Date.now() / 1000);

  for (let runIndex = 0; runIndex < 5; runIndex += 1) {
    const rounds = [];
    const seenPairs = new Set();
    const seenByes = new Set();
    let seed = baseSeed + runIndex * 997;
    let rankingGroups = playerIds.map((id) => [id]);

    const firstRound = generatePairingProposal({
      players,
      rounds,
      rankingGroups,
      mode: "random",
      byeStrategy: "random",
      priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
      randomSeed: seed,
    });

    for (const match of firstRound.matches) {
      const pairKey = [match.a, match.b].sort().join("-");
      assert.equal(
        seenPairs.has(pairKey),
        false,
        `duplicate matchup in first round (run ${runIndex + 1}): ${pairKey}`
      );
      seenPairs.add(pairKey);
    }
    assert.ok(firstRound.byePlayerId);
    seenByes.add(firstRound.byePlayerId);
    rounds.push({
      byePlayerId: firstRound.byePlayerId,
      matches: firstRound.matches,
      rankingGroups,
    });

    for (let roundNumber = 1; roundNumber <= 7; roundNumber += 1) {
      const nextRanking = buildRandomRankingGroups(playerIds, seed + roundNumber * 101);
      rankingGroups = nextRanking.groups;
      seed = nextRanking.seed;

      const proposal = generatePairingProposal({
        players,
        rounds,
        rankingGroups,
        mode: "automatic",
        byeStrategy: "worst",
        priorityOrder: ["avoid_rematch", "minimize_gap", "bye_fairness"],
        randomSeed: seed + roundNumber,
      });

      for (const match of proposal.matches) {
        const pairKey = [match.a, match.b].sort().join("-");
        assert.equal(
          seenPairs.has(pairKey),
          false,
          `rematch found at round ${roundNumber + 1} (run ${runIndex + 1}): ${pairKey}`
        );
        seenPairs.add(pairKey);
      }

      assert.ok(proposal.byePlayerId, `expected BYE at round ${roundNumber + 1} (run ${runIndex + 1})`);
      assert.equal(
        seenByes.has(proposal.byePlayerId),
        false,
        `BYE repeated at round ${roundNumber + 1} (run ${runIndex + 1}): ${proposal.byePlayerId}`
      );
      seenByes.add(proposal.byePlayerId);

      rounds.push({
        byePlayerId: proposal.byePlayerId,
        matches: proposal.matches,
        rankingGroups,
      });
    }

    assert.equal(rounds.length, 8);
    assert.equal(seenByes.size, 8);
  }
});
