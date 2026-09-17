/**
 * The note syntax engine.
 *
 * A sticky body is plain text, one block per line, so it stays readable inside
 * the YAML file. The editor renders each line as a block and understands:
 *
 *   # Title        heading        [] task        [x] done task
 *   1. item        ordered list   - item         bullet
 *   > quote        quote          ---            divider
 *
 * Two leading spaces per level indent a block.
 */

export type BlockKind =
  | "text"
  | "heading"
  | "task"
  | "ordered"
  | "bullet"
  | "quote"
  | "divider";

export interface Block {
  kind: BlockKind;
  /** Nesting level, 0-4. */
  indent: number;
  /** Heading level, 1-6 (only used by `heading`). */
  level: number;
  /** Only used by `task`. */
  checked: boolean;
  /** The editable text, with any marker stripped off. */
  text: string;
}

export const INDENT_UNIT = "  ";
export const MAX_INDENT = 4;

export const KIND_LABELS: Record<BlockKind, string> = {
  text: "Text",
  heading: "Heading",
  task: "Checkbox",
  ordered: "Numbered",
  bullet: "Bullet",
  quote: "Quote",
  divider: "Divider",
};

const RE_TASK_BULLET = /^[-*+]\s+\[([ xX]?)\]\s*(.*)$/;
const RE_TASK = /^\[([ xX]?)\]\s*(.*)$/;
const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_ORDERED = /^\d{1,4}[.)]\s+(.*)$/;
const RE_BULLET = /^[-*+]\s+(.*)$/;
const RE_QUOTE = /^>\s?(.*)$/;
const RE_DIVIDER = /^(-{3,}|\*{3,}|_{3,})$/;

function isChecked(marker: string | undefined): boolean {
  return (marker ?? "").trim().toLowerCase() === "x";
}

export function blankBlock(kind: BlockKind = "text"): Block {
  return { kind, indent: 0, level: 1, checked: false, text: "" };
}

function splitIndent(raw: string): { indent: number; rest: string } {
  const lead = /^[ \t]*/.exec(raw)?.[0] ?? "";
  const width = lead.replace(/\t/g, INDENT_UNIT).length;
  const indent = Math.min(MAX_INDENT, Math.floor(width / INDENT_UNIT.length));
  return { indent, rest: raw.slice(lead.length) };
}

/** Parse one line of a sticky body into a block. Never throws. */
export function parseLine(raw: string): Block {
  const { indent, rest } = splitIndent(raw);
  const base = { indent, level: 1, checked: false, text: "" };

  // Whitespace-only lines carry no meaning and would leave trailing spaces in
  // the YAML, so they collapse to empty blocks.
  if (rest.trim() === "") return { ...base, kind: "text", indent: 0, text: "" };

  let m = RE_TASK_BULLET.exec(rest);
  if (m) return { ...base, kind: "task", checked: isChecked(m[1]), text: m[2] };

  m = RE_TASK.exec(rest);
  if (m) return { ...base, kind: "task", checked: isChecked(m[1]), text: m[2] };

  m = RE_HEADING.exec(rest);
  if (m) return { ...base, kind: "heading", level: m[1].length, text: m[2] };

  m = RE_ORDERED.exec(rest);
  if (m) return { ...base, kind: "ordered", text: m[1] };

  m = RE_BULLET.exec(rest);
  if (m) return { ...base, kind: "bullet", text: m[1] };

  m = RE_QUOTE.exec(rest);
  if (m) return { ...base, kind: "quote", text: m[1] };

  if (RE_DIVIDER.test(rest)) return { ...base, kind: "divider" };

  return { ...base, kind: "text", text: rest };
}

/** Split a body into blocks. An empty body yields one empty text block. */
export function parseBody(body: string): Block[] {
  const lines = body.split("\n");
  const parsed = lines.map(parseLine);
  return parsed.length > 0 ? parsed : [blankBlock()];
}

/**
 * Ordinal numbers for `ordered` blocks. Numbering is derived from position, so
 * inserting an item in the middle renumbers everything that follows.
 */
