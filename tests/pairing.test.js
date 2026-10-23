import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyPairingSlots,
  flattenRankingGroups,
  generatePairingProposal,
  getByeCounts,
  isValidPairingAssignment,
} from "../docs/pairing.js";

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  }));
}

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
