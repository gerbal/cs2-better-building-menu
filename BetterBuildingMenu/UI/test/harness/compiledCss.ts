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
  const declarations = declarationsIn(compiledSheet(path), selector);
  assert.ok(declarations, `${path} has no rule for ${normalize(selector)}`);
  return declarations;
}

// The box shorthands a test reads as four sides, and their longhands in
// sides() order.
const BOX_SIDES: Readonly<Record<string, readonly string[]>> = {
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
};

const IMPORTANT = " !important";

/**
 * declarationsOf over a parsed sheet; undefined when no rule names the
 * selector.
 *
 * Resolved as the engine resolves them, not one entry per property name: a
 * `padding-right` after a `padding` rewrites that side of the shorthand, and a
 * `padding` after a `padding-right` rewrites the longhand. Read apart, a test
 * of the shorthand would pass against a right padding the engine never draws.
 * An `!important` declaration is not overridden by a later plain one.
 */
export function declarationsIn(root: Root, selector: string): Record<string, string> | undefined {
  const wanted = normalize(selector);
  const rules = topLevelRules(root).filter((rule) => rule.selectors.map(normalize).includes(wanted));
  if (rules.length === 0) {
    return undefined;
  }

  const declarations: Record<string, string> = {};
  const isImportant = (prop: string) => declarations[prop]?.endsWith(IMPORTANT) ?? false;
  // False when an earlier !important keeps its value.
  const set = (prop: string, value: string, important: boolean): boolean => {
    if (!important && isImportant(prop)) {
      return false;
    }
    declarations[prop] = important ? value + IMPORTANT : value;
    return true;
  };

  for (const rule of rules) {
    rule.walkDecls((declaration) => {
      if (declaration.parent !== rule) {
        return;
      }

      const { prop, value, important } = declaration;
      if (!set(prop, value, important)) {
        return;
      }

      const longhands = BOX_SIDES[prop];
      if (longhands) {
        // A shorthand after its longhands sets every side they named.
        const values = sides(value);
        longhands.forEach((longhand, side) => {
          if (longhand in declarations) {
            set(longhand, values[side], important);
          }
        });
        return;
      }

      const shorthand = Object.keys(BOX_SIDES).find((box) => BOX_SIDES[box].includes(prop));
      if (shorthand && shorthand in declarations && (important || !isImportant(shorthand))) {
        // A longhand after its shorthand replaces that one side of it.
        const values = sides(declarations[shorthand].replace(IMPORTANT, ""));
        values[BOX_SIDES[shorthand].indexOf(prop)] = value;
        declarations[shorthand] = values.join(" ") + (isImportant(shorthand) ? IMPORTANT : "");
      }
    });
  }

  return declarations;
}

// A selector of plain classes and descendant spaces, the only kind the resolver below matches.
const PLAIN_COMPOUND = /^(?:\.[\w-]+)+$/;

/** A plain selector's compounds, outermost first, each as its classes; null for any other selector. */
function plainCompounds(selector: string): string[][] | null {
  const compounds = normalize(selector).split(" ");
  return compounds.every((compound) => PLAIN_COMPOUND.test(compound))
    ? compounds.map((compound) => compound.split(".").filter(Boolean))
    : null;
}

/** Whether every compound matches one of the elements in order, the last compound the last element. */
function matchesPath(compounds: readonly string[][], elements: readonly (readonly string[])[]): boolean {
  const fits = (compound: readonly string[], classes: readonly string[]) => compound.every((name) => classes.includes(name));
  if (!fits(compounds[compounds.length - 1], elements[elements.length - 1])) return false;

  let element = elements.length - 2;
  for (let compound = compounds.length - 2; compound >= 0; compound--) {
    while (element >= 0 && !fits(compounds[compound], elements[element])) element--;
    if (element < 0) return false;
    element--;
  }
  return true;
}

/**
 * The value `prop` resolves to on an element at rest, as the cascade picks it: an `!important`
 * first, then the declaration of the most classes, the later of two equal. `elements` is each
 * element's classes, from an ancestor down to the element. Only plain class selectors match, so a
 * state (`:hover`) never applies.
 */
export function resolvedOn(path: string, elements: readonly (readonly string[])[], prop: string): string | undefined {
  let winner: { weight: number; value: string } | undefined;

  for (const rule of topLevelRules(compiledSheet(path))) {
    for (const selector of rule.selectors) {
      const compounds = plainCompounds(selector);
      if (!compounds || !matchesPath(compounds, elements)) continue;

      const specificity = compounds.reduce((sum, compound) => sum + compound.length, 0);
      rule.walkDecls(prop, (declaration) => {
        const weight = specificity + (declaration.important ? 1000 : 0);
        if (declaration.parent === rule && (!winner || weight >= winner.weight)) {
          winner = { weight, value: declaration.value };
        }
      });
    }
  }

  return winner?.value;
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
