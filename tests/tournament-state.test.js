import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTournamentEdits,
  createInitialRankingGroups,
  createInitialState,
  getPairingStageRules,
  getPlayerAge,
  createRoundDraft,
  createTournamentFromForm,
  migrateLoadedState,
  needsRoundReset,
  normalizePlayerEntries,
  normalizeRankingGroups,
  removeTournamentFromCollection,
  resolveAutoPairingMode,
  selectDefaultTournamentId,
} from "../docs/tournament-state.js";
import { parseImportedPlayersText } from "../docs/app/utils.js";

test("createTournamentFromForm initializes ranking and draft state", () => {
  const tournament = createTournamentFromForm({
    id: "t1",
    name: "Weekly",
    playerNames: ["Alice", "Bob", "Claire"],
  });
  assert.equal(tournament.players.length, 3);
  tournament.players.forEach((player) => {
    assert.equal(typeof player.hue, "number");
    assert.ok(player.hue >= 0 && player.hue <= 359);
  });
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
  updated.players.forEach((player) => {
    assert.equal(typeof player.hue, "number");
    assert.ok(player.hue >= 0 && player.hue <= 359);
  });
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
            { id: "p1", name: "Alice", hue: 44 },
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
  assert.equal(migrated.tournaments[0].players[0].hue, 44);
  assert.equal(typeof migrated.tournaments[0].players[1].hue, "number");
  assert.deepEqual(migrated.tournaments[0].rankingGroups, [["p2"], ["p1"]]);
});

test("createInitialState returns empty multi-tournament model", () => {
  assert.deepEqual(createInitialState("en"), {
    language: "en",
    selectedTournamentId: null,
    tournaments: [],
  });
});

test("getPlayerAge calculates age from date of birth", () => {
  const date = new Date("2025-10-30T12:00:00");
  assert.equal(getPlayerAge({ dateOfBirth: "2000-10-29" }, date), 25);
  assert.equal(getPlayerAge({ dateOfBirth: "2000-10-31" }, date), 24);
  assert.equal(getPlayerAge({ dateOfBirth: null }, date), null);
});

test("player hues are deterministic and based on the player name seed", () => {
  const tournamentA = createTournamentFromForm({
    id: "h1",
    name: "Seeded colors",
    playerNames: ["Alice", "Bob", "Claire"],
  });
  const tournamentB = createTournamentFromForm({
    id: "h2",
    name: "Seeded colors again",
    playerNames: ["Alice", "Bob", "Claire"],
  });

  assert.deepEqual(
    tournamentA.players.map((player) => player.hue),
    tournamentB.players.map((player) => player.hue)
  );
  assert.notEqual(tournamentA.players[0].hue, tournamentA.players[1].hue);
  assert.ok(tournamentA.players.every((player) => player.hue >= 0 && player.hue <= 359));
});

test("normalizePlayerEntries assigns a seeded hue even when the raw object has none", () => {
  const players = normalizePlayerEntries([
    { id: "p1", name: "Rambo John" },
    { id: "p2", name: "A" },
    { id: "p3", name: "B" },
  ]);

  assert.deepEqual(players.map((player) => player.hue), [142, 282, 65]);
  assert.ok(players.every((player) => player.hue >= 0 && player.hue <= 359));
});

test("parseImportedPlayersText accepts one-per-line names with optional birth dates", () => {
  assert.deepEqual(parseImportedPlayersText("Alice\nBob, 2000-05-12\nClaire, 2024-02-29"), [
    { name: "Alice", dateOfBirth: null },
    { name: "Bob", dateOfBirth: "2000-05-12" },
    { name: "Claire", dateOfBirth: "2024-02-29" },
  ]);
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

test("pairing stage rules enforce swiss lock after round 1", () => {
  const swissRound1 = getPairingStageRules("swiss", 0);
  assert.equal(swissRound1.allowManualPairing, true);
  assert.equal(swissRound1.allowAutoPairingTools, true);
  assert.deepEqual(swissRound1.allowedAutoModes, ["random", "registration"]);

  const swissRound2 = getPairingStageRules("swiss", 1);
  assert.equal(swissRound2.allowManualPairing, false);
  assert.equal(swissRound2.allowAutoPairingTools, false);
  assert.equal(swissRound2.isLockedSwissRound, true);
});

test("pairing stage rules keep manual tournaments editable after round 1", () => {
  const manualRound2 = getPairingStageRules("manual", 1);
  assert.equal(manualRound2.allowManualPairing, true);
  assert.equal(manualRound2.allowAutoPairingTools, true);
  assert.deepEqual(manualRound2.allowedAutoModes, ["automatic", "random"]);
});

test("resolveAutoPairingMode falls back to first allowed mode", () => {
  assert.equal(
    resolveAutoPairingMode("automatic", getPairingStageRules("swiss", 0)),
    "random"
  );
  assert.equal(
    resolveAutoPairingMode("registration", getPairingStageRules("swiss", 0)),
    "registration"
  );
  assert.equal(resolveAutoPairingMode("random", { allowedAutoModes: [] }), null);
});
