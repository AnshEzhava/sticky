/**
 * localStorage is the only persistence layer. Values are stored as YAML so the
 * bytes on disk and the bytes in a downloaded file are the same format.
 */

import { DataError, fromYaml, normalizeDatabase, toYaml } from "./yaml";
import { DB_VERSION } from "./types";
import type { Database, ThemeMode } from "./types";

const DB_KEY = "sticky.database.v1";
const BACKUP_KEY = "sticky.database.v1.backup";
const SESSION_KEY = "sticky.session.v1";
const THEME_KEY = "sticky.theme.v1";

export interface Session {
  accountId: string;
  clientId: string | null;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Private browsing and full quotas make localStorage throw. Nothing here is
 * worth crashing the board for: a failed write costs persistence, not the
 * session, so every call is contained.
 */
function guarded<T>(operation: () => T, fallback: T, what: string): T {
  try {
    return operation();
  } catch (error) {
    console.warn(`Sticky could not ${what}`, error);
    return fallback;
  }
}

export function emptyDatabase(): Database {
  return { version: DB_VERSION, accounts: [] };
}

export interface LoadResult {
  database: Database;
  recovered: boolean;
}

export function loadDatabase(): LoadResult {
  const store = storage();
  if (!store) return { database: emptyDatabase(), recovered: false };

  const raw = guarded(() => store.getItem(DB_KEY), null, "read its saved data");
  if (!raw) return { database: emptyDatabase(), recovered: false };

  try {
    return { database: normalizeDatabase(fromYaml(raw)), recovered: false };
  } catch (error) {
    console.warn("Sticky could not read its saved data", error);
    const backup = guarded(() => store.getItem(BACKUP_KEY), null, "read the backup");
    if (backup) {
      try {
        return { database: normalizeDatabase(fromYaml(backup)), recovered: true };
      } catch {
        /* fall through */
      }
    }
    return { database: emptyDatabase(), recovered: false };
  }
}

export function saveDatabase(database: Database): { ok: true } | { ok: false; message: string } {
  const store = storage();
  if (!store) return { ok: false, message: "This browser is not allowing local storage." };
  try {
    const previous = store.getItem(DB_KEY);
    const next = toYaml(database);
    store.setItem(DB_KEY, next);
    if (previous && previous !== next) store.setItem(BACKUP_KEY, previous);
    return { ok: true };
  } catch (error) {
    console.warn("Sticky could not save", error);
    return { ok: false, message: "Could not save to this browser (storage may be full)." };
  }
}

export function clearDatabase(): void {
  const store = storage();
  if (!store) return;
  guarded(
    () => {
      store.removeItem(DB_KEY);
      store.removeItem(BACKUP_KEY);
      store.removeItem(SESSION_KEY);
    },
    undefined,
    "clear its saved data",
  );
}

export function loadSession(): Session | null {
  const store = storage();
  if (!store) return null;
  const raw = guarded(() => store.getItem(SESSION_KEY), null, "read the session");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.accountId !== "string") return null;
    return {
      accountId: parsed.accountId,
      clientId: typeof parsed.clientId === "string" ? parsed.clientId : null,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  const store = storage();
  if (!store) return;
  guarded(
    () => {
      if (!session) store.removeItem(SESSION_KEY);
      else store.setItem(SESSION_KEY, JSON.stringify(session));
    },
    undefined,
    "remember the session",
  );
}

export function loadTheme(): ThemeMode {
  const store = storage();
  const raw = store ? guarded(() => store.getItem(THEME_KEY), null, "read the theme") : null;
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

export function saveTheme(theme: ThemeMode): void {
  const store = storage();
  if (!store) return;
  guarded(() => store.setItem(THEME_KEY, theme), undefined, "remember the theme");
}

export function readDatabaseOrThrow(text: string): Database {
  return normalizeDatabase(fromYaml(text));
}

export { DataError };
