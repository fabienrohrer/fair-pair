import {
  assignPlayerToPairingTarget,
  assignPlayerToRankingGroup,
  removePlayerFromRankingDraft,
  touchTournament,
} from "./shared.js";

function attachPlayerDragAndDrop({
  dragType,
  dropZoneSelector,
  onDropPlayer,
}) {
  const activeTouchDragClass = "fp-touch-drag-active";
  const activeDropTargetClass = "fp-drop-target-active";
  const touchMoveOptions = { passive: false };
  const preventTouchScroll = (moveEvent) => {
    moveEvent.preventDefault();
  };

  const setTouchDragActive = (isActive) => {
    document.body.classList.toggle(activeTouchDragClass, isActive);
    document.documentElement.classList.toggle(activeTouchDragClass, isActive);
    if (isActive) {
      window.addEventListener("touchmove", preventTouchScroll, touchMoveOptions);
      return;
    }
    window.removeEventListener("touchmove", preventTouchScroll, touchMoveOptions);
  };

  function applyDrop(playerId, zone) {
    if (!playerId || !zone) {
      return;
    }
    onDropPlayer(playerId, zone);
  }

  const createTouchGhost = (chip) => {
    const ghost = chip.cloneNode(true);
    ghost.classList.add("fp-drag-ghost");
    const rect = chip.getBoundingClientRect();
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    return ghost;
  };

  const moveTouchGhost = (ghost, clientX, clientY) => {
    if (!ghost) {
      return;
    }
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;
  };

  document.querySelectorAll(`[draggable="true"][data-drag-type="${dragType}"]`).forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", chip.dataset.playerId);
      event.dataTransfer.setData("application/x-fairpair-drag-type", dragType);
    });
  });

  document.querySelectorAll(dropZoneSelector).forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      if (event.dataTransfer.getData("application/x-fairpair-drag-type") !== dragType) {
        return;
      }
      applyDrop(event.dataTransfer.getData("text/plain"), zone);
    });
  });

  document
    .querySelectorAll(`[draggable="true"][data-drag-type="${dragType}"][data-player-id]`)
    .forEach((chip) => {
      chip.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch" && event.pointerType !== "pen") {
          return;
        }
        const playerId = chip.dataset.playerId;
        if (!playerId) {
          return;
        }

        let activeDropZone = null;
        let ghost = null;

        const clearActiveDropZone = () => {
          if (activeDropZone) {
            activeDropZone.classList.remove(activeDropTargetClass);
            activeDropZone = null;
          }
        };

        const cleanup = () => {
          clearActiveDropZone();
          setTouchDragActive(false);
          chip.classList.remove("fp-drag-source");
          if (ghost) {
            ghost.remove();
            ghost = null;
          }
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          window.removeEventListener("pointercancel", handlePointerCancel);
        };

        const updateDropTargetFromPoint = (clientX, clientY) => {
          const topElement = document.elementFromPoint(clientX, clientY);
          const nextDropZone = topElement?.closest(dropZoneSelector) || null;
          if (nextDropZone === activeDropZone) {
            return;
          }
          clearActiveDropZone();
          if (nextDropZone) {
            nextDropZone.classList.add(activeDropTargetClass);
            activeDropZone = nextDropZone;
          }
        };

        const handlePointerMove = (moveEvent) => {
          if (moveEvent.pointerId !== event.pointerId) {
            return;
          }
          moveEvent.preventDefault();
          moveTouchGhost(ghost, moveEvent.clientX, moveEvent.clientY);
          updateDropTargetFromPoint(moveEvent.clientX, moveEvent.clientY);
        };

        const handlePointerUp = (upEvent) => {
          if (upEvent.pointerId !== event.pointerId) {
            return;
          }
          upEvent.preventDefault();
          const zoneToUse = activeDropZone;
          cleanup();
          if (zoneToUse) {
            applyDrop(playerId, zoneToUse);
          }
        };

        const handlePointerCancel = (cancelEvent) => {
          if (cancelEvent.pointerId !== event.pointerId) {
            return;
          }
          cleanup();
        };

        event.preventDefault();
        setTouchDragActive(true);
        chip.classList.add("fp-drag-source");
        ghost = createTouchGhost(chip);
        moveTouchGhost(ghost, event.clientX, event.clientY);
        if (typeof chip.setPointerCapture === "function") {
          chip.setPointerCapture(event.pointerId);
        }
        updateDropTargetFromPoint(event.clientX, event.clientY);
        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", handlePointerUp, { passive: false });
        window.addEventListener("pointercancel", handlePointerCancel, { passive: false });
      });
    });
}

export function attachPairingDnD(tournament, { saveState, render }) {
  const draft = tournament.currentRoundDraft;
  attachPlayerDragAndDrop({
    dragType: "pairing",
    dropZoneSelector: ".pairing-drop-zone",
    onDropPlayer: (playerId, zone) => {
      const type = zone.dataset.dropType;
      if (type === "pool") {
        assignPlayerToPairingTarget(draft, playerId, { type: "pool" });
      } else if (type === "bye") {
        assignPlayerToPairingTarget(draft, playerId, { type: "bye" });
      } else {
        assignPlayerToPairingTarget(draft, playerId, {
          type: "slot",
          tableIndex: Number(zone.dataset.tableIndex),
          slot: zone.dataset.slot,
        });
      }
      touchTournament(tournament, saveState, render);
      return true;
    },
  });
}

export function attachRankingDnD(tournament, { saveState, render }) {
  const draft = tournament.currentRoundDraft;
  attachPlayerDragAndDrop({
    dragType: "ranking",
    dropZoneSelector: ".ranking-drop-zone, .ranking-unassigned-drop-zone",
    onDropPlayer: (playerId, zone) => {
      if (zone.classList.contains("ranking-unassigned-drop-zone")) {
        removePlayerFromRankingDraft(draft, playerId);
      } else {
        assignPlayerToRankingGroup(draft, playerId, Number(zone.dataset.rankIndex));
      }
      touchTournament(tournament, saveState, render);
      return true;
    },
  });
}
