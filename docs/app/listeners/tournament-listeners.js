import {
  createEmptyPairingSlots,
  flattenRankingGroups,
  generateRegistrationOrderProposal,
  generatePairingProposal,
  isValidPairingAssignment,
} from "../../pairing.js";
import {
  buildSwissRankingGroups,
  generateSwissPairingProposal,
  normalizeSwissSettings,
} from "../../swiss.js";
import {
  createRoundDraft,
  getPairingStageRules,
  normalizeRankingGroups,
  resolveAutoPairingMode,
} from "../../tournament-state.js";
import { currentPlayerIds } from "../renderers.js";
import { attachPairingDnD, attachRankingDnD } from "./dnd.js";
import {
  commitTournamentChange,
  normalizeDraftRanking,
  touchTournament,
} from "./shared.js";

export function attachTournamentListeners({
  t,
  saveState,
  render,
  notify,
  openHomeView,
  getCurrentTournament,
  openConfirmDialog,
}) {
  const tournament = getCurrentTournament();
  if (!tournament) {
    return;
  }

  document.getElementById("back-home")?.addEventListener("click", () => {
    openHomeView();
    render();
  });

  document.getElementById("prepare-round")?.addEventListener("click", () => {
    commitTournamentChange(tournament, saveState, render, () => {
      const draft = createRoundDraft(
        currentPlayerIds(tournament),
        tournament.tournamentType || "manual"
      );
      const stageRules = getPairingStageRules(tournament.tournamentType, tournament.rounds.length);
      if (stageRules.isLockedSwissRound) {
        const randomSeed = Date.now() + Math.floor(Math.random() * 1000000);
        const proposal = generateSwissPairingProposal({
          players: tournament.players,
          rounds: tournament.rounds,
          randomSeed,
          settings: tournament.swissSettings || normalizeSwissSettings(),
        });
        const freshSlots = createEmptyPairingSlots(tournament.players.length);
        proposal.matches.forEach((match, index) => {
          freshSlots[index].a = match.a;
          freshSlots[index].b = match.b;
        });
        draft.pairing.tables = freshSlots;
        draft.pairing.byePlayerId = proposal.byePlayerId;
        draft.autoOptions.randomSeed = randomSeed;
      }
      tournament.currentRoundDraft = draft;
    });
  });

  if (tournament.currentRoundDraft?.phase === "pairing") {
    const stageRules = getPairingStageRules(tournament.tournamentType, tournament.rounds.length);

    if (stageRules.allowManualPairing) {
      attachPairingDnD(tournament, { saveState, render });
    }

    document.getElementById("back-to-tournament")?.addEventListener("click", () => {
      openConfirmDialog({
        title: t("backToTournament"),
        message: t("confirmDiscardDraft"),
        confirmLabel: t("backToTournament"),
        onConfirm: () => {
          commitTournamentChange(tournament, saveState, render, () => {
            tournament.currentRoundDraft = null;
          });
        },
      });
    });

    if (stageRules.allowAutoPairingTools) {
      document.getElementById("auto-mode")?.addEventListener("change", (event) => {
        const draft = tournament.currentRoundDraft;
        const nextMode = resolveAutoPairingMode(event.target.value, stageRules);
        if (!nextMode) {
          return;
        }
        commitTournamentChange(tournament, saveState, render, () => {
          draft.autoOptions.mode = nextMode;
        });
      });

      document.getElementById("try-auto-pairing")?.addEventListener("click", () => {
        const draft = tournament.currentRoundDraft;
        const selectedMode = document.getElementById("auto-mode")?.value || draft.autoOptions.mode;
        const resolvedMode = resolveAutoPairingMode(selectedMode, stageRules);
        if (!resolvedMode) {
          return;
        }
        draft.autoOptions.mode = resolvedMode;
        draft.autoOptions.byeStrategy =
          document.getElementById("auto-bye-strategy")?.value || draft.autoOptions.byeStrategy;
        draft.autoOptions.priorityOrder = document.getElementById("auto-priority-order")
          ? document.getElementById("auto-priority-order").value.split("|")
          : draft.autoOptions.priorityOrder;

        const nextRandomSeed = Date.now() + Math.floor(Math.random() * 1000000);
        draft.autoOptions.randomSeed = nextRandomSeed;

        const proposal =
          resolvedMode === "registration"
            ? generateRegistrationOrderProposal({
                rankingGroups: tournament.rankingGroups,
              })
            : generatePairingProposal({
                players: tournament.players,
                rounds: tournament.rounds,
                rankingGroups: tournament.rankingGroups,
                mode: resolvedMode,
                byeStrategy: draft.autoOptions.byeStrategy,
                priorityOrder: draft.autoOptions.priorityOrder,
                randomSeed: nextRandomSeed,
              });
        const freshSlots = createEmptyPairingSlots(tournament.players.length);
        proposal.matches.forEach((match, index) => {
          freshSlots[index].a = match.a;
          freshSlots[index].b = match.b;
        });
        commitTournamentChange(tournament, saveState, render, () => {
          draft.pairing.tables = freshSlots;
          draft.pairing.byePlayerId = proposal.byePlayerId;
        });
      });
    }

    if (stageRules.allowManualPairing) {
      document.getElementById("clear-pairing")?.addEventListener("click", () => {
        const draft = tournament.currentRoundDraft;
        commitTournamentChange(tournament, saveState, render, () => {
          draft.pairing.tables = createEmptyPairingSlots(tournament.players.length);
          draft.pairing.byePlayerId = null;
        });
      });
    }

    document.getElementById("start-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const valid = isValidPairingAssignment({
        playerIds: currentPlayerIds(tournament),
        tables: draft.pairing.tables,
        byePlayerId: draft.pairing.byePlayerId,
      });
      if (!valid) {
        notify(t("invalidPairing"), { variant: "danger" });
        return;
      }
      commitTournamentChange(tournament, saveState, render, () => {
        draft.phase = tournament.tournamentType === "swiss" ? "results" : "ranking";
        if (tournament.tournamentType !== "swiss") {
          normalizeDraftRanking(tournament);
        }
        if (tournament.tournamentType === "swiss") {
          draft.results = draft.pairing.tables.map((table) => ({
            a: table.a,
            b: table.b,
            winner: "",
          }));
        }
      });
    });
  }

  if (tournament.currentRoundDraft?.phase === "results") {
    document.querySelectorAll(".swiss-result-select").forEach((element) => {
      element.addEventListener("change", () => {
        const draft = tournament.currentRoundDraft;
        const index = Number(element.dataset.resultIndex);
        if (!draft || Number.isNaN(index)) {
          return;
        }
        draft.results[index] = {
          a: draft.pairing.tables[index]?.a || null,
          b: draft.pairing.tables[index]?.b || null,
          winner: element.value,
        };
        touchTournament(tournament, saveState, render);
      });
    });

    document.getElementById("back-to-pairing")?.addEventListener("click", () => {
      openConfirmDialog({
        title: t("backToPairing"),
        message: t("confirmDiscardDraft"),
        confirmLabel: t("backToPairing"),
        onConfirm: () => {
          const draft = tournament.currentRoundDraft;
          commitTournamentChange(tournament, saveState, render, () => {
            draft.phase = "pairing";
          });
        },
      });
    });

    document.getElementById("finish-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const hasMissingResult = draft.results.some((result) => !result || !result.winner);
      if (hasMissingResult) {
        notify(t("resultRequired"), { variant: "danger" });
        return;
      }
      commitTournamentChange(tournament, saveState, render, () => {
        const nextRound = {
          byePlayerId: draft.pairing.byePlayerId || null,
          matches: draft.pairing.tables
            .filter((table) => table.a && table.b)
            .map((table) => ({ a: table.a, b: table.b })),
          results: draft.results,
          rankingGroups: [],
        };
        tournament.rounds.push(nextRound);
        tournament.rankingGroups = buildSwissRankingGroups(
          tournament.players,
          tournament.rounds,
          tournament.swissSettings || normalizeSwissSettings()
        );
        tournament.currentRoundDraft = null;
      });
      notify(t("roundSaved"), { variant: "success" });
    });
  }

  if (tournament.currentRoundDraft?.phase === "ranking") {
    attachRankingDnD(tournament, { saveState, render });

    document.getElementById("back-to-pairing")?.addEventListener("click", () => {
      openConfirmDialog({
        title: t("backToPairing"),
        message: t("confirmDiscardDraft"),
        confirmLabel: t("backToPairing"),
        onConfirm: () => {
          const draft = tournament.currentRoundDraft;
          commitTournamentChange(tournament, saveState, render, () => {
            draft.phase = "pairing";
            normalizeDraftRanking(tournament);
          });
        },
      });
    });

    document.getElementById("reset-ranking")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      commitTournamentChange(tournament, saveState, render, () => {
        draft.rankingGroups = currentPlayerIds(tournament).map(() => []);
      });
    });

    document.getElementById("finish-round")?.addEventListener("click", () => {
      const draft = tournament.currentRoundDraft;
      const normalized = normalizeRankingGroups(draft.rankingGroups, currentPlayerIds(tournament));
      const flattened = flattenRankingGroups(normalized);
      if (flattened.length !== tournament.players.length) {
        notify(t("invalidRanking"), { variant: "danger" });
        return;
      }
      commitTournamentChange(tournament, saveState, render, () => {
        tournament.rounds.push({
          byePlayerId: draft.pairing.byePlayerId || null,
          matches: draft.pairing.tables.map((table) => ({ a: table.a, b: table.b })),
          rankingGroups: normalized,
        });
        tournament.rankingGroups = normalized;
        tournament.currentRoundDraft = null;
      });
      notify(t("roundSaved"), { variant: "success" });
    });
  }
}
