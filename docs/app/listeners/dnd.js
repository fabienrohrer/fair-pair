import {
  assignPlayerToPairingTarget,
  assignPlayerToRankingGroup,
  insertPlayerIntoRankingDraft,
  removePlayerFromRankingDraft,
  touchTournament,
} from "./shared.js";
import { currentPlayerIds } from "../renderers/shared-renderers.js";

function attachPlayerDragAndDrop({
  dragType,
  dropZoneSelector,
  onDropPlayer,
}) {
  const activeTouchDragClass = "fp-touch-drag-active";
  const activeDropTargetClass = "fp-drop-target-active";
  let activeDesktopDropZone = null;
  let activeDesktopDragType = null;
  let activeDesktopPlayerId = null;
  const touchMoveOptions = { passive: false };
  const preventTouchScroll = (moveEvent) => {
    moveEvent.preventDefault();
  };

  const clearActiveDesktopDropZone = () => {
    if (!activeDesktopDropZone) {
      return;
    }
    activeDesktopDropZone.classList.remove(activeDropTargetClass);
    activeDesktopDropZone = null;
  };

  const setActiveDesktopDropZone = (zone) => {
    if (zone === activeDesktopDropZone) {
      return;
    }
    clearActiveDesktopDropZone();
    if (!zone) {
      return;
    }
    zone.classList.add(activeDropTargetClass);
    activeDesktopDropZone = zone;
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
      const playerId = chip.dataset.playerId || "";
      event.dataTransfer.setData("text/plain", playerId);
      event.dataTransfer.setData("application/x-fairpair-drag-type", dragType);
      activeDesktopDragType = dragType;
      activeDesktopPlayerId = playerId;
    });
    chip.addEventListener("dragend", () => {
      activeDesktopDragType = null;
      activeDesktopPlayerId = null;
      clearActiveDesktopDropZone();
    });
  });

  document.querySelectorAll(dropZoneSelector).forEach((zone) => {
    zone.addEventListener("dragenter", (event) => {
      const dtType = event.dataTransfer?.getData("application/x-fairpair-drag-type");
      if (dtType && dtType !== dragType) {
        return;
      }
      if (!dtType && activeDesktopDragType && activeDesktopDragType !== dragType) {
        return;
      }
      setActiveDesktopDropZone(zone);
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      const dtType = event.dataTransfer?.getData("application/x-fairpair-drag-type");
      if (dtType && dtType !== dragType) {
        return;
      }
      if (!dtType && activeDesktopDragType && activeDesktopDragType !== dragType) {
        return;
      }
      setActiveDesktopDropZone(zone);
    });
    zone.addEventListener("dragleave", (event) => {
      if (event.currentTarget !== event.target) {
        return;
      }
      if (activeDesktopDropZone === zone) {
        clearActiveDesktopDropZone();
      }
    });
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      clearActiveDesktopDropZone();
      const dtType = event.dataTransfer.getData("application/x-fairpair-drag-type");
      const droppedType = dtType || activeDesktopDragType;
      if (droppedType !== dragType) {
        return;
      }
      const playerId = event.dataTransfer.getData("text/plain") || activeDesktopPlayerId;
      applyDrop(playerId, zone);
      activeDesktopDragType = null;
      activeDesktopPlayerId = null;
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
    dropZoneSelector: ".ranking-drop-zone, .ranking-unassigned-drop-zone, .ranking-insert-drop-zone",
    onDropPlayer: (playerId, zone) => {
      if (zone.classList.contains("ranking-unassigned-drop-zone")) {
        removePlayerFromRankingDraft(draft, playerId);
      } else if (zone.classList.contains("ranking-insert-drop-zone")) {
        insertPlayerIntoRankingDraft(draft, playerId, Number(zone.dataset.rankInsertIndex), currentPlayerIds(tournament));
      } else {
        assignPlayerToRankingGroup(draft, playerId, Number(zone.dataset.rankIndex));
      }
      touchTournament(tournament, saveState, render);
      return true;
    },
  });
}
