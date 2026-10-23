export function detectDefaultLanguage() {
  const browserLanguage = navigator.language?.toLowerCase() || "en";
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

export function parsePlayersFromText(text) {
  return text
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createTournamentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function createNotificationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `n-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function escapeHtml(value) {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
