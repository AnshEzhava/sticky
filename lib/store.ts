"use client";

/**
 * The whole application state lives here: a single Database document that is
 * persisted to localStorage as YAML and can be exported as a .yml file.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { hashPassword, randomId, verifyPassword } from "./crypto";
import { createSampleClients, createStarterClient } from "./seed";
import { loadDatabase, loadSession, loadTheme, saveDatabase, saveSession, saveTheme } from "./storage";
import { DB_VERSION, STICKY_COLORS } from "./types";
import type { Account, ClientList, Database, Sticky, StickyColor, ThemeMode } from "./types";
import { accountToYaml, clientToYaml, databaseToYaml, DataError, type ImportedData } from "./yaml";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface Toast {
  id: string;
  message: string;
  tone: "info" | "success" | "error";
}

export interface AccountDraft {
  displayName: string;
  username: string;
  password: string;
  withSample: boolean;
}

export interface Store {
  ready: boolean;
  database: Database;
  account: Account | null;
  client: ClientList | null;
  theme: ThemeMode;
  dark: boolean;
  saveState: SaveState;
  toasts: Toast[];
  dismissToast: (id: string) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
  setTheme: (theme: ThemeMode) => void;
  createAccount: (draft: AccountDraft) => Promise<string | null>;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => void;
  renameAccount: (displayName: string) => void;
  changePassword: (current: string, next: string) => Promise<string | null>;
  deleteAccount: (accountId: string) => void;
  selectClient: (clientId: string) => void;
  addClient: (name: string) => string | null;
  renameClient: (clientId: string, name: string) => void;
  recolorClient: (clientId: string, color: StickyColor) => void;
  deleteClient: (clientId: string) => void;
  addSticky: (clientId: string, init?: Partial<Sticky>) => string;
  updateSticky: (clientId: string, stickyId: string, patch: Partial<Sticky>) => void;
  deleteSticky: (clientId: string, stickyId: string) => void;
  duplicateSticky: (clientId: string, stickyId: string) => void;
  reorderSticky: (clientId: string, fromIndex: number, toIndex: number) => void;
  pinSticky: (clientId: string, stickyId: string, pinned: boolean) => void;
  replaceClient: (clientId: string, client: ClientList) => void;
  appliedImport: (data: ImportedData, mode: "merge" | "replace") => string;
  exportAccountYaml: () => string;
  exportClientYaml: (clientId?: string) => string;
  exportDatabaseYaml: () => string;
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

/* ---------------------------------------------------------------- boot -- */

interface BootSnapshot {
  database: Database;
  accountId: string | null;
  clientId: string | null;
  theme: ThemeMode;
  recovered: boolean;
}

const EMPTY_BOOT: BootSnapshot = {
  database: { version: DB_VERSION, accounts: [] },
  accountId: null,
  clientId: null,
  theme: "system",
  recovered: false,
};

let cachedBoot: BootSnapshot | null = null;

/**
 * Read the document out of localStorage. Called during render, never from an
 * effect: on the server it yields an empty document, and the board only paints
 * once `useHydrated` flips after hydration.
 */
function readBoot(): BootSnapshot {
  if (typeof window === "undefined") return EMPTY_BOOT;
  if (cachedBoot) return cachedBoot;

  const { database, recovered } = loadDatabase();
  const session = loadSession();
  const account = session ? database.accounts.find((a) => a.id === session.accountId) : undefined;

  cachedBoot = {
    database,
    accountId: account?.id ?? null,
    clientId: account ? (session?.clientId ?? account.clients[0]?.id ?? null) : null,
    theme: loadTheme(),
    recovered,
  };
  return cachedBoot;
}

function subscribeToNothing() {
  return () => {};
}

/** False while server rendering and during hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/** Live view of the operating system colour scheme. */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

function nextColor(client: ClientList | undefined): StickyColor {
  if (!client) return STICKY_COLORS[0];
  const used = client.stickies.length;
  return STICKY_COLORS[used % STICKY_COLORS.length];
}

