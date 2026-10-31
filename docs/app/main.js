import {
  STORAGE_KEY,
  createInitialState,
  migrateLoadedState,
  normalizePlayerEntries,
  selectDefaultTournamentId,
} from "../tournament-state.js";
import { normalizeSwissSettings } from "../swiss.js";
import { NOTIFICATION_DEFAULT_DURATION_MS, NOTIFICATION_LIMIT, messages } from "./constants.js";
import {
  renderHomeView,
  renderSetupView,
  renderTournamentView,
} from "./renderers.js";
import { appHeaderComponent } from "./components/app-header-component.js";
import { appFooterPanelComponent } from "./components/app-footer-panel-component.js";
import { bindRenderedComponents, renderComponent } from "./components/core/runtime.js";
import { homeEmptyStateComponent } from "./components/home-empty-state-component.js";
import { homeHeroBannerComponent } from "./components/home-hero-banner-component.js";
import { homeActionsToolbarComponent } from "./components/home-actions-toolbar-component.js";
import { notificationListComponent } from "./components/notification-list-component.js";
import { confirmDialogComponent } from "./components/confirm-dialog-component.js";
import { setupHeaderComponent } from "./components/setup-header-component.js";
import { setupSwissSettingsComponent } from "./components/setup-swiss-settings-component.js";
import { setupTypePanelComponent } from "./components/setup-type-panel-component.js";
import { tournamentEmptyStateComponent } from "./components/tournament-empty-state-component.js";
import { tournamentHeaderComponent } from "./components/tournament-header-component.js";
import { tournamentRoundIntroCardComponent } from "./components/tournament-round-intro-card-component.js";
import {
  attachGlobalListeners,
  attachHomeListeners,
  attachSetupListeners,
  attachTournamentListeners,
} from "./listeners/index.js";
import { createNotificationId, detectDefaultLanguage } from "./utils.js";

const uiState = {
  view: "home",
  setupMode: "create",
  setupTournamentId: null,
  setupTournamentType: "manual",
  setupSwissConfig: normalizeSwissSettings(),
  setupPlayers: [],
  setupReturnView: "home",
  notifications: [],
  confirmDialog: null,
};
const HOME_ROUTE = { view: "home" };
let routeSyncMode = "replace";
let lastRouteKey = "";

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
  const tournament = mode === "edit" ? getTournamentById(tournamentId) : null;
  uiState.setupPlayers = normalizePlayerEntries(
    tournament?.players || []
  );
  uiState.setupReturnView = returnView;
}

function openTournamentView(tournamentId) {
  selectTournament(tournamentId);
  uiState.view = "tournament";
}

function queueRouteSync(mode) {
  routeSyncMode = mode;
}

function normalizeRouteReturnView(value) {
  return value === "tournament" ? "tournament" : "home";
}

function getRouteFromUiState() {
  if (uiState.view === "setup") {
    if (uiState.setupMode === "edit" && getTournamentById(uiState.setupTournamentId)) {
      return {
        view: "setup",
        mode: "edit",
        tournamentId: uiState.setupTournamentId,
        returnView: normalizeRouteReturnView(uiState.setupReturnView),
      };
    }
    return {
      view: "setup",
      mode: "create",
      returnView: normalizeRouteReturnView(uiState.setupReturnView),
    };
  }

  if (uiState.view === "tournament" && getTournamentById(state.selectedTournamentId)) {
    return { view: "tournament", tournamentId: state.selectedTournamentId };
  }

  return HOME_ROUTE;
}

