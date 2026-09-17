"use client";

/**
 * The sticky note editor.
 *
 * The body is plain text, one block per line. Each line renders as a row and
 * the marker is live: type `[]`, `1.`, `#`, `- `, `> ` or `---` at the start of
 * a line and the row turns into a checkbox, a numbered item, a heading, a
 * bullet, a quote or a rule as you type.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  blankBlock,
  continuationKind,
  insertBlock,
  matchMarker,
  orderedOrdinals,
  parseBody,
  removeBlock,
  replaceBlock,
  serializeBody,
  toggleTaskAt,
  MAX_INDENT,
  type Block,
} from "@/lib/blocks";
import { Icons } from "./ui";

interface BlockEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

interface FocusTarget {
  index: number;
  position: number | "end";
}

const GUTTER = "1.35rem";

export function BlockEditor({ value, onChange, placeholder }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseBody(value));
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const emitted = useRef(value);
  const textRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Adopt changes that came from outside the editor (YAML applied, note reset).
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setBlocks(parseBody(value));
  }, [value]);

  const commit = useCallback(
    (next: Block[]) => {
      const body = serializeBody(next);
      emitted.current = body;
      setBlocks(next);
      onChange(body);
    },
    [onChange],
  );

  // Auto-grow every row so a note simply gets taller as it fills up.
  useLayoutEffect(() => {
    for (const element of textRefs.current) {
      if (!element) continue;
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  });

  useLayoutEffect(() => {
    if (!focusTarget) return;
    const element = textRefs.current[focusTarget.index];
    if (!element) return;
    element.focus();
    const position = focusTarget.position === "end" ? element.value.length : focusTarget.position;
    element.setSelectionRange(position, position);
    setFocusTarget(null);
  }, [focusTarget, blocks]);

  const ordinals = orderedOrdinals(blocks);

  const handleChange = (index: number, raw: string) => {
    const block = blocks[index];

    // A marker typed at the start of any line re-types that line, whether it is
    // still plain text or already a checkbox waiting for its label.
    if (block.kind !== "divider") {
      const hit = matchMarker(raw);
      if (hit) {
        commit(
          replaceBlock(blocks, index, {
            indent: block.indent,
            kind: hit.kind,
            level: hit.level,
            checked: hit.checked,
            text: hit.text,
          }),
        );
        return;
      }
    }

    // Once a line carries a marker, the space after it is part of the syntax
    // rather than the content, so it never lands in the saved text.
    const text = block.kind === "text" ? raw : raw.replace(/^\s+/, "");
    commit(replaceBlock(blocks, index, { ...block, text }));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const block = blocks[index];
    const element = event.currentTarget;
    const start = element.selectionStart;
    const end = element.selectionEnd;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Enter on an empty checkbox ends the checklist instead of adding one.
      if (block.kind === "task" && block.text.trim() === "") {
        commit(replaceBlock(blocks, index, { ...blankBlock("text"), indent: block.indent }));
        setFocusTarget({ index, position: 0 });
        return;
      }
      if (block.kind === "divider") {
        commit(insertBlock(blocks, index + 1, { ...blankBlock("text"), indent: block.indent }));
        setFocusTarget({ index: index + 1, position: 0 });
        return;
      }
      const head = block.text.slice(0, start);
      const tail = block.text.slice(end);
      const next: Block = { ...blankBlock(continuationKind(block.kind)), indent: block.indent, text: tail };
      commit(insertBlock(replaceBlock(blocks, index, { ...block, text: head }), index + 1, next));
      setFocusTarget({ index: index + 1, position: 0 });
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const indent = Math.max(0, Math.min(MAX_INDENT, block.indent + (event.shiftKey ? -1 : 1)));
      if (indent !== block.indent) commit(replaceBlock(blocks, index, { ...block, indent }));
      return;
    }

    if (event.key === "Backspace" && start === 0 && end === 0) {
      if (block.kind !== "text") {
        if (block.text !== "") return;
        event.preventDefault();
        commit(replaceBlock(blocks, index, { ...blankBlock("text"), indent: block.indent }));
        setFocusTarget({ index, position: 0 });
        return;
      }
      if (index === 0) return;
      const previous = blocks[index - 1];
      event.preventDefault();
      if (previous.kind === "text" && previous.indent === block.indent) {
        const merged = replaceBlock(blocks, index - 1, {
          ...previous,
          text: previous.text + block.text,
        });
        commit(removeBlock(merged, index));
        setFocusTarget({ index: index - 1, position: previous.text.length });
        return;
      }
      if (block.text === "") {
        commit(removeBlock(blocks, index));
        setFocusTarget({ index: index - 1, position: "end" });
      }
      return;
    }

    if (event.key === "ArrowUp" && start === 0 && end === 0 && index > 0) {
      event.preventDefault();
      setFocusTarget({ index: index - 1, position: "end" });
      return;
    }

    if (
      event.key === "ArrowDown" &&
      start === block.text.length &&
      end === block.text.length &&
      index < blocks.length - 1
    ) {
      event.preventDefault();
      setFocusTarget({ index: index + 1, position: 0 });
    }
  };

  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => (
        <BlockRow
          key={index}
          block={block}
          ordinal={ordinals[index]}
          placeholder={index === 0 ? placeholder : undefined}
          registerRef={(element) => {
            textRefs.current[index] = element;
          }}
          onChange={(raw) => handleChange(index, raw)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onToggle={() => commit(toggleTaskAt(blocks, index))}
          onRemoveDivider={() => {
            commit(removeBlock(blocks, index));
            setFocusTarget({ index: Math.max(0, index - 1), position: "end" });
          }}
        />
      ))}
    </div>
  );
}

interface BlockRowProps {
  block: Block;
  ordinal: number;
  placeholder?: string;
  registerRef: (element: HTMLTextAreaElement | null) => void;
  onChange: (raw: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onToggle: () => void;
  onRemoveDivider: () => void;
}

function BlockRow({
  block,
  ordinal,
  placeholder,
  registerRef,
  onChange,
  onKeyDown,
  onToggle,
  onRemoveDivider,
}: BlockRowProps) {
  const indentStyle = { paddingLeft: `${block.indent * 1.1}rem` };

  if (block.kind === "divider") {
    return (
      <div className="group/row flex items-center" style={indentStyle}>
        <span style={{ width: GUTTER }} />
        <span
          className="my-2 h-px flex-1"
          style={{ background: "color-mix(in srgb, currentColor 32%, transparent)" }}
        />
        <button
          type="button"
          onClick={onRemoveDivider}
          aria-label="Remove divider"
          title="Remove divider"
          className="divider-remove ml-1 grid h-6 w-6 place-items-center rounded opacity-0 transition-opacity group-hover/row:opacity-60 focus-visible:opacity-100 hover:opacity-100"
        >
          <Icons.X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const typeClasses =
    block.kind === "heading"
      ? block.level >= 3
        ? "font-semibold text-[1rem]"
        : block.level === 2
          ? "font-semibold text-[1.0625rem]"
          : "font-semibold text-[1.1875rem]"
      : block.kind === "quote"
        ? "italic"
        : "";

  return (
    <div
      className={`group/row flex items-start gap-1.5 ${
        block.kind === "task" && block.checked ? "task-done" : ""
      }`}
      style={indentStyle}
    >
      <div className="flex shrink-0 justify-end" style={{ width: GUTTER }}>
        {block.kind === "task" ? (
          <TaskCheckbox checked={block.checked} label={block.text} onToggle={onToggle} />
        ) : null}
        {block.kind === "ordered" ? (
          <span className="pt-[0.1rem] text-[0.8125rem] font-medium tabular-nums opacity-60">
            {ordinal}.
          </span>
        ) : null}
        {block.kind === "bullet" ? <span className="pt-[0.05rem] opacity-60">•</span> : null}
      </div>

      <div
        className="relative min-w-0 flex-1"
        style={
          block.kind === "quote"
            ? {
                borderLeft: "2px solid color-mix(in srgb, currentColor 34%, transparent)",
                paddingLeft: "0.6rem",
              }
            : undefined
        }
      >
        <TaskText
          block={block}
          typeClasses={typeClasses}
          placeholder={placeholder}
          registerRef={registerRef}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}

function TaskCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label.trim() || "Task"}
      onClick={onToggle}
      className="check-hit mt-[0.22rem] grid h-[1.02rem] w-[1.02rem] shrink-0 place-items-center rounded-[0.32rem] border-[1.5px] transition-colors duration-150"
      style={{
        backgroundColor: checked ? "currentColor" : "transparent",
        borderColor: checked
          ? "currentColor"
          : "color-mix(in srgb, currentColor 42%, transparent)",
      }}
    >
      {checked ? (
        <span className="check-pop" style={{ color: "var(--paper)" }}>
          <Icons.Check className="h-[0.68rem] w-[0.68rem]" />
        </span>
      ) : null}
    </button>
  );
}

/**
 * The editable line. Finished tasks get a dash that sweeps across the text -
 * measured against an invisible mirror so it stops where the words do.
 */
