import { fromYaml } from "../lib/yaml";
let pass = 0, fail = 0;
const ok = (c: boolean, l: string) => { if (c) pass++; else { fail++; console.log("FAIL " + l); } };
const message = (text: string) => {
  try { fromYaml(text); return "(no error)"; } catch (e) { return (e as Error).message; }
};
const broken = message("a: 1\nb: [1, 2\nc: 3");
console.log("message: " + broken);
ok(broken.includes("line 3"), "points at where the parser gave up");
ok(broken.includes("column"), "reports the column");
ok(broken.startsWith("That is not valid YAML"), "leads with plain language");
ok(!broken.includes("\n"), "stays on one line");
ok(!/at line \d+, column \d+.*at line/.test(broken), "does not repeat the position twice");
const quote = message("a: 'unclosed\nb: 2");
console.log("message: " + quote);
ok(quote.includes("line 2") && quote.includes("quote"), "handles quote errors");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);