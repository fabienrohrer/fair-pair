import test from "node:test";
import assert from "node:assert/strict";

import {
  allResultsEntered,
  generateRoundPairings,
  getByeCounts,
  getStandings,
} from "../docs/pairing.js";

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  }));
}

test("automatic pairing avoids rematches when avoidable", () => {
  const players = makePlayers(4);
  const rounds = [
    {
      byePlayerId: null,
      matches: [
        { a: "p1", b: "p2", result: "a" },
        { a: "p3", b: "p4", result: "b" },
      ],
    },
  ];
  const round2 = generateRoundPairings({
    players,
    orderedPlayerIds: ["p1", "p2", "p3", "p4"],
    rounds,
    byeStrategy: "lowest",
    mode: "automatic",
    randomSeed: 2,
  });
  const normalized = round2.matches.map((match) => [match.a, match.b].sort().join("-")).sort();
  assert.deepEqual(normalized, ["p1-p3", "p2-p4"]);
});

test("automatic pairing handles exhausted unique opponents", () => {
  const players = makePlayers(2);
  const rounds = [
    {
      byePlayerId: null,
      matches: [{ a: "p1", b: "p2", result: "a" }],
    },
  ];
  const round2 = generateRoundPairings({
    players,
    orderedPlayerIds: ["p1", "p2"],
    rounds,
    byeStrategy: "lowest",
    mode: "automatic",
    randomSeed: 10,
  });
  assert.equal(round2.matches.length, 1);
  assert.equal(round2.matches[0].a, "p1");
  assert.equal(round2.matches[0].b, "p2");
});

test("bye assignment prioritizes players with the fewest previous BYEs", () => {
  const players = makePlayers(5);
  const rounds = [
    {
      byePlayerId: "p5",
      matches: [
        { a: "p1", b: "p2", result: "draw" },
        { a: "p3", b: "p4", result: "a" },
      ],
    },
  ];
  const round2 = generateRoundPairings({
    players,
    orderedPlayerIds: ["p1", "p2", "p3", "p4", "p5"],
    rounds,
    byeStrategy: "lowest",
    mode: "automatic",
    randomSeed: 3,
  });
  assert.notEqual(round2.byePlayerId, "p5");
});

test("manual bye override is applied when valid", () => {
  const players = makePlayers(5);
  const round = generateRoundPairings({
    players,
    orderedPlayerIds: ["p1", "p2", "p3", "p4", "p5"],
    rounds: [],
    byeStrategy: "lowest",
    mode: "automatic",
    manualByePlayerId: "p2",
    randomSeed: 1,
  });
  assert.equal(round.byePlayerId, "p2");
});

test("standings include wins, draws and BYE wins with deterministic ranking", () => {
  const players = makePlayers(3);
  const rounds = [
    {
      byePlayerId: "p3",
      matches: [{ a: "p1", b: "p2", result: "draw" }],
    },
    {
      byePlayerId: "p2",
      matches: [{ a: "p1", b: "p3", result: "a" }],
    },
  ];
  const standings = getStandings(players, rounds);
  assert.equal(standings[0].id, "p1");
  assert.equal(standings[0].points, 1.5);
  assert.equal(standings[1].id, "p2");
  assert.equal(standings[1].points, 1.5);
  assert.equal(standings[2].id, "p3");
  assert.equal(standings[2].points, 1);
  assert.equal(standings[0].rank, 1);
  assert.equal(standings[1].rank, 1);
});

test("allResultsEntered validates pending matches", () => {
  assert.equal(
    allResultsEntered({
      matches: [{ a: "p1", b: "p2", result: "draw" }],
    }),
    true
  );
  assert.equal(
    allResultsEntered({
      matches: [{ a: "p1", b: "p2", result: null }],
    }),
    false
  );
});

test("bye counters are derived from rounds", () => {
  const players = makePlayers(4);
  const rounds = [
    { byePlayerId: "p1", matches: [{ a: "p2", b: "p3", result: "a" }] },
    { byePlayerId: "p1", matches: [{ a: "p2", b: "p4", result: "a" }] },
  ];
  const counts = getByeCounts(players, rounds);
  assert.equal(counts.p1, 2);
  assert.equal(counts.p2, 0);
});
