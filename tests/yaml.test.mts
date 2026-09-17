import { toYaml, fromYaml, normalizeDatabase, classify, parseImport, DataError } from "../lib/yaml";
import type { ImportedData } from "../lib/yaml";
import { createSampleClients, createStarterClient } from "../lib/seed";
import { hashPassword, verifyPassword, randomId } from "../lib/crypto";
import { DB_VERSION } from "../lib/types";

let pass = 0, fail = 0;
function ok(cond: boolean, label: string) { if (cond) pass++; else { fail++; console.log("FAIL " + label); } }
function eq(a: unknown, b: unknown, label: string) { ok(JSON.stringify(a) === JSON.stringify(b), label + "\n  got      " + JSON.stringify(a) + "\n  expected " + JSON.stringify(b)); }

function importedClients(data: ImportedData) {
  if (data.kind !== "clients") throw new Error("expected client boards, got " + data.kind);
  return data.clients;
}

const pw = await hashPassword("hunter2");
ok(await verifyPassword("hunter2", pw), "password verifies");
ok(!(await verifyPassword("hunter3", pw)), "wrong password rejected");
ok(pw.algo === "PBKDF2-SHA256", "algo is pbkdf2, got " + pw.algo);
ok(pw.hash.length > 20 && !pw.hash.includes("hunter2"), "hash does not leak the password");

const db = {
  version: DB_VERSION,
  accounts: [{
    id: randomId("acc"), username: "ansh", displayName: "Ansh",
    password: pw, createdAt: new Date().toISOString(),
    clients: createSampleClients(),
  }],
};

const text = toYaml(db);
ok(text.includes("body: |-"), "bodies use literal block scalars");
ok(text.includes("[] Draft the announcement"), "checkbox syntax survives in yaml");
ok(!text.includes("body: \"") && !text.includes("body: '"), "bodies are not quoted");

const back = normalizeDatabase(fromYaml(text));
eq(back, db, "database round-trips through yaml");

// A hand written file with loose typing must normalize, not explode.
const loose = `
version: 1
accounts:
  - username: sam
    displayName: Sam
    password: { algo: PBKDF2-SHA256, iterations: 1000, salt: "c2FsdA==", hash: "aGFzaA==" }
    clients:
      - name: Loose client
        stickies:
          - title: Notes
            body: |
              [] first
              [x] second
          - body: "no title here"
`;
const looseDb = normalizeDatabase(fromYaml(loose));
eq(looseDb.accounts.length, 1, "loose account parsed");
eq(looseDb.accounts[0].clients[0].stickies.length, 2, "loose stickies parsed");
eq(looseDb.accounts[0].clients[0].stickies[1].color, "yellow", "missing color defaults");
ok(looseDb.accounts[0].clients[0].stickies[0].id.startsWith("stk_"), "missing id generated");
eq(looseDb.accounts[0].createdAt.length, 24, "missing date filled in");

// Classification of the three file shapes.
eq(classify(looseDb).kind, "database", "classifies a database");
eq(classify(looseDb.accounts[0]).kind, "account", "classifies an account");
eq(classify(createStarterClient()).kind, "clients", "classifies a single client");
const stickyList = classify([{ title: "a", body: "[] x" }, { title: "b" }]);
eq(stickyList.kind, "clients", "classifies a sticky list");
eq(importedClients(stickyList).length, 1, "sticky list becomes one board");
eq(importedClients(stickyList)[0].stickies.length, 2, "both stickies kept");
eq(classify(createSampleClients()).kind, "clients", "classifies a client list");
eq(importedClients(classify(createSampleClients())).length, 2, "kept both clients");

// Broken files must produce friendly errors, not crashes.
const bad: [string, string][] = [
  ["just: a plain mapping", "unknown mapping"],
  ["accounts:\n  - username: x", "account without password"],
  ["username: bo\npassword: plaintext", "plain text password"],
  ["- 3\n- 4", "list of numbers"],
  ["a: [1, 2", "invalid yaml"],
];
for (const [text2, label] of bad) {
  try { classify(fromYaml(text2)); fail++; console.log("FAIL expected error: " + label); }
  catch (e) { ok(e instanceof DataError, "friendly error for " + label + " -> " + (e as Error).message); }
}
try { parseImport("a: [1, 2"); fail++; } catch (e) { ok(e instanceof DataError, "parseImport reports invalid yaml"); }

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);