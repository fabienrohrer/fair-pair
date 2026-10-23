import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTournamentEdits,
  createInitialState,
  createTournamentFromForm,
  migrateLoadedState,
  needsRoundReset,
  removeTournamentFromCollection,
  selectDefaultTournamentId,
} from "../docs/tournament-state.js";

test("createTournamentFromForm initializes a new tournament", () => {
  const tournament = createTournamentFromForm({
    id: "t1",
    name: "Weekly Swiss",
    pairingMode: "automatic",
    byeStrategy: "lowest",
    playerNames: ["Alice", "Bob", "Claire"],
  });

  assert.equal(tournament.id, "t1");
  assert.equal(tournament.players.length, 3);
  assert.deepEqual(tournament.rankingOrder, ["p1", "p2", "p3"]);
  assert.equal(tournament.rounds.length, 0);
  assert.equal(tournament.editRoundIndex, null);
});

test("needsRoundReset detects structural setup changes", () => {
  const tournament = createTournamentFromForm({
    id: "t2",
    name: "Cup",
    pairingMode: "automatic",
    byeStrategy: "lowest",
    playerNames: ["Alice", "Bob"],
  });

  assert.equal(
    needsRoundReset(tournament, {
      name: "Cup renamed",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["Alice", "Bob"],
    }),
    false
  );

  assert.equal(
    needsRoundReset(tournament, {
      name: "Cup",
      pairingMode: "random",
      byeStrategy: "lowest",
      playerNames: ["Alice", "Bob"],
    }),
    true
  );

  assert.equal(
    needsRoundReset(tournament, {
      name: "Cup",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["Alice", "Bruno"],
    }),
    true
  );
});

test("applyTournamentEdits keeps rounds when resetRounds is false", () => {
  const tournament = createTournamentFromForm({
    id: "t3",
    name: "League",
    pairingMode: "automatic",
    byeStrategy: "lowest",
    playerNames: ["A", "B"],
  });
  tournament.rounds.push({
    byePlayerId: null,
    matches: [{ a: "p1", b: "p2", result: "a" }],
  });

  const updated = applyTournamentEdits(
    tournament,
    {
      name: "League v2",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["A", "B"],
    },
    { resetRounds: false }
  );

  assert.equal(updated.name, "League v2");
  assert.equal(updated.rounds.length, 1);
  assert.deepEqual(updated.rankingOrder, ["p1", "p2"]);
});

test("applyTournamentEdits resets rounds and players when requested", () => {
  const tournament = createTournamentFromForm({
    id: "t4",
    name: "League",
    pairingMode: "automatic",
    byeStrategy: "lowest",
    playerNames: ["A", "B"],
  });
  tournament.rounds.push({
    byePlayerId: null,
    matches: [{ a: "p1", b: "p2", result: "a" }],
  });

  const updated = applyTournamentEdits(
    tournament,
    {
      name: "League",
      pairingMode: "manual",
      byeStrategy: "random",
      playerNames: ["A", "B", "C"],
    },
    { resetRounds: true }
  );

  assert.equal(updated.rounds.length, 0);
  assert.deepEqual(updated.rankingOrder, ["p1", "p2", "p3"]);
  assert.equal(updated.players[2].name, "C");
});

test("migrateLoadedState migrates v1 single-tournament state", () => {
  const migrated = migrateLoadedState(
    {
      language: "fr",
      tournament: createTournamentFromForm({
        id: "legacy",
        name: "Old",
        pairingMode: "automatic",
        byeStrategy: "lowest",
        playerNames: ["Alice", "Bob"],
      }),
    },
    "en"
  );

  assert.equal(migrated.language, "fr");
  assert.equal(migrated.tournaments.length, 1);
  assert.equal(migrated.selectedTournamentId, "legacy-1");
  assert.equal(migrated.tournaments[0].name, "Old");
});

test("createInitialState returns an empty multi-tournament state", () => {
  const state = createInitialState("en");
  assert.deepEqual(state, {
    language: "en",
    selectedTournamentId: null,
    tournaments: [],
  });
});

test("selectDefaultTournamentId keeps preferred id when available", () => {
  const tournaments = [
    createTournamentFromForm({
      id: "a",
      name: "A",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["A1", "A2"],
    }),
    createTournamentFromForm({
      id: "b",
      name: "B",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["B1", "B2"],
    }),
  ];

  assert.equal(selectDefaultTournamentId(tournaments, "b"), "b");
  assert.equal(selectDefaultTournamentId(tournaments, "missing"), "a");
  assert.equal(selectDefaultTournamentId([], "missing"), null);
});

test("removeTournamentFromCollection updates list and selected id safely", () => {
  const tournaments = [
    createTournamentFromForm({
      id: "a",
      name: "A",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["A1", "A2"],
    }),
    createTournamentFromForm({
      id: "b",
      name: "B",
      pairingMode: "automatic",
      byeStrategy: "lowest",
      playerNames: ["B1", "B2"],
    }),
  ];

  const removedSelected = removeTournamentFromCollection(tournaments, "a", "a");
  assert.equal(removedSelected.tournaments.length, 1);
  assert.equal(removedSelected.tournaments[0].id, "b");
  assert.equal(removedSelected.selectedTournamentId, "b");

  const removedOther = removeTournamentFromCollection(tournaments, "a", "b");
  assert.equal(removedOther.selectedTournamentId, "b");
});