export function useStickyStore(): Store {
  const boot = readBoot();
  const ready = useHydrated();
  const systemDark = useSystemDark();

  const [database, setDatabase] = useState<Database>(boot.database);
  const [accountId, setAccountId] = useState<string | null>(boot.accountId);
  const [clientId, setClientId] = useState<string | null>(boot.clientId);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<ThemeMode>(boot.theme);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = randomId("tst");
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!ready || !boot.recovered) return;
    const handle = window.setTimeout(
      () => notify("Restored your data from the automatic backup.", "info"),
      400,
    );
    return () => window.clearTimeout(handle);
  }, [ready, boot.recovered, notify]);

  /* ----------------------------------------------------------- persist -- */

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      const result = saveDatabase(database);
      setSaveState(result.ok ? "saved" : "error");
      if (!result.ok) notify(result.message, "error");
    }, 300);
    return () => window.clearTimeout(handle);
  }, [database, ready, notify]);

  useEffect(() => {
    if (!ready) return;
    saveSession(accountId ? { accountId, clientId } : null);
  }, [accountId, clientId, ready]);

  const dark = theme === "system" ? systemDark : theme === "dark";
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }, [dark, ready]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    saveTheme(next);
  }, []);

  /* ------------------------------------------------------------ derived -- */

  const account = useMemo(
    () => database.accounts.find((a) => a.id === accountId) ?? null,
    [database.accounts, accountId],
  );

  const client = useMemo(() => {
    if (!account) return null;
    return account.clients.find((c) => c.id === clientId) ?? account.clients[0] ?? null;
  }, [account, clientId]);

  /* ------------------------------------------------------------ mutate -- */

  const mutateAccount = useCallback(
    (mutator: (account: Account) => Account) => {
      if (!accountId) return;
      setDatabase((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.id === accountId ? mutator(a) : a)),
      }));
    },
    [accountId],
  );

  const mutateClient = useCallback(
    (targetId: string, mutator: (client: ClientList) => ClientList) => {
      mutateAccount((current) => ({
        ...current,
        clients: current.clients.map((c) => (c.id === targetId ? mutator(c) : c)),
      }));
    },
    [mutateAccount],
  );

  /* ----------------------------------------------------------- accounts -- */

  const createAccount = useCallback(
    async (draft: AccountDraft): Promise<string | null> => {
      const username = draft.username.trim();
      if (!USERNAME_RE.test(username)) {
        return "Usernames are 2-32 characters: letters, numbers, dot, dash or underscore.";
      }
      if (draft.password.length < 6) return "Use at least 6 characters for the password.";
      if (database.accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
        return "That username already exists in this browser.";
      }
      const password = await hashPassword(draft.password);
      const clients = draft.withSample ? createSampleClients() : [createStarterClient()];
      const now = new Date().toISOString();
      const account: Account = {
        id: randomId("acc"),
        username,
        displayName: draft.displayName.trim() || username,
        password,
        createdAt: now,
        clients,
      };
      setDatabase((prev) => ({ ...prev, accounts: [...prev.accounts, account] }));
      setAccountId(account.id);
      setClientId(clients[0]?.id ?? null);
      return null;
    },
    [database.accounts],
  );

  const signIn = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      const target = database.accounts.find(
        (a) => a.username.toLowerCase() === username.trim().toLowerCase(),
      );
      if (!target) return "No account with that username in this browser.";
      const ok = await verifyPassword(password, target.password);
      if (!ok) return "That password does not match.";
      setAccountId(target.id);
      setClientId(target.clients[0]?.id ?? null);
      return null;
    },
    [database.accounts],
  );

  const signOut = useCallback(() => {
    setAccountId(null);
    setClientId(null);
    saveSession(null);
  }, []);

  const renameAccount = useCallback(
    (displayName: string) => {
      mutateAccount((current) => ({ ...current, displayName: displayName.trim() || current.username }));
    },
    [mutateAccount],
  );

  const changePassword = useCallback(
    async (current: string, next: string): Promise<string | null> => {
      if (!account) return "Not signed in.";
      if (next.length < 6) return "Use at least 6 characters for the new password.";
      const ok = await verifyPassword(current, account.password);
      if (!ok) return "That is not your current password.";
      const password = await hashPassword(next);
      mutateAccount((acc) => ({ ...acc, password }));
      return null;
    },
    [account, mutateAccount],
  );

  const deleteAccount = useCallback(
    (targetId: string) => {
      setDatabase((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== targetId) }));
      if (targetId === accountId) {
        setAccountId(null);
        setClientId(null);
        saveSession(null);
      }
    },
    [accountId],
  );

  /* ------------------------------------------------------------ clients -- */

  const selectClient = useCallback((nextId: string) => setClientId(nextId), []);

  const addClient = useCallback(
    (name: string): string | null => {
      if (!accountId) return null;
      const now = new Date().toISOString();
      const created: ClientList = {
        id: randomId("cli"),
        name: name.trim() || "New client",
        color: STICKY_COLORS[(account?.clients.length ?? 0) % STICKY_COLORS.length],
        stickies: [],
        createdAt: now,
      };
      mutateAccount((current) => ({ ...current, clients: [...current.clients, created] }));
      setClientId(created.id);
      return created.id;
    },
    [accountId, account?.clients.length, mutateAccount],
  );

  const renameClient = useCallback(
    (targetId: string, name: string) => {
      mutateClient(targetId, (current) => ({ ...current, name: name.trim() || current.name }));
    },
    [mutateClient],
  );

  const recolorClient = useCallback(
    (targetId: string, color: StickyColor) => {
      mutateClient(targetId, (current) => ({ ...current, color }));
    },
    [mutateClient],
  );

  const deleteClient = useCallback(
    (targetId: string) => {
      mutateAccount((current) => ({
        ...current,
        clients: current.clients.filter((c) => c.id !== targetId),
      }));
      setClientId((prev) => (prev === targetId ? null : prev));
    },
    [mutateAccount],
  );

  /* ------------------------------------------------------------ stickies -- */

  const addSticky = useCallback(
    (targetId: string, init?: Partial<Sticky>): string => {
      const now = new Date().toISOString();
      const sticky: Sticky = {
        id: randomId("stk"),
        title: "",
        body: "",
        color: nextColor(account?.clients.find((c) => c.id === targetId)),
        pinned: false,
        createdAt: now,
        updatedAt: now,
        ...init,
      };
      mutateClient(targetId, (current) => ({ ...current, stickies: [...current.stickies, sticky] }));
      return sticky.id;
    },
    [account?.clients, mutateClient],
  );

  const updateSticky = useCallback(
    (targetId: string, stickyId: string, patch: Partial<Sticky>) => {
      const now = new Date().toISOString();
      mutateClient(targetId, (current) => ({
        ...current,
        stickies: current.stickies.map((s) =>
          s.id === stickyId ? { ...s, ...patch, updatedAt: now } : s,
        ),
      }));
    },
    [mutateClient],
  );

  const deleteSticky = useCallback(
    (targetId: string, stickyId: string) => {
      mutateClient(targetId, (current) => ({
        ...current,
        stickies: current.stickies.filter((s) => s.id !== stickyId),
      }));
    },
    [mutateClient],
  );

  const duplicateSticky = useCallback(
    (targetId: string, stickyId: string) => {
      const now = new Date().toISOString();
      mutateClient(targetId, (current) => {
        const index = current.stickies.findIndex((s) => s.id === stickyId);
        if (index === -1) return current;
        const source = current.stickies[index];
        const copy: Sticky = {
          ...source,
          id: randomId("stk"),
          title: source.title ? source.title + " (copy)" : "",
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        const stickies = current.stickies.slice();
        stickies.splice(index + 1, 0, copy);
        return { ...current, stickies };
      });
    },
    [mutateClient],
  );

  const reorderSticky = useCallback(
    (targetId: string, fromIndex: number, toIndex: number) => {
      mutateClient(targetId, (current) => {
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= current.stickies.length ||
          toIndex >= current.stickies.length
        ) {
          return current;
        }
        const stickies = current.stickies.slice();
        const [moved] = stickies.splice(fromIndex, 1);
        stickies.splice(toIndex, 0, moved);
        return { ...current, stickies };
      });
    },
    [mutateClient],
  );

  const pinSticky = useCallback(
    (targetId: string, stickyId: string, pinned: boolean) => {
      const now = new Date().toISOString();
      mutateClient(targetId, (current) => {
        const index = current.stickies.findIndex((s) => s.id === stickyId);
        if (index === -1) return current;
        const stickies = current.stickies.map((s) =>
          s.id === stickyId ? { ...s, pinned, updatedAt: now } : s,
        );
        // Pinning is what puts a note first, so the array stays the one order.
        if (pinned && index > 0) {
          const [moved] = stickies.splice(index, 1);
          stickies.unshift(moved);
        }
        return { ...current, stickies };
      });
    },
    [mutateClient],
  );

  const replaceClient = useCallback(
    (targetId: string, next: ClientList) => {
      mutateClient(targetId, () => next);
    },
    [mutateClient],
  );

  /* -------------------------------------------------------------- import -- */

  const appliedImport = useCallback(
    (data: ImportedData, mode: "merge" | "replace"): string => {
      if (data.kind === "database") {
        if (mode === "replace") {
          setDatabase(data.database);
          const first = data.database.accounts[0] ?? null;
          setAccountId(first?.id ?? null);
          setClientId(first?.clients[0]?.id ?? null);
          return "Replaced everything with " + data.label + ".";
        }
        const existing = new Set(database.accounts.map((a) => a.username.toLowerCase()));
        const added = data.database.accounts.filter((a) => !existing.has(a.username.toLowerCase()));
        setDatabase((prev) => ({ ...prev, accounts: [...prev.accounts, ...added] }));
        return added.length === 0
          ? "Every account in that file already exists here."
          : "Added " + added.length + " account(s).";
      }

      if (data.kind === "account") {
        const exists = database.accounts.some(
          (a) => a.username.toLowerCase() === data.account.username.toLowerCase(),
        );
        if (exists && mode === "merge") {
          const merged = {
            ...data.account,
            clients: [
              ...(database.accounts.find(
                (a) => a.username.toLowerCase() === data.account.username.toLowerCase(),
              )?.clients ?? []),
              ...data.account.clients,
            ],
          };
          setDatabase((prev) => ({
            ...prev,
            accounts: prev.accounts.map((a) =>
              a.username.toLowerCase() === data.account.username.toLowerCase() ? merged : a,
            ),
          }));
          return "Merged the boards of " + data.account.username + ".";
        }
        setDatabase((prev) => ({ ...prev, accounts: [...prev.accounts, data.account] }));
        setAccountId(data.account.id);
        setClientId(data.account.clients[0]?.id ?? null);
        return "Imported the account " + data.account.username + ".";
      }

      // Client boards always land inside the signed-in account.
      if (!accountId) return "Sign in first, then import client boards.";
      mutateAccount((current) => ({ ...current, clients: [...current.clients, ...data.clients] }));
      const last = data.clients[data.clients.length - 1];
      if (last) setClientId(last.id);
      return "Imported " + data.label + ".";
    },
    [accountId, database.accounts, mutateAccount],
  );

  /* -------------------------------------------------------------- export -- */

  const exportAccountYaml = useCallback(() => {
    if (!account) return "";
    return accountToYaml(account);
  }, [account]);

  const exportClientYaml = useCallback(
    (targetId?: string) => {
      const target = targetId ? account?.clients.find((c) => c.id === targetId) : client;
      if (!target) return "";
      return clientToYaml(target);
    },
    [account?.clients, client],
  );

  const exportDatabaseYaml = useCallback(() => databaseToYaml(database), [database]);

  return {
    ready,
    database,
    account,
    client,
    theme,
    dark,
    saveState,
    toasts,
    dismissToast,
    notify,
    setTheme,
    createAccount,
    signIn,
    signOut,
    renameAccount,
    changePassword,
    deleteAccount,
    selectClient,
    addClient,
    renameClient,
    recolorClient,
    deleteClient,
    addSticky,
    updateSticky,
    deleteSticky,
    duplicateSticky,
    reorderSticky,
    pinSticky,
    replaceClient,
    appliedImport,
    exportAccountYaml,
    exportClientYaml,
    exportDatabaseYaml,
  };
}

export { DataError };
