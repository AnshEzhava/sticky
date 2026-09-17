import { randomId } from "./crypto";
import type { ClientList, Sticky, StickyColor } from "./types";

function sticky(title: string, body: string, color: StickyColor, pinned = false): Sticky {
  const now = new Date().toISOString();
  return {
    id: randomId("stk"),
    title,
    body,
    color,
    pinned,
    createdAt: now,
    updatedAt: now,
  };
}

function client(name: string, color: StickyColor, stickies: Sticky[]): ClientList {
  return { id: randomId("cli"), name, color, stickies, createdAt: new Date().toISOString() };
}

/** A small board that shows off every marker in the syntax. */
export function createSampleClients(): ClientList[] {
  return [
    client("Acme Studio", "yellow", [
      sticky(
        "Launch checklist",
        [
          "# Ship v1",
          "[] Draft the announcement",
          "[] Record a 20 second demo",
          "[x] Book the domain",
          "[x] Pick the palette",
          "1. Write the landing copy",
          "2. Design the hero shot",
          "  1. Crop the screenshots",
          "  2. Export at 2x",
        ].join("\n"),
        "yellow",
        true,
      ),
      sticky(
        "Client call",
        [
          '> "We need it live before the trade show."',
          "# Decisions",
          "[] Send the revised scope",
          "[] Confirm the budget",
          "# Follow-ups",
          "1. Ping their designer",
          "2. Share the roadmap",
        ].join("\n"),
        "sky",
      ),
      sticky(
        "Sprint 12",
        [
          "# In progress",
          "[] Grid reflow on resize",
          "[] YAML import",
          "# Done",
          "[x] Checkbox syntax",
          "[x] Account switching",
          "---",
          "Aim: ship on Friday",
        ].join("\n"),
        "mint",
      ),
      sticky(
        "Parking lot",
        [
          "Things that are not urgent:",
          "- Recurring stickies",
          "- Keyboard only mode",
          "- Print stylesheet",
          "  [] check paper size",
          "> Revisit after launch",
        ].join("\n"),
        "lilac",
      ),
    ]),
    client("Northwind Co", "peach", [
      sticky(
        "Onboarding",
        [
          "# Week one",
          "[] Kickoff call",
          "[x] Send the welcome pack",
          "[] Collect brand assets",
        ].join("\n"),
        "peach",
      ),
    ]),
  ];
}

export function createStarterClient(name = "My first client"): ClientList {
  return client(name, "yellow", [
    sticky(
      "Try the syntax",
      [
        "# Type a marker at the start of a line",
        "[] becomes a checkbox you can tick",
        "[x] a ticked box gets a strike through it",
        "1. Numbered lines renumber themselves",
        "2. Add one in the middle and watch",
        "# Headings, lists and rules",
        "- a bullet",
        "> a quote",
        "---",
        "Then press Enter for the next line.",
      ].join("\n"),
      "yellow",
      true,
    ),
  ]);
}
