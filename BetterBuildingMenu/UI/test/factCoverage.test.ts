import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SERVICE_FACT_KEYS, SERVICE_TEXT_FACT_KEYS, RESOURCE_UPKEEP_PREFIX } from "../src/domain/serviceFacts.ts";

// The two halves of a fact ship separately: C# decides what to index, TS
// decides how to word it, and a key with no wording is dropped on purpose
// rather than drawn raw. That policy makes a missing presentation silent —
// the fact simply never appears — so this reads the indexer's source and
// checks every key it can emit has a presentation.
const source = readFileSync(new URL("../../Systems/PrefabIndexingSystem.cs", import.meta.url), "utf8");

const literalKeysOf = (call: string): string[] => {
  const keys = new Set<string>();
  // Anchored so that "Fact(" does not also match "TextFact(".
  const pattern = new RegExp(`(?<![A-Za-z])${call}\\(prefabIndex,([^;]*?)\\)`, "g");
  for (const match of source.matchAll(pattern)) {
    // The key is the first argument; it may be a literal or a conditional
    // between two literals. Anything before the first comma of the arguments.
    const firstArg = match[1].split(",")[0];
    for (const literal of firstArg.matchAll(/"([a-zA-Z]+(?::)?)"/g)) keys.add(literal[1]);
  }
  return [...keys];
};

describe("every fact the index can emit has a wording", () => {
  const numeric = literalKeysOf("Fact").concat(literalKeysOf("PollutionModifierFact"));
  const worded = literalKeysOf("TextFact");

  it("reads the indexer's source", () => {
    assert.ok(numeric.includes("cargoCapacity") && numeric.includes("zoneUpkeep"), `numeric keys found: ${numeric.length}`);
    assert.ok(worded.includes("requiredResource") && worded.includes("waterSource"), `worded keys found: ${worded.length}`);
  });

  it("numeric facts", () => {
    const missing = numeric.filter((key) => !key.startsWith(RESOURCE_UPKEEP_PREFIX) && !SERVICE_FACT_KEYS.includes(key));
    assert.deepEqual(missing, []);
  });

  it("worded facts", () => {
    const missing = worded.filter((key) => !SERVICE_TEXT_FACT_KEYS.includes(key));
    assert.deepEqual(missing, []);
  });
});
