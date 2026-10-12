import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, everyDeclaration } from "./harness/compiledCss.ts";

/**
 * The looks' tokens as the bundle gets them: every interface style declares the keys the look
 * does, each key holds one kind of value, and no ink sits on a panel a style turns the wrong way.
 */
const LOOKS = "looks/looks.module.scss";
const STANDARD = ".standard";
const FOLLOW = [
  ":global(.style--bright-blue) .standard.followStyle",
  ":global(.style--dark-grey-orange) .standard.followStyle",
];
/** The sheets that declare or read the tokens; each sheet that starts reading them joins this list. */
const TOKEN_SHEETS = [LOOKS];

/** A rule's --bbm-* tokens by key, without the panel alphas the root overrides. */
function tokens(selector: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(declarationsOf(LOOKS, selector))
      .filter(([prop]) => prop.startsWith("--bbm-") && !prop.startsWith("--bbm-a-"))
      .map(([prop, value]) => [prop.slice("--bbm-".length), value])
  );
}

type Kind = "colour" | "length" | "shadow" | "gradient" | "filter";

/** The keys that hold something other than a colour, and what. */
const KIND: Readonly<Record<string, Kind>> = {
  boxRadius: "length", radiusItem: "length", radiusTile: "length", tabRadius: "length", tagRadius: "length",
  boxShadow: "shadow", rim: "shadow", armEdge: "shadow", entRing: "shadow", focusRing: "shadow",
  fieldRing: "shadow", iconSlotRing: "shadow", popRing: "shadow",
  tabLit: "gradient",
  bodyBlur: "filter",
};

const LENGTH = "(?:0|-?\\d*\\.?\\d+rem)";
const PATTERN: Readonly<Record<Kind, RegExp>> = {
  colour: /^(?:rgba?\(.+\)|#[0-9a-f]{3,8}|transparent|var\(--[\w-]+\))$/i,
  length: new RegExp(`^${LENGTH}(?: ${LENGTH}){0,3}$`),
  shadow: new RegExp(`^(?:none|(?:inset )?${LENGTH} ${LENGTH} .+)$`),
  gradient: /^linear-gradient\(.+\)$/,
  filter: /^(?:none|var\(--panelBlur\))$/,
};

/** The surface each ink sits on, as the frame draws it. */
const INK_ON: Readonly<Record<string, string>> = {
  tName: "plate", tCost: "plate", tNum2: "plate", tGlyph: "plate", tLocked: "plateLocked", thumb: "track",
  tWord: "head", tState: "head", tStateSet: "head", tDim: "head", tRead1: "head", tRead2: "head",
  tabCount: "head", tabIcon: "head", amber: "head", tQuery: "fieldBg",
  armText: "arm", armNum: "arm", pillText: "pillBg", tagText: "tagBg",
};

/** A surface an interface style can turn light: Bright blue makes these pale. */
const turnsLight = (value: string): boolean => /--panelColorNormal|--menuPanel/.test(value);
/** Ink that comes from the style itself, which Bright blue turns dark. */
const styleInk = (value: string): boolean => /--menuText|--menuTitle/.test(value);

describe("the looks' tokens", () => {
  it("give every interface style the keys the look declares, and no others", () => {
    const keys = Object.keys(tokens(STANDARD)).sort();

    assert.ok(keys.length >= 70, `the look declares ${keys.length} keys`);
    for (const selector of FOLLOW) assert.deepEqual(Object.keys(tokens(selector)).sort(), keys, selector);
  });

  it("hold one kind of value per key, in the look and under every style", () => {
    for (const selector of [STANDARD, ...FOLLOW]) {
      for (const [key, value] of Object.entries(tokens(selector))) {
        const kind = KIND[key] ?? "colour";
        assert.match(value, PATTERN[kind], `${selector} --bbm-${key} is not a ${kind}`);
      }
    }
  });

  it("never put light ink on a panel a style turns light, nor a style's ink on the look's own panel", () => {
    for (const selector of [STANDARD, ...FOLLOW]) {
      const map = tokens(selector);

      for (const [ink, surface] of Object.entries(INK_ON)) {
        const where = `${selector}: ${ink} on ${surface}`;
        if (turnsLight(map[surface])) assert.ok(styleInk(map[ink]), where);
        else assert.ok(!/--menuText1Normal|--menuText2Normal/.test(map[ink]), where);
      }
    }
  });

  it("take each panel's alpha from the root, and the game's own panels under a style", () => {
    const own = tokens(STANDARD);

    assert.match(own.head, /var\(--bbm-a-head\)/);
    assert.match(own.body, /var\(--bbm-a-body\)/);
    assert.match(own.popBg, /var\(--bbm-a-popBg\)/);
    for (const selector of FOLLOW) {
      assert.equal(tokens(selector).head, "var(--panelColorDark)", selector);
      assert.equal(tokens(selector).body, "var(--panelColorNormal)", selector);
    }
  });

  it("write nothing the game's engine drops", () => {
    // Cohtml has no :not(), :has(), :is() or :nth-child(an+b), no outline and no currentColor, and
    // a token goes to one longhand, never the background shorthand Cohtml may not resolve.
    const found: string[] = [];

    for (const sheet of TOKEN_SHEETS) {
      for (const { selectors, prop, value } of everyDeclaration(sheet)) {
        const where = `${sheet} ${selectors.join(", ")} { ${prop}: ${value} }`;
        if (selectors.some((selector) => /:(?:not|has|is)\(|:nth-(?:child|of-type)\(/.test(selector))) found.push(where);
        if (prop === "background" && value.includes("var(")) found.push(where);
        if (/currentColor/i.test(value) || prop === "fill" || prop === "stroke" || prop === "outline") found.push(where);
      }
    }

    assert.deepEqual(found, []);
  });
});
