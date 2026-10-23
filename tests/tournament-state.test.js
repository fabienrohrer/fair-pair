import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTournamentEdits,
  createInitialRankingGroups,
  createInitialState,
  createRoundDraft,
  createTournamentFromForm,
  migrateLoadedState,
  needsRoundReset,
  normalizeRankingGroups,
  removeTournamentFromCollection,
  selectDefaultTournamentId,
} from "../docs/tournament-state.js";

test("createTournamentFromForm initializes ranking and draft state", () => {
  const tournament = createTournamentFromForm({
    id: "t1",
    name: "Weekly",
    playerNames: ["Alice", "Bob", "Claire"],
  });
  assert.equal(tournament.players.length, 3);
  assert.deepEqual(tournament.rankingGroups, [["p1"], ["p2"], ["p3"]]);
  assert.equal(tournament.currentRoundDraft, null);
});

test("createRoundDraft provides pairing then ranking workflow skeleton", () => {
  const draft = createRoundDraft(["p1", "p2", "p3", "p4", "p5"]);
  assert.equal(draft.phase, "pairing");
  assert.equal(draft.pairing.tables.length, 2);
  assert.equal(draft.pairing.byePlayerId, null);
  assert.deepEqual(draft.rankingGroups, [["p1"], ["p2"], ["p3"], ["p4"], ["p5"]]);
});

test("normalizeRankingGroups removes duplicates and restores missing players", () => {
  const normalized = normalizeRankingGroups([["p1", "p2"], ["p2"], ["p4"]], [
    "p1",
    "p2",
    "p3",
    "p4",
  ]);
  assert.deepEqual(normalized, [["p1", "p2"], ["p4"], ["p3"]]);
});

test("needsRoundReset only reacts to player list changes", () => {
  const tournament = createTournamentFromForm({
    id: "t2",
    name: "Cup",
    playerNames: ["Alice", "Bob"],
  });
  assert.equal(
    needsRoundReset(tournament, {
      name: "Cup renamed",
      playerNames: ["Alice", "Bob"],
    }),
    false
  );
  assert.equal(
    needsRoundReset(tournament, {
      name: "Cup",
      playerNames: ["Alice", "Bruno"],
    }),
    true
  );
});

test("applyTournamentEdits keeps rounds when resetRounds false", () => {
  const tournament = createTournamentFromForm({
    id: "t3",
    name: "League",
    playerNames: ["A", "B"],
  });
  tournament.rounds.push({
    byePlayerId: null,
    matches: [{ a: "p1", b: "p2" }],
    rankingGroups: [["p1"], ["p2"]],
  });

  const updated = applyTournamentEdits(
    tournament,
    { name: "League v2", playerNames: ["A", "B"] },
    { resetRounds: false }
  );
  assert.equal(updated.name, "League v2");
  assert.equal(updated.rounds.length, 1);
});

test("applyTournamentEdits resets rounds and ranking when requested", () => {
  const tournament = createTournamentFromForm({
    id: "t4",
    name: "League",
    playerNames: ["A", "B"],
  });
  tournament.rounds.push({
    byePlayerId: null,
    matches: [{ a: "p1", b: "p2" }],
    rankingGroups: [["p1"], ["p2"]],
  });
  tournament.currentRoundDraft = createRoundDraft(["p1", "p2"]);

  const updated = applyTournamentEdits(
    tournament,
    { name: "League", playerNames: ["A", "B", "C"] },
    { resetRounds: true }
  );
  assert.equal(updated.rounds.length, 0);
  assert.equal(updated.currentRoundDraft, null);
  assert.deepEqual(updated.rankingGroups, [["p1"], ["p2"], ["p3"]]);
});

test("state migration keeps tournaments and upgrades ranking fields", () => {
  const migrated = migrateLoadedState(
    {
      language: "fr",
      tournaments: [
        {
          id: "legacy",
          name: "Legacy",
          players: [
            { id: "p1", name: "Alice" },
            { id: "p2", name: "Bob" },
          ],
          rounds: [{ byePlayerId: null, matches: [{ a: "p1", b: "p2" }] }],
          rankingOrder: ["p2", "p1"],
        },
      ],
      selectedTournamentId: "legacy",
    },
    "en"
  );
  assert.equal(migrated.language, "fr");
  assert.equal(migrated.tournaments.length, 1);
  assert.deepEqual(migrated.tournaments[0].rankingGroups, [["p2"], ["p1"]]);
});

test("createInitialState returns empty multi-tournament model", () => {
  assert.deepEqual(createInitialState("en"), {
    language: "en",
    selectedTournamentId: null,
    tournaments: [],
  });
});

test("selectDefaultTournamentId and removeTournamentFromCollection stay consistent", () => {
  const tournaments = [
    createTournamentFromForm({ id: "a", name: "A", playerNames: ["A1", "A2"] }),
    createTournamentFromForm({ id: "b", name: "B", playerNames: ["B1", "B2"] }),
  ];
  assert.equal(selectDefaultTournamentId(tournaments, "b"), "b");
  assert.equal(selectDefaultTournamentId(tournaments, "missing"), "a");

  const removed = removeTournamentFromCollection(tournaments, "a", "a");
  assert.equal(removed.tournaments.length, 1);
  assert.equal(removed.selectedTournamentId, "b");
});

test("createInitialRankingGroups returns one player per rank", () => {
  assert.deepEqual(createInitialRankingGroups(["x", "y"]), [["x"], ["y"]]);
});
