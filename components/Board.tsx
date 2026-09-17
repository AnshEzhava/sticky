"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { bodyTaskStats } from "@/lib/blocks";
import type { ClientList, Sticky } from "@/lib/types";
import type { Store } from "@/lib/store";
import { StickyNote } from "./StickyNote";
import { YamlPanel } from "./YamlPanel";
import { Button, Icons, IconButton, MenuItem, Dropdown } from "./ui";

type Filter = "all" | "open" | "done";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
];

function matchesFilter(sticky: Sticky, filter: Filter): boolean {
  if (filter === "all") return true;
  const { total, done } = bodyTaskStats(sticky.body);
  if (filter === "done") return total > 0 && done === total;
  return total === 0 || done < total;
}

export function Board({ client, store }: { client: ClientList; store: Store }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [yamlOpen, setYamlOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    return client.stickies
      .map((sticky, index) => ({ sticky, index }))
      .filter(({ sticky }) => {
        if (!matchesFilter(sticky, filter)) return false;
        if (!needle) return true;
        return (
          sticky.title.toLowerCase().includes(needle) ||
          sticky.body.toLowerCase().includes(needle)
        );
      });
  }, [client.stickies, filter, needle]);

  const openCount = useMemo(
    () => client.stickies.filter((s) => matchesFilter(s, "open")).length,
    [client.stickies],
  );

  const addSticky = useCallback(() => {
    const id = store.addSticky(client.id);
    setFocusId(id);
    setFilter("all");
    setQuery("");
  }, [client.id, store]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-desk/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={`paper-${client.color} grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[0.8125rem] font-semibold shadow-sm`}
              style={{ background: "var(--paper)", color: "var(--paper-ink)" }}
              aria-hidden="true"
            >
              {client.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              {renaming ? (
                <input
                  autoFocus
                  defaultValue={client.name}
                  onBlur={(event) => {
                    store.renameClient(client.id, event.target.value);
                    setRenaming(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setRenaming(false);
                  }}
                  className="field max-w-xs py-1"
                  aria-label="Client name"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setRenaming(true)}
                  onClick={() => setRenaming(true)}
                  className="block max-w-full truncate text-left text-[0.9375rem] font-semibold text-ink"
                  title="Rename this client"
                >
                  {client.name}
                </button>
              )}
              <p className="truncate text-xs text-ink-soft">
                {client.stickies.length} {client.stickies.length === 1 ? "sticky" : "stickies"}
                {openCount > 0 ? ` · ${openCount} with open tasks` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Icons.Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search stickies"
                className="field w-32 py-1.5 pl-8 sm:w-44"
              />
            </div>

            <div
              role="tablist"
              aria-label="Filter stickies"
              className="flex items-center gap-0.5 rounded-lg border border-line bg-panel-soft p-0.5"
            >
              {FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  role="tab"
                  type="button"
                  aria-selected={filter === entry.id}
                  onClick={() => setFilter(entry.id)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    filter === entry.id
                      ? "bg-panel text-ink shadow-sm"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <IconButton
              label="Open the YAML for this board"
              icon={<Icons.Code />}
              onClick={() => setYamlOpen(true)}
            />
            <Button variant="primary" icon={<Icons.Plus className="h-4 w-4" />} onClick={addSticky}>
              <span className="hidden sm:inline">New sticky</span>
            </Button>
            <Dropdown label="Client options" icon={<Icons.Dots />}>
              <MenuItem icon={<Icons.Pencil className="h-3.5 w-3.5" />} onClick={() => setRenaming(true)}>
                Rename client
              </MenuItem>
              <MenuItem icon={<Icons.Code className="h-3.5 w-3.5" />} onClick={() => setYamlOpen(true)}>
                Edit as YAML
              </MenuItem>
              <MenuItem
                danger
                icon={<Icons.Trash className="h-3.5 w-3.5" />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete this client
              </MenuItem>
            </Dropdown>
          </div>
        </div>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {client.stickies.length === 0 ? (
          <EmptyBoard onAdd={addSticky} />
        ) : visible.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line bg-panel/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">Nothing matches that.</p>
            <p className="mt-1 text-xs text-ink-soft">
              {client.stickies.length} {client.stickies.length === 1 ? "sticky" : "stickies"} on this
              board.
            </p>
            <Button
              className="mt-4"
              icon={<Icons.Refresh className="h-4 w-4" />}
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear the filters
            </Button>
          </div>
        ) : (
          <div className="board-grid">
            {visible.map(({ sticky, index }) => (
              <div key={sticky.id} className="board-slot">
                <StickyNote
                  sticky={sticky}
                  index={index}
                  total={client.stickies.length}
                  clientId={client.id}
                  autoFocusTitle={focusId === sticky.id}
                  onUpdate={store.updateSticky}
                  onDelete={store.deleteSticky}
                  onDuplicate={store.duplicateSticky}
                  onMove={store.reorderSticky}
                  onPin={store.pinSticky}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {yamlOpen ? (
        <YamlPanel onClose={() => setYamlOpen(false)} client={client} store={store} />
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-ink">Delete “{client.name}”?</h2>
            <p className="mt-1.5 text-xs text-ink-soft">
              This removes the client and its {client.stickies.length}{" "}
              {client.stickies.length === 1 ? "sticky" : "stickies"} from this browser. Export the
              YAML first if you want a copy.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={<Icons.Trash className="h-4 w-4" />}
                onClick={() => {
                  store.deleteClient(client.id);
                  setConfirmDelete(false);
                }}
              >
                Delete client
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SyntaxCheatsheet({ compact = false }: { compact?: boolean }) {
  const rows: [string, string][] = [
    ["[] buy milk", "a checkbox - tick it for a completion dash"],
    ["1. first", "a numbered list that renumbers itself"],
    ["# Heading", "a heading in the note"],
    ["- bullet", "a bullet point"],
    ["> quote", "an indented quote"],
    ["---", "a horizontal rule"],
  ];
  return (
    <dl className={`grid gap-1.5 ${compact ? "" : "sm:grid-cols-2"}`}>
      {rows.map(([syntax, description]) => (
        <div key={syntax} className="flex items-baseline gap-2.5">
          <dt className="shrink-0">
            <code className="rounded-md border border-line bg-panel-soft px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink">
              {syntax}
            </code>
          </dt>
          <dd className="text-xs text-ink-soft">{description}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyBoard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-panel/60 px-6 py-10">
      <h2 className="text-center text-lg font-semibold tracking-tight text-ink">A blank board</h2>
      <p className="mx-auto mt-1.5 max-w-md text-center text-sm text-ink-soft">
        Stickies are written in plain text. Type a marker at the start of a line and it turns into a
        real element as you type.
      </p>
      <div className="mx-auto mt-5 max-w-md">
        <SyntaxCheatsheet />
      </div>
      <div className="mt-6 flex justify-center">
        <Button variant="primary" icon={<Icons.Plus className="h-4 w-4" />} onClick={onAdd}>
          Add the first sticky
        </Button>
      </div>
    </div>
  );
}
