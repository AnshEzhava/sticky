/**
 * Core data model for Sticky.
 *
 * There is no database and no server: the entire document below is serialized
 * to YAML, kept in the browser, and exportable as a plain .yml file.
 */

export type StickyColor = "yellow" | "rose" | "sky" | "mint" | "lilac" | "peach";

export const STICKY_COLORS: StickyColor[] = [
  "yellow",
  "rose",
  "sky",
  "mint",
  "lilac",
  "peach",
];

export const COLOR_LABELS: Record<StickyColor, string> = {
  yellow: "Butter",
  rose: "Rose",
  sky: "Sky",
  mint: "Mint",
  lilac: "Lilac",
  peach: "Peach",
};

export function isStickyColor(value: unknown): value is StickyColor {
  return typeof value === "string" && (STICKY_COLORS as string[]).includes(value);
}

/** A single sticky note. `body` holds the marker syntax (`[]`, `1.`, `#`, ...). */
export interface Sticky {
  id: string;
  title: string;
  body: string;
  color: StickyColor;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A client list: one board of stickies. Accounts own many of these. */
export interface ClientList {
  id: string;
  name: string;
  color: StickyColor;
  stickies: Sticky[];
  createdAt: string;
}

export interface PasswordRecord {
  algo: string;
  iterations: number;
  salt: string;
  hash: string;
}

export interface Account {
  id: string;
  username: string;
  displayName: string;
  password: PasswordRecord;
  createdAt: string;
  clients: ClientList[];
}

/** The whole thing. This is what lands in the .yml file. */
export interface Database {
  version: number;
  accounts: Account[];
}

export const DB_VERSION = 1;

export type ThemeMode = "light" | "dark" | "system";
