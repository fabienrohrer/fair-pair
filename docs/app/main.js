import { STORAGE_KEY, createInitialState, migrateLoadedState, selectDefaultTournamentId } from "../tournament-state.js";
import { NOTIFICATION_DEFAULT_DURATION_MS, NOTIFICATION_LIMIT, messages } from "./constants.js";
import {
  renderAppBar,
  renderHomeView,
  renderNotificationStack,
  renderSetupView,
  renderTournamentView,
} from "./renderers.js";
import {
  attachGlobalListeners,
  attachHomeListeners,
  attachSetupListeners,
  attachTournamentListeners,
} from "./listeners.js";
import { createNotificationId, detectDefaultLanguage } from "./utils.js";

const uiState = {
  view: "home",
  setupMode: "create",
  setupTournamentId: null,
  setupReturnView: "home",
  selectedTournamentId: null,
  notifications: [],
};

function loadState() {
  const defaultLanguage = detectDefaultLanguage();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState(defaultLanguage);
  }
  try {
    return migrateLoadedState(JSON.parse(raw), defaultLanguage);
  } catch {
    return createInitialState(defaultLanguage);
  }
}

const state = loadState();
const root = document.getElementById("app");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function t(key) {
  return messages[state.language][key];
}

function getTournamentById(tournamentId) {
  return state.tournaments.find((item) => item.id === tournamentId) || null;
}

function getCurrentTournament() {
  return getTournamentById(state.selectedTournamentId);
}

function getPlayerName(tournament, playerId) {
  return tournament.players.find((player) => player.id === playerId)?.name || playerId;
}

function selectTournament(tournamentId) {
  const selectedId = selectDefaultTournamentId(state.tournaments, tournamentId);
  uiState.selectedTournamentId = selectedId;
  state.selectedTournamentId = selectedId;
}

function openHomeView() {
  uiState.view = "home";
}

function openSetupView(mode, tournamentId = null, returnView = "home") {
  uiState.view = "setup";
  uiState.setupMode = mode;
  uiState.setupTournamentId = tournamentId;
  uiState.setupReturnView = returnView;
}

function openTournamentView(tournamentId) {
  selectTournament(tournamentId);
  uiState.view = "tournament";
}

function dismissNotification(notificationId) {
  const nextNotifications = uiState.notifications.filter((item) => item.id !== notificationId);
  if (nextNotifications.length === uiState.notifications.length) {
    return;
  }
  uiState.notifications = nextNotifications;
  render();
}

function notify(message, options = {}) {
  if (!message) {
    return;
  }
  const variant = options.variant || "info";
  const id = createNotificationId();
  const notification = {
    id,
    message,
    variant,
  };
  uiState.notifications = [...uiState.notifications, notification].slice(-NOTIFICATION_LIMIT);

  const autoDismissMs = options.autoDismissMs ?? NOTIFICATION_DEFAULT_DURATION_MS[variant] ?? 5000;
  if (autoDismissMs > 0) {
    window.setTimeout(() => {
      dismissNotification(id);
    }, autoDismissMs);
  }

  render();
}

function render() {
  let viewContent = "";
  if (uiState.view === "setup") {
    viewContent = renderSetupView({ uiState, getTournamentById, t });
  } else if (uiState.view === "tournament") {
    viewContent = renderTournamentView({ getCurrentTournament, state, t, getPlayerName });
  } else {
    viewContent = renderHomeView({ state, t });
  }

  root.innerHTML = `
    ${renderAppBar({ t, state })}
    ${renderNotificationStack({ uiState, t })}
    ${viewContent}
    <footer class="fairpair-footer mt-4">
      <div class="fairpair-footer-inner">
        <div class="fairpair-footer-brand">
          <img class="brand-logo fairpair-footer-logo" src="./fair-pair-logo.svg" alt="Fair Pair logo" />
        </div>
        <div class="fairpair-footer-meta">
          <a href="https://github.com/fabienrohrer/fair-pair" target="_blank" rel="noopener noreferrer" class="fairpair-icon-link" aria-label="Fair Pair on GitHub">
            <i class="bi bi-github fairpair-icon"></i>
            <span>GitHub</span>
          </a>
          <span class="fairpair-footer-dot">•</span>
          <span>Open source</span>
          <span class="fairpair-footer-dot">•</span>
          <span>Made with AI</span>
          <i class="bi bi-stars fairpair-icon fairpair-icon-small" aria-hidden="true"></i>
        </div>
      </div>
    </footer>
  `;

  attachGlobalListeners({ state, t, saveState, render, dismissNotification });
  if (uiState.view === "setup") {
    attachSetupListeners({
      state,
      uiState,
      t,
      saveState,
      render,
      notify,
      openHomeView,
      openTournamentView,
      selectTournament,
      getTournamentById,
    });
  } else if (uiState.view === "tournament") {
    attachTournamentListeners({
      state,
      t,
      saveState,
      render,
      notify,
      openHomeView,
      getCurrentTournament,
    });
  } else {
    attachHomeListeners({
      state,
      t,
      saveState,
      render,
      openHomeView,
      openSetupView,
      openTournamentView,
      selectTournament,
    });
  }
}

export function initApp() {
  selectTournament(state.selectedTournamentId);
  saveState();
  render();
}
