import { STORAGE_KEY, createInitialState, migrateLoadedState, selectDefaultTournamentId } from "../tournament-state.js";
import { normalizeSwissSettings } from "../swiss.js";
import { NOTIFICATION_DEFAULT_DURATION_MS, NOTIFICATION_LIMIT, messages } from "./constants.js";
import {
  renderHomeView,
  renderSetupView,
  renderTournamentView,
} from "./renderers.js";
import { appBarComponent } from "./components/app-bar-component.js";
import { appFooterComponent } from "./components/app-footer-component.js";
import { bindRenderedComponents, renderComponent } from "./components/core/runtime.js";
import { homeHeroComponent } from "./components/home-hero-component.js";
import { homeToolbarComponent } from "./components/home-toolbar-component.js";
import { notificationStackComponent } from "./components/notification-stack-component.js";
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
  setupTournamentType: "manual",
  setupSwissConfig: normalizeSwissSettings(),
  setupReturnView: "home",
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
if (!root) {
  throw new Error("Expected #app root element.");
}

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
  state.selectedTournamentId = selectedId;
}

function openHomeView() {
  uiState.view = "home";
}

function openSetupView(mode, tournamentId = null, returnView = "home", tournamentType = "manual", swissSettings = null) {
  uiState.view = "setup";
  uiState.setupMode = mode;
  uiState.setupTournamentId = tournamentId;
  uiState.setupTournamentType = tournamentType;
  uiState.setupSwissConfig = normalizeSwissSettings(
    swissSettings || (tournamentType === "swiss" ? undefined : undefined)
  );
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
  const isHomeView = uiState.view === "home";
  const homeHeroContent = isHomeView
    ? renderComponent(homeHeroComponent, {
        key: "home-main-hero",
        props: { t, requestRender: render },
      })
    : "";
  const homeToolbarContent = isHomeView
    ? renderComponent(homeToolbarComponent, {
        key: "home-main-toolbar",
        props: { t },
      })
    : "";

  let viewContent = "";
  if (uiState.view === "setup") {
    viewContent = renderSetupView({ uiState, getTournamentById, t });
  } else if (uiState.view === "tournament") {
    viewContent = renderTournamentView({ getCurrentTournament, state, t, getPlayerName });
  } else {
    viewContent = renderHomeView({ state, t, homeHeroContent, homeToolbarContent });
  }

  const appBar = renderComponent(appBarComponent, {
    key: "main",
    props: {
      t,
      language: state.language,
      onLanguageChange: (nextLanguage) => {
        if (state.language === nextLanguage) {
          return;
        }
        state.language = nextLanguage;
        saveState();
        render();
      },
    },
  });
  const notificationStack = renderComponent(notificationStackComponent, {
    key: "main",
    props: { uiState, t, requestRender: render },
  });
  const appFooter = renderComponent(appFooterComponent, {
    key: "main",
  });

  root.innerHTML = `
    ${appBar}
    ${notificationStack}
    ${viewContent}
    ${appFooter}
  `;

  bindRenderedComponents();
  attachGlobalListeners({ dismissNotification });
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
