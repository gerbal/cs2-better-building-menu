import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Every export in src is used by src. An export only a test imports is a
 * feature that was taken out of the UI while its logic and tests stayed,
 * and it reads as live to whoever changes it next. `noUnusedLocals` cannot
 * see this: an export counts as used.
 *
 * Matched by name over the source text with comments removed, which errs
 * towards "used": a name that merely appears elsewhere passes.
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** Exported so a test can reach them, and said so where they are declared. */
const TEST_SEAMS: Readonly<Record<string, string>> = {
  resetAssetMenuView: "clears the module's state between tests",
  getUnplumbedStrings: "the localizable-strings register's own contract",
  SERVICE_FACT_KEYS: "the fact-coverage test compares it with the indexer's keys",
  SERVICE_FACT_LOCALIZATION_KEYS: "the service-facts test checks each key's wording",
  SERVICE_TEXT_FACT_KEYS: "the fact-coverage test compares it with the indexer's keys",
};

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const files = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts"))
  .map((name) => {
    const source = readFileSync(join(src, name), "utf8");
    return { name, source, code: withoutComments(source) };
  });

function exportsOf(code: string): string[] {
  const declared = [...code.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)].map(
    ([, name]) => name
  );
  const listed = [...code.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)].flatMap(([, list]) =>
    list.split(",").map((item) => item.trim().split(/\s+as\s+/).pop()!.replace(/^type\s+/, "")).filter(Boolean)
  );

  return [...declared, ...listed];
}

const occurrences = (code: string, name: string): number =>
  (code.match(new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g")) ?? []).length;

function unusedExports(): string[] {
  return files.flatMap(({ name: file, code }) =>
    exportsOf(code)
      .filter((name) => occurrences(code, name) < 2 && !files.some((other) => other.name !== file && occurrences(other.code, name) > 0))
      .map((name) => `${file}: ${name}`)
  );
}

describe("src exports", () => {
  it("finds the exports", () => {
    const all = files.flatMap(({ code }) => exportsOf(code));
    assert.ok(all.length > 300, `exports found: ${all.length}`);
    assert.ok(all.includes("BuildingCatalogComponent"));
  });

  it("are each used by src, or are a declared test seam", () => {
    const unexplained = unusedExports().filter((entry) => !(entry.split(": ")[1] in TEST_SEAMS));
    assert.deepEqual(unexplained, []);
  });

  it("list only seams that exist and that src still does not use", () => {
    const unused = new Set(unusedExports().map((entry) => entry.split(": ")[1]));
    for (const seam of Object.keys(TEST_SEAMS)) {
      assert.ok(unused.has(seam), `${seam} is used by src now, or no longer exported; take it off the list`);
    }
  });
});