function buildUrlFromRoute(route) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("view", route.view);

  if (route.view === "tournament" && route.tournamentId) {
    url.searchParams.set("tournamentId", route.tournamentId);
  }

  if (route.view === "setup") {
    url.searchParams.set("mode", route.mode === "edit" ? "edit" : "create");
    if (route.mode === "edit" && route.tournamentId) {
      url.searchParams.set("tournamentId", route.tournamentId);
    }
    if (route.returnView === "tournament") {
      url.searchParams.set("returnView", "tournament");
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function parseRouteFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  if (view === "tournament") {
    return {
      view: "tournament",
      tournamentId: params.get("tournamentId"),
    };
  }

  if (view === "setup") {
    const mode = params.get("mode") === "edit" ? "edit" : "create";
    return {
      view: "setup",
      mode,
      tournamentId: params.get("tournamentId"),
      returnView: normalizeRouteReturnView(params.get("returnView")),
    };
  }

  return HOME_ROUTE;
}

function applyRoute(route) {
  if (route.view === "tournament") {
    const tournament = getTournamentById(route.tournamentId);
    if (!tournament) {
      return false;
    }
    openTournamentView(tournament.id);
    return true;
  }

  if (route.view === "setup") {
    if (route.mode === "edit") {
      const tournament = getTournamentById(route.tournamentId);
      if (!tournament) {
        return false;
      }
      selectTournament(tournament.id);
      openSetupView(
        "edit",
        tournament.id,
        normalizeRouteReturnView(route.returnView),
        tournament.tournamentType || "manual",
        tournament.swissSettings
      );
      return true;
    }

    openSetupView("create", null, normalizeRouteReturnView(route.returnView));
    return true;
  }

  openHomeView();
  return true;
}

function syncRouteWithHistory() {
  const route = getRouteFromUiState();
  const routeKey = JSON.stringify(route);
  if (routeKey === lastRouteKey) {
    routeSyncMode = null;
    return;
  }

  if (routeSyncMode === "skip") {
    lastRouteKey = routeKey;
    routeSyncMode = null;
    return;
  }

  const nextUrl = buildUrlFromRoute(route);
  if (routeSyncMode === "replace") {
    window.history.replaceState(route, "", nextUrl);
  } else {
    window.history.pushState(route, "", nextUrl);
  }

  lastRouteKey = routeKey;
  routeSyncMode = null;
}

function getSetupSwissViewModel() {
  const isEdit = uiState.setupMode === "edit";
  const tournament = isEdit ? getTournamentById(uiState.setupTournamentId) : null;
  const swissSettings = normalizeSwissSettings(
    tournament?.swissSettings || uiState.setupSwissConfig || undefined
  );
  return {
    swissSettings,
    swissSettingsVisible: uiState.setupTournamentType === "swiss",
  };
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

function openConfirmDialog({ title, message, confirmLabel, onConfirm = () => {} }) {
  uiState.confirmDialog = {
    title,
    message,
    confirmLabel,
    cancelLabel: t("cancel"),
    onConfirm,
  };
  render();
}

function closeConfirmDialog() {
  if (!uiState.confirmDialog) {
    return;
  }
  uiState.confirmDialog = null;
  render();
}

function render() {
  const isHomeView = uiState.view === "home";
  const isSetupView = uiState.view === "setup";
  const isTournamentView = uiState.view === "tournament";

  const homeHeroContent = isHomeView
    ? renderComponent(homeHeroBannerComponent, {
        key: "home-main-hero",
        props: { t, requestRender: render },
      })
    : "";
  const homeToolbarContent = isHomeView
    ? renderComponent(homeActionsToolbarComponent, {
        key: "home-main-toolbar",
        props: { t },
      })
    : "";
  const homeEmptyStateContent = isHomeView
    ? renderComponent(homeEmptyStateComponent, {
        key: "home-main-empty-state",
        props: { t },
      })
    : "";
  const setupHeaderContent = isSetupView
    ? renderComponent(setupHeaderComponent, {
        key: "setup-main-header",
        props: { t, isEdit: uiState.setupMode === "edit" },
      })
    : "";
  const setupTypePanelContent = isSetupView
    ? renderComponent(setupTypePanelComponent, {
        key: "setup-main-type-selector",
        props: { t, setupTournamentType: uiState.setupTournamentType },
      })
    : "";
  const setupSwissViewModel = isSetupView ? getSetupSwissViewModel() : null;
  const setupSwissSettingsContent =
    isSetupView && setupSwissViewModel
      ? renderComponent(setupSwissSettingsComponent, {
          key: "setup-main-swiss-settings",
          props: {
            t,
            swissSettingsVisible: setupSwissViewModel.swissSettingsVisible,
            swissSettings: setupSwissViewModel.swissSettings,
          },
        })
      : "";
  const tournament = isTournamentView ? getCurrentTournament() : null;
  const tournamentEmptyStateContent = isTournamentView
    ? renderComponent(tournamentEmptyStateComponent, {
        key: "tournament-main-empty-state",
        props: { t },
      })
    : "";
  const tournamentHeaderContent =
    isTournamentView && tournament
      ? renderComponent(tournamentHeaderComponent, {
          key: `tournament-header-${tournament.id}`,
          props: { t, tournamentName: tournament.name },
        })
      : "";
  const tournamentRoundIntroContent =
    isTournamentView && tournament && !tournament.currentRoundDraft
      ? renderComponent(tournamentRoundIntroCardComponent, {
          key: `tournament-round-intro-${tournament.id}`,
          props: {
            t,
            tournamentName: tournament.name,
            roundsCount: tournament.rounds.length,
          },
        })
      : "";

  let viewContent = "";
  if (uiState.view === "setup") {
    viewContent = renderSetupView({
      uiState,
      getTournamentById,
      t,
      setupHeaderContent,
      setupTypePanelContent,
      setupSwissSettingsContent,
    });
  } else if (uiState.view === "tournament") {
    viewContent = renderTournamentView({
      getCurrentTournament,
      state,
      t,
      getPlayerName,
      tournamentHeaderContent,
      tournamentRoundIntroContent,
      tournamentEmptyStateContent,
    });
  } else {
    viewContent = renderHomeView({ state, t, homeHeroContent, homeToolbarContent, homeEmptyStateContent });
  }

  const appHeader = renderComponent(appHeaderComponent, {
    key: "main",
    props: {
      t,
      language: state.language,
      onHomeRequest: () => {
        openHomeView();
        render();
      },
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
  const notificationList = renderComponent(notificationListComponent, {
    key: "main",
    props: { uiState, t, requestRender: render },
  });
  const confirmDialogContent = uiState.confirmDialog
    ? renderComponent(confirmDialogComponent, {
        key: "main-confirm-dialog",
        props: {
          ...uiState.confirmDialog,
          onClose: closeConfirmDialog,
        },
      })
    : "";
  const appFooterPanel = renderComponent(appFooterPanelComponent, {
    key: "main",
  });

  root.innerHTML = `
    ${appHeader}
    ${notificationList}
    ${viewContent}
    ${confirmDialogContent}
    ${appFooterPanel}
  `;

  bindRenderedComponents();
  syncRouteWithHistory();
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
      openConfirmDialog,
    });
  } else if (uiState.view === "tournament") {
    attachTournamentListeners({
      t,
      saveState,
      render,
      notify,
      openHomeView,
      getCurrentTournament,
      openConfirmDialog,
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
      openConfirmDialog,
    });
  }
}

export function initApp() {
  selectTournament(state.selectedTournamentId);
  const routeApplied = applyRoute(parseRouteFromLocation());
  if (!routeApplied) {
    openHomeView();
  }
  window.addEventListener("popstate", () => {
    const didApplyRoute = applyRoute(parseRouteFromLocation());
    if (!didApplyRoute) {
      openHomeView();
      queueRouteSync("replace");
    } else {
      queueRouteSync("skip");
    }
    render();
  });
  saveState();
  queueRouteSync("replace");
  render();
}
