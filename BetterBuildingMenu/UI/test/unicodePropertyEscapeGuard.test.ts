import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/** Every file under a folder, as paths from it. */
const filesUnder = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(folder, entry.name)) : [join(folder, entry.name)]);

describe("the UI source in Cohtml", () => {
  it("builds no regular expression with a Unicode property escape, which Cohtml throws on", () => {
    const escape = /\\[pP]\{/u;
    const found = filesUnder(new URL("../src", import.meta.url).pathname)
      .filter((file) => /\.(tsx?|jsx?|mjs|scss)$/u.test(file))
      .flatMap((file) => readFileSync(file, "utf8").split("\n")
        .map((text, index) => ({ at: `${file}:${index + 1}`, text }))
        .filter(({ text }) => escape.test(text))
        .map(({ at }) => at));

    assert.deepEqual(found, [], `Cohtml 2.2.1.3 throws "Invalid property name" on a regex with \\p{...} or \\P{...}, and the whole menu fails to load; Node and Chromium accept it, so only the game shows it. Spell the class out: ${found.join(", ")}`);
  });
});
