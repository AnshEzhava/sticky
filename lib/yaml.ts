/**
 * YAML is the storage format. The same serializer powers localStorage
 * persistence, file export, and the in-app raw editor, so a downloaded .yml is
 * byte-for-byte the document the app runs on.
 */

import { parse as parseYamlText, stringify as stringifyYaml } from "yaml";
import { randomId } from "./crypto";
import { DB_VERSION, isStickyColor } from "./types";
import type { Account, ClientList, Database, PasswordRecord, Sticky } from "./types";

export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

export function toYaml(value: unknown): string {
  return stringifyYaml(value, { lineWidth: 0 });
}

export function fromYaml(text: string): unknown {
  try {
    return parseYamlText(text, { prettyErrors: true });
  } catch (error) {
    const failure = error as Error & { linePos?: { line: number; col: number }[] };
    const position = failure.linePos?.[0];
    const where = position ? ` on line ${position.line}, column ${position.col}` : "";
    // The parser repeats the position in its own words; the prefix already has it.
    const detail = failure.message
      .split("\n")[0]
      .replace(/\s*at line \d+, column \d+.*$/, "")
      .replace(/[:\s]+$/, "");
    throw new DataError(`That is not valid YAML${where} - ${detail}`);
  }
}

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asIso(value: unknown): string {
  const text = asString(value);
  if (text) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asColor(value: unknown) {
  return isStickyColor(value) ? value : ("yellow" as const);
}

function asPassword(value: unknown): PasswordRecord | null {
  if (typeof value === "string") {
    throw new DataError(
      "The password is stored as plain text. Sticky expects a hashed record with algo, iterations, salt and hash.",
    );
  }
  const raw = asRecord(value);
  if (!raw) return null;
  const hash = asString(raw.hash);
  const salt = asString(raw.salt);
  if (!hash || !salt) return null;
  const iterations = Number(raw.iterations);
  return {
    algo: asString(raw.algo, "PBKDF2-SHA256"),
    iterations: Number.isFinite(iterations) && iterations > 0 ? Math.floor(iterations) : 150_000,
    salt,
    hash,
  };
}

export function normalizeSticky(value: unknown): Sticky | null {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    id: asString(raw.id) || randomId("stk"),
    title: asString(raw.title),
    body: asString(raw.body),
    color: asColor(raw.color),
    pinned: asBoolean(raw.pinned),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt ?? raw.createdAt),
  };
}

export function normalizeClient(value: unknown, fallbackName = "Untitled client"): ClientList | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const stickies = asArray(raw.stickies)
    .map(normalizeSticky)
    .filter((s): s is Sticky => s !== null);
  return {
    id: asString(raw.id) || randomId("cli"),
    name: asString(raw.name).trim() || fallbackName,
    color: asColor(raw.color),
    stickies,
    createdAt: asIso(raw.createdAt),
  };
}

export function normalizeAccount(value: unknown): Account | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const password = asPassword(raw.password);
  const username = asString(raw.username).trim();
  if (!password || !username) return null;
  const clients = asArray(raw.clients)
    .map((entry, index) => normalizeClient(entry, "Client " + (index + 1)))
    .filter((c): c is ClientList => c !== null);
  return {
    id: asString(raw.id) || randomId("acc"),
    username,
    displayName: asString(raw.displayName).trim() || username,
    password,
    createdAt: asIso(raw.createdAt),
    clients,
  };
}

export function normalizeDatabase(value: unknown): Database {
  const raw = asRecord(value);
  if (!raw) throw new DataError("Expected a YAML mapping at the top level.");
  const accounts = asArray(raw.accounts)
    .map(normalizeAccount)
    .filter((a): a is Account => a !== null);
  if (asArray(raw.accounts).length > 0 && accounts.length === 0) {
    throw new DataError("Found an accounts list, but no entry had both a username and a password record.");
  }
  const version = Number(raw.version);
  return { version: Number.isFinite(version) ? version : DB_VERSION, accounts };
}

function looksLikeClient(value: unknown): boolean {
  const raw = asRecord(value);
  if (!raw) return false;
  return Array.isArray(raw.stickies) || typeof raw.name === "string";
}

function looksLikeSticky(value: unknown): boolean {
  const raw = asRecord(value);
  if (!raw) return false;
  return typeof raw.title === "string" || typeof raw.body === "string";
}

export type ImportedData =
  | { kind: "database"; label: string; database: Database }
  | { kind: "account"; label: string; account: Account }
  | { kind: "clients"; label: string; clients: ClientList[] };

/** Work out what a pasted or uploaded .yml file is meant to be. */
export function parseImport(text: string): ImportedData {
  const raw = fromYaml(text);
  return classify(raw);
}

export function classify(raw: unknown): ImportedData {
  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw.every(looksLikeClient)) {
      const clients = raw
        .map((entry) => normalizeClient(entry))
        .filter((c): c is ClientList => c !== null);
      if (clients.length > 0) {
        return {
          kind: "clients",
          label: clients.length === 1 ? "1 client board" : clients.length + " client boards",
          clients,
        };
      }
    }
    if (raw.length > 0 && raw.every(looksLikeSticky)) {
      const stickies = raw.map(normalizeSticky).filter((s): s is Sticky => s !== null);
      if (stickies.length > 0) {
        return {
          kind: "clients",
          label: stickies.length === 1 ? "1 sticky" : stickies.length + " stickies",
          clients: [
            {
              id: randomId("cli"),
              name: "Imported notes",
              color: "yellow",
              stickies,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
    }
    throw new DataError("That list did not contain any stickies or clients.");
  }

  const record = asRecord(raw);
  if (!record) throw new DataError("Expected a YAML mapping or list at the top level.");

  if (Array.isArray(record.accounts)) {
    const database = normalizeDatabase(record);
    const count = database.accounts.length;
    return {
      kind: "database",
      label: count === 1 ? "1 account" : count + " accounts",
      database,
    };
  }

  if ("username" in record || "password" in record) {
    const account = normalizeAccount(record);
    if (!account) {
      throw new DataError("That account needs a username and a password record (algo, salt, hash).");
    }
    return { kind: "account", label: account.username, account };
  }

  if (looksLikeClient(record)) {
    const client = normalizeClient(record);
    if (client) {
      return {
        kind: "clients",
        label: client.name + " (" + client.stickies.length + " stickies)",
        clients: [client],
      };
    }
  }

  throw new DataError(
    "Could not tell what that file contains. Expected accounts, an account, a client board, or a list of stickies.",
  );
}

export function databaseToYaml(database: Database): string {
  return toYaml(database);
}

export function accountToYaml(account: Account): string {
  return toYaml({ version: DB_VERSION, accounts: [account] });
}

export function clientToYaml(client: ClientList): string {
  return toYaml(client);
}
