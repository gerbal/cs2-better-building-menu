import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

/**
 * Every class a module stylesheet declares is one its components apply.
 * A class no component names is a rule that can never match. Such rules
 * outlive the markup they styled and read as live to the next person
 * changing the sheet.
 *
 * The classes come from the compiled CSS, so mixins and nesting are
 * resolved. References are what css-loader exports: `styles.camelName`,
 * `styles["kebab-name"]`, or the name as a string literal in the importing
 * file (`styles[column.className]` looks up names written that way).
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

const files = readdirSync(src, { recursive: true, encoding: "utf8" }).map((name) => join(src, name));
const sheets = files.filter((file) => file.endsWith(".module.scss"));
const scripts = files.filter((file) => /\.tsx?$/.test(file));

const camel = (name: string): string => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The local class names a compiled sheet's selectors use. */
function classesOf(sheet: string): Set<string> {
  const css = sass
    .compile(sheet, { loadPaths: [src], logger: sass.Logger.silent })
    .css.replace(/\/\*[\s\S]*?\*\//g, "");
  const classes = new Set<string>();

  // In compiled CSS a selector is whatever precedes a `{` since the last
  // `{`, `}` or `;`. At-rule preludes and keyframe steps have no classes.
  for (const [, prelude] of css.matchAll(/([^{};]*)\{/g)) {
    if (prelude.trim().startsWith("@")) continue;

    for (const [, name] of prelude.replace(/:global\([^)]*\)/g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      classes.add(name);
    }
  }

  return classes;
}

/** The source of every script that imports this sheet, and the name it binds. */
function importersOf(sheet: string): { source: string; binding: string }[] {
  return scripts.flatMap((script) => {
    const source = readFileSync(script, "utf8");

    // Relative, or from `src` as the bundler's baseUrl resolves it.
    return [...source.matchAll(/import\s+(\w+)\s+from\s+"([^"]+\.module\.scss)"/g)]
      .filter(([, , path]) => resolve(path.startsWith(".") ? dirname(script) : src, path) === sheet)
      .map(([, binding]) => ({ source, binding }));
  });
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function isReferenced(name: string, importers: { source: string; binding: string }[]): boolean {
  return importers.some(({ source, binding }) =>
    // `(?!\w)`: `styles.row` is not a reference to `.rowName`.
    new RegExp(`${escape(binding)}\\.${escape(camel(name))}(?!\\w)|"${escape(name)}"|"${escape(camel(name))}"`).test(source)
  );
}

describe("module stylesheets", () => {
  it("finds the sheets and their classes", () => {
    assert.ok(sheets.length >= 15, `sheets found: ${sheets.length}`);
    assert.ok(classesOf(sheets.find((sheet) => sheet.endsWith("buildingCatalog.module.scss"))!).has("catalog"));
  });

  for (const sheet of sheets) {
    it(`${relative(src, sheet)} declares only classes its components apply`, () => {
      const importers = importersOf(sheet);
      assert.ok(importers.length > 0, "no component imports this sheet");

      const unreferenced = [...classesOf(sheet)].filter((name) => !isReferenced(name, importers)).sort();
      assert.deepEqual(unreferenced, []);
    });
  }
});
