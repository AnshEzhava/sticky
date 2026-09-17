"use client";

import { memo, useCallback, useMemo } from "react";
import { bodyTaskStats } from "@/lib/blocks";
import { COLOR_LABELS, STICKY_COLORS, type Sticky } from "@/lib/types";
import { BlockEditor } from "./BlockEditor";
import { Dropdown, Icons, MenuItem, MenuLabel, formatDate } from "./ui";

interface StickyNoteProps {
  sticky: Sticky;
  index: number;
  total: number;
  clientId: string;
  autoFocusTitle?: boolean;
  onUpdate: (clientId: string, stickyId: string, patch: Partial<Sticky>) => void;
  onDelete: (clientId: string, stickyId: string) => void;
  onDuplicate: (clientId: string, stickyId: string) => void;
  onMove: (clientId: string, from: number, to: number) => void;
  onPin: (clientId: string, stickyId: string, pinned: boolean) => void;
}

function StickyNoteComponent({
  sticky,
  index,
  total,
  clientId,
  autoFocusTitle = false,
  onUpdate,
  onDelete,
  onDuplicate,
  onMove,
  onPin,
}: StickyNoteProps) {
  const stats = useMemo(() => bodyTaskStats(sticky.body), [sticky.body]);
  const percent = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);

  // A tiny, stable tilt so the board looks hand pinned rather than printed.
  const tilt = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < sticky.id.length; i += 1) hash = (hash * 31 + sticky.id.charCodeAt(i)) % 997;
    return (hash / 997 - 0.5) * 0.9;
  }, [sticky.id]);

  const patch = useCallback(
    (next: Partial<Sticky>) => onUpdate(clientId, sticky.id, next),
    [clientId, onUpdate, sticky.id],
  );

  const handleBody = useCallback((body: string) => patch({ body }), [patch]);
  const handleTitle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => patch({ title: event.target.value }),
    [patch],
  );

  return (
    <article
      className={`note note-in paper-${sticky.color} ${sticky.pinned ? "note-taped" : ""} group/note relative px-3.5 pt-3 pb-2.5`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <header className="flex items-start gap-1">
        <input
          value={sticky.title}
          onChange={handleTitle}
          placeholder="Title"
          aria-label="Sticky title"
          autoFocus={autoFocusTitle}
          className="note-title min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100">
          <Dropdown label="Sticky options" icon={<Icons.Dots className="h-4 w-4" />}>
            <MenuItem
              icon={<Icons.Pin className="h-3.5 w-3.5" />}
              onClick={() => onPin(clientId, sticky.id, !sticky.pinned)}
            >
              {sticky.pinned ? "Unpin" : "Pin to the top"}
            </MenuItem>
            <MenuItem icon={<Icons.Copy className="h-3.5 w-3.5" />} onClick={() => onDuplicate(clientId, sticky.id)}>
              Duplicate
            </MenuItem>
            <MenuItem
              icon={<Icons.Chevron className="h-3.5 w-3.5 rotate-180" />}
              disabled={index === 0}
              onClick={() => onMove(clientId, index, index - 1)}
            >
              Move earlier
            </MenuItem>
            <MenuItem
              icon={<Icons.Chevron className="h-3.5 w-3.5" />}
              disabled={index >= total - 1}
              onClick={() => onMove(clientId, index, index + 1)}
            >
              Move later
            </MenuItem>

            <MenuLabel>Paper</MenuLabel>
            <div className="grid grid-cols-6 gap-1 px-2 pb-1.5">
              {STICKY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={COLOR_LABELS[color]}
                  aria-label={COLOR_LABELS[color]}
                  aria-pressed={sticky.color === color}
                  onClick={() => patch({ color })}
                  className={`paper-${color} h-5 w-5 rounded-md border transition-transform hover:scale-110 ${
                    sticky.color === color ? "border-ink/45" : "border-black/10"
                  }`}
                  style={{ background: "var(--paper)" }}
                />
              ))}
            </div>

            <div className="my-1 h-px bg-line" />
            <MenuItem danger icon={<Icons.Trash className="h-3.5 w-3.5" />} onClick={() => onDelete(clientId, sticky.id)}>
              Delete sticky
            </MenuItem>
          </Dropdown>
        </div>
      </header>

      <div className="mt-1.5">
        <BlockEditor
          value={sticky.body}
          onChange={handleBody}
          placeholder={"Type [] for a checkbox\n1. for a numbered list\n# for a heading"}
        />
      </div>

      <footer className="note-hint mt-2 flex min-h-4 items-center justify-between gap-3 text-[0.6875rem]">
        {stats.total > 0 ? (
          <span className="flex items-center gap-1.5">
            <span
              className="block h-1 w-14 overflow-hidden rounded-full"
              style={{ background: "color-mix(in srgb, currentColor 22%, transparent)" }}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${percent}%`, background: "currentColor" }}
              />
            </span>
            <span className="tabular-nums">
              {stats.done}/{stats.total}
            </span>
            {stats.done === stats.total ? <span aria-hidden="true">✨</span> : null}
          </span>
        ) : (
          <span />
        )}
        <span className="tabular-nums opacity-70">{formatDate(sticky.updatedAt)}</span>
      </footer>
    </article>
  );
}

export const StickyNote = memo(StickyNoteComponent);
