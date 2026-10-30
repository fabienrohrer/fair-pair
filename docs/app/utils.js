export function detectDefaultLanguage() {
  const browserLanguage = navigator.language?.toLowerCase() || "en";
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

function normalizeDateOfBirth(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const date = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : trimmed;
}

export function parsePlayersFromText(text) {
  return parseImportedPlayersText(text).map((player) => player.name);
}

export function parseImportedPlayersText(text) {
  return text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((entry) => {
      const commaIndex = entry.indexOf(",");
      if (commaIndex === -1) {
        return { name: entry, dateOfBirth: null };
      }

      const namePart = entry.slice(0, commaIndex).trim();
      const valuePart = entry.slice(commaIndex + 1).trim();
      const dateOfBirth = normalizeDateOfBirth(valuePart);

      if (!dateOfBirth) {
        return { name: entry, dateOfBirth: null };
      }

      return {
        name: namePart || entry,
        dateOfBirth,
      };
    });
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