export function orderedOrdinals(blocks: Block[]): number[] {
  const counters: number[] = [];
  return blocks.map((block) => {
    if (block.kind !== "ordered") {
      for (let i = block.indent; i < counters.length; i += 1) counters[i] = 0;
      return 0;
    }
    const level = block.indent;
    counters.length = Math.max(counters.length, level + 1);
    counters[level] = (counters[level] ?? 0) + 1;
    return counters[level];
  });
}

export function serializeBlock(block: Block, ordinal = 1): string {
  const pad = INDENT_UNIT.repeat(Math.max(0, Math.min(MAX_INDENT, block.indent)));
  const tail = block.text ? " " + block.text : "";
  switch (block.kind) {
    case "heading":
      return pad + "#".repeat(Math.max(1, Math.min(6, block.level))) + tail;
    case "task":
      return pad + (block.checked ? "[x]" : "[]") + tail;
    case "ordered":
      return pad + Math.max(1, ordinal) + "." + tail;
    case "bullet":
      return pad + "-" + tail;
    case "quote":
      return pad + ">" + tail;
    case "divider":
      return pad + "---";
    default:
      return pad + block.text;
  }
}

export function serializeBody(blocks: Block[]): string {
  const ordinals = orderedOrdinals(blocks);
  return blocks.map((b, i) => serializeBlock(b, ordinals[i])).join("\n");
}

/** Immutable helpers used by the editor. */
export function replaceBlock(blocks: Block[], index: number, next: Block): Block[] {
  return blocks.map((b, i) => (i === index ? next : b));
}

export function insertBlock(blocks: Block[], index: number, next: Block): Block[] {
  const copy = blocks.slice();
  copy.splice(index, 0, next);
  return copy;
}

export function removeBlock(blocks: Block[], index: number): Block[] {
  const copy = blocks.slice();
  copy.splice(index, 1);
  return copy.length > 0 ? copy : [blankBlock()];
}

export function toggleTaskAt(blocks: Block[], index: number): Block[] {
  const block = blocks[index];
  if (!block || block.kind !== "task") return blocks;
  return replaceBlock(blocks, index, { ...block, checked: !block.checked });
}

/** The kind a new block gets when the user presses Enter inside `kind`. */
export function continuationKind(kind: BlockKind): BlockKind {
  switch (kind) {
    case "task":
    case "ordered":
    case "bullet":
    case "quote":
      return kind;
    default:
      return "text";
  }
}

export interface MarkerHit {
  kind: BlockKind;
  level: number;
  checked: boolean;
  text: string;
}

/**
 * Detect a freshly typed marker so `[]`, `1. `, `# `, `- ` and `---` turn into
 * real blocks the moment they are typed.
 */
export function matchMarker(raw: string): MarkerHit | null {
  let m = RE_TASK_BULLET.exec(raw);
  if (m) return { kind: "task", level: 1, checked: isChecked(m[1]), text: m[2] };

  m = RE_TASK.exec(raw);
  if (m) return { kind: "task", level: 1, checked: isChecked(m[1]), text: m[2] };

  if (RE_DIVIDER.test(raw)) return { kind: "divider", level: 1, checked: false, text: "" };

  m = RE_ORDERED.exec(raw);
  if (m) return { kind: "ordered", level: 1, checked: false, text: m[1] };

  m = RE_HEADING.exec(raw);
  if (m) return { kind: "heading", level: m[1].length, checked: false, text: m[2] };

  m = RE_BULLET.exec(raw);
  if (m) return { kind: "bullet", level: 1, checked: false, text: m[1] };

  m = RE_QUOTE.exec(raw);
  if (m) return { kind: "quote", level: 1, checked: false, text: m[1] };

  return null;
}

/** Markers that only make sense at the very start of a line. */
export function isMarkerPrefix(raw: string): boolean {
  return matchMarker(raw) !== null;
}

export interface TaskStats {
  total: number;
  done: number;
}

export function taskStats(blocks: Block[]): TaskStats {
  let total = 0;
  let done = 0;
  for (const block of blocks) {
    if (block.kind !== "task") continue;
    total += 1;
    if (block.checked) done += 1;
  }
  return { total, done };
}

export function bodyTaskStats(body: string): TaskStats {
  return taskStats(parseBody(body));
}

/** Plain text of a body, for search and previews. */
export function bodyToPlainText(body: string): string {
  return parseBody(body)
    .map((b) => b.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
