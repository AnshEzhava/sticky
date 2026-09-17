import {
  parseBody, serializeBody, matchMarker, orderedOrdinals,
  taskStats, parseLine, serializeBlock, bodyTaskStats,
} from "../lib/blocks";

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++;
  else { fail++; console.log("FAIL " + label + "\n  got      " + a + "\n  expected " + e); }
}

const canonical = [
  "", "[]", "[x]", "[] Draft the announcement",
  "[] a\n[x] b\n1. one\n2. two",
  "[] a", "# Heading\n## Sub\ntext\n---\n> quote",
  "- bullet\n- second", "plain text with [] inside",
  "1.", ">", "#", "a\n\nb", "text\n[x] done\nmore",
  "  [] indented task\n[] top task",
  "1. parent\n  1. child\n  2. child2\n2. parent",
  "line with: colon\n  indented\n---\n# H1",
];
for (const body of canonical) {
  eq(serializeBody(parseBody(body)), body, "roundtrip " + JSON.stringify(body));
}

// Every body - canonical or not - must reach a fixed point after one pass.
const corpus = [...canonical, "  1. nested\n2. top", "- bullet\n- [] task bullet",
  "   ", "\t\t[] tabs", "5. a\n9. b", "[]x", "#### h4",
  "# ".repeat(1) + "x", "* star bullet", "> quote no space\n>ok"];
for (const body of corpus) {
  const once = serializeBody(parseBody(body));
  eq(serializeBody(parseBody(once)), once, "idempotent " + JSON.stringify(body));
}

// Intended normalization: list numbers come from position, and a bulleted
// checkbox is just a checkbox.
eq(serializeBody(parseBody("- [] bulleted task")), "[] bulleted task", "bullet+task normalizes to task");
eq(serializeBody(parseBody("1. a\n  1. b")), "1. a\n  1. b", "nested numbering is positional");

eq(parseBody("").map(b => b.kind), ["text"], "empty body -> one text block");
eq(parseBody("   ").length, 1, "blank line -> one block");
eq(serializeBody(parseBody("   ")), "", "blank line normalizes away");

eq(matchMarker("[]"), { kind: "task", level: 1, checked: false, text: "" }, "[] -> task");
eq(matchMarker("[] "), { kind: "task", level: 1, checked: false, text: "" }, "[] + space -> task");
eq(matchMarker("[] buy milk"), { kind: "task", level: 1, checked: false, text: "buy milk" }, "[] text");
eq(matchMarker("[x] done"), { kind: "task", level: 1, checked: true, text: "done" }, "[x]");
eq(matchMarker("1. "), { kind: "ordered", level: 1, checked: false, text: "" }, "1. -> ordered");
eq(matchMarker("12. hi"), { kind: "ordered", level: 1, checked: false, text: "hi" }, "12.");
eq(matchMarker("# "), { kind: "heading", level: 1, checked: false, text: "" }, "# -> heading");
eq(matchMarker("### deep"), { kind: "heading", level: 3, checked: false, text: "deep" }, "###");
eq(matchMarker("- "), { kind: "bullet", level: 1, checked: false, text: "" }, "- -> bullet");
eq(matchMarker("- [] x"), { kind: "task", level: 1, checked: false, text: "x" }, "- [] -> task");
eq(matchMarker("---"), { kind: "divider", level: 1, checked: false, text: "" }, "--- -> divider");
eq(matchMarker("> "), { kind: "quote", level: 1, checked: false, text: "" }, "> -> quote");
eq(matchMarker("hello"), null, "plain text has no marker");
eq(matchMarker("-"), null, "lone dash is not a bullet");
eq(matchMarker("#"), null, "lone hash is not a heading");
eq(matchMarker("--"), null, "two dashes are not a divider");
eq(matchMarker("[note] hi"), null, "[note] is not a checkbox");

eq(orderedOrdinals(parseBody("1. a\n1. b\n1. c")), [1,2,3], "auto renumber");
eq(orderedOrdinals(parseBody("1. a\ntext\n1. b")), [1,0,1], "paragraph restarts list");
eq(orderedOrdinals(parseBody("1. a\n  1. sub\n  1. sub2\n1. b")), [1,1,2,2], "nested counters");
eq(serializeBody(parseBody("5. a\n9. b")), "1. a\n2. b", "source numbers normalize");
eq(serializeBody(parseBody("1. p\n  1. c\n1. p2")), "1. p\n  1. c\n2. p2", "child does not advance parent");

eq(taskStats(parseBody("[] a\n[x] b\n[] c")), { total: 3, done: 1 }, "task stats");
eq(bodyTaskStats("no tasks here"), { total: 0, done: 0 }, "empty stats");
eq(taskStats(parseBody("[] a\n  [x] nested")), { total: 2, done: 1 }, "nested stats");

eq(parseLine("    deep").indent, 2, "4 spaces = indent 2");
eq(parseLine("\t[] tabbed").indent, 1, "tab = indent 1");
eq(serializeBlock({ kind: "task", indent: 2, level: 1, checked: true, text: "x" }), "    [x] x", "indent serialize");
eq(serializeBlock({ kind: "heading", indent: 0, level: 2, checked: false, text: "" }), "##", "empty heading");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);