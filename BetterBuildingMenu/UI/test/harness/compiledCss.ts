import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type Root, type Rule } from "postcss";
import * as sass from "sass";

/**
 * Stylesheets as the bundle gets them: compiled by sass, so mixins are
 * expanded, nesting is flattened into full selectors and arithmetic is done.
 * A test that reads declarations here sees what the engine is given, not how
 * the source happens to spell it.
 */
const src = fileURLToPath(new URL("../../src/", import.meta.url));

const sheets = new Map<string, Root>();

/** A sheet by its path under src, compiled and parsed once. */
export function compiledSheet(path: string): Root {
  let root = sheets.get(path);
  if (!root) {
    const { css } = sass.compile(src + path, { loadPaths: [src], logger: sass.Logger.silent });
    root = postcss.parse(css);
    sheets.set(path, root);
  }
  return root;
}

/** Every module stylesheet under src, by path under src. */
export const moduleSheets = (): string[] =>
  readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".module.scss"))
    .sort();

const normalize = (selector: string): string => selector.trim().replace(/\s+/g, " ");

/** The rules outside any at-rule, which are the ones that always apply. */
const topLevelRules = (root: Root): Rule[] => root.nodes.filter((node): node is Rule => node.type === "rule");

/** Every selector the sheet's top-level rules name, one per entry of a list. */
export function selectorsOf(path: string): string[] {
  return topLevelRules(compiledSheet(path)).flatMap((rule) => rule.selectors.map(normalize));
}

/**
 * What the top-level rules naming `selector` declare, in order, the last of
 * each property winning; `!important` stays on the value. Fails when no rule
 * names the selector, so a renamed class cannot pass a check by absence.
 */
export function declarationsOf(path: string, selector: string): Record<string, string> {
  const wanted = normalize(selector);
  const rules = topLevelRules(compiledSheet(path)).filter((rule) => rule.selectors.map(normalize).includes(wanted));
  assert.ok(rules.length > 0, `${path} has no rule for ${wanted}`);

  const declarations: Record<string, string> = {};
  for (const rule of rules) {
    rule.walkDecls((declaration) => {
      if (declaration.parent === rule) {
        declarations[declaration.prop] = declaration.important ? `${declaration.value} !important` : declaration.value;
      }
    });
  }

  return declarations;
}

/** Every declaration in a sheet, with the selectors of the rule that holds it. */
export function everyDeclaration(path: string): { selectors: string[]; prop: string; value: string }[] {
  const found: { selectors: string[]; prop: string; value: string }[] = [];
  compiledSheet(path).walkDecls((declaration) => {
    const parent = declaration.parent;
    const selectors = parent?.type === "rule" ? (parent as Rule).selectors.map(normalize) : [];
    found.push({ selectors, prop: declaration.prop, value: declaration.value });
  });
  return found;
}

/** A length in rem as a number; NaN for anything else. */
export const rem = (length: string | undefined): number =>
  Number(/^(-?\d*\.?\d+)rem$/.exec((length ?? "").trim())?.[1] ?? Number.NaN);

/** The four sides of a padding or margin shorthand, top, right, bottom, left. */
export function sides(shorthand: string | undefined): [string, string, string, string] {
  const [top, right = top, bottom = top, left = right] = (shorthand ?? "").trim().split(/\s+/);
  return [top, right, bottom, left];
}