function TaskText({
  block,
  typeClasses,
  placeholder,
  registerRef,
  onChange,
  onKeyDown,
}: {
  block: Block;
  typeClasses: string;
  placeholder?: string;
  registerRef: (element: HTMLTextAreaElement | null) => void;
  onChange: (raw: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const dashRef = useRef<HTMLSpanElement>(null);
  const isDone = block.kind === "task" && block.checked;

  useLayoutEffect(() => {
    const element = textRef.current;
    const mirror = mirrorRef.current;
    const dash = dashRef.current;
    if (!element) return;

    if (!isDone) {
      element.style.textDecoration = "none";
      return;
    }

    const width = mirror ? mirror.scrollWidth : 0;
    const available = element.clientWidth;
    const wrapped = width > available + 1;

    // Long, wrapped text gets a plain strike through every line instead.
    element.style.textDecoration = wrapped ? "line-through" : "none";
    if (dash) {
      dash.style.display = wrapped ? "none" : "";
      dash.style.width = `${Math.max(9, Math.min(width, available))}px`;
    }
  }, [block.text, isDone]);

  return (
    <>
      <textarea
        ref={(element) => {
          textRef.current = element;
          registerRef(element);
        }}
        rows={1}
        value={block.text}
        spellCheck
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className={`note-text ${typeClasses}`}
      />
      {isDone ? (
        <>
          <span
            ref={mirrorRef}
            aria-hidden="true"
            className={`note-mirror ${typeClasses}`}
          >
            {block.text || " "}
          </span>
          <span ref={dashRef} aria-hidden="true" className="task-dash" />
        </>
      ) : null}
    </>
  );
}
