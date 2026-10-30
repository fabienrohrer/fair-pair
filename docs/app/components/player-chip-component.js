import { getPlayerAge } from "../../tournament-state.js";
import { escapeHtml } from "../utils.js";

function getPlayerHue(tournament, playerId) {
  const playerHue = tournament.players.find((player) => player.id === playerId)?.hue;
  if (Number.isFinite(playerHue)) {
    const normalized = Math.round(playerHue) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  const safe = `${playerId}`;
  let hash = 0;
  for (let index = 0; index < safe.length; index += 1) {
    hash = safe.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getPlayerColorStyle(hue) {
  const start = (hue + 18) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 80% 62%) 0%, hsl(${start} 80% 68%) 100%)`,
    boxShadow: `0 0.35rem 0.8rem hsl(${hue} 80% 55% / 25%)`,
  };
}

function buildPlayerChipTooltip(tournament, playerId) {
  const player = tournament.players.find((item) => item.id === playerId) || null;
  if (!player) {
    return "";
  }

  const fragments = [player.name];
  if (player.dateOfBirth) {
    fragments.push(`DOB: ${player.dateOfBirth}`);
  }
  const age = getPlayerAge(player);
  if (age !== null) {
    fragments.push(`Age: ${age}`);
  }

  return fragments.join(" • ");
}

export const playerChipComponent = {
  name: "player-chip",
  render({ props }) {
    const {
      tournament,
      playerId,
      dragType,
      origin,
      getPlayerName,
      isDraggable = true,
    } = props;

    const palette = getPlayerColorStyle(getPlayerHue(tournament, playerId));
    const tooltip = buildPlayerChipTooltip(tournament, playerId);
    const label = escapeHtml(getPlayerName(tournament, playerId));

    return `
      <button
        type="button"
        class="player-chip"
        draggable="${isDraggable ? "true" : "false"}"
        data-drag-type="${escapeHtml(dragType)}"
        data-player-id="${escapeHtml(playerId)}"
        data-origin="${escapeHtml(origin)}"
        title="${escapeHtml(tooltip)}"
        aria-label="${escapeHtml(label)}"
        style="background: ${palette.background}; box-shadow: ${palette.boxShadow};"
      >
        ${label}
      </button>
    `;
  },
};
