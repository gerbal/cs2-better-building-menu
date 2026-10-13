import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { releasedLooks } from "../src/domain/looks.ts";
import { declarationsOf, everyDeclaration, moduleSheets } from "./harness/compiledCss.ts";

/**
 * The looks' tokens as the bundle gets them: every interface style declares the keys the look
 * does, each key holds one kind of value, and no ink sits on a panel a style turns the wrong way.
 */
const LOOKS = "looks/looks.module.scss";
const STANDARD = ".standard";
/** Every finished look's own rule, and its rule under each of the game's two other interface styles. */
const OWN = releasedLooks().map((look) => `.${look.id}`);
const FOLLOW = releasedLooks().flatMap((look) => [
  `:global(.style--bright-blue) .${look.id}.followStyle`,
  `:global(.style--dark-grey-orange) .${look.id}.followStyle`,
]);
/** The sheets that declare or read the tokens: each sheet that starts reading them joins. */
const TOKEN_SHEETS = moduleSheets().filter((sheet) =>
  everyDeclaration(sheet).some(({ prop, value }) => prop.startsWith("--bbm-") || value.includes("var(--bbm-")));

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
  // One length: a radius token feeds one corner's longhand, since Cohtml drops a shorthand fed by var().
  length: new RegExp(`^${LENGTH}$`),
  shadow: new RegExp(`^(?:none|(?:inset )?${LENGTH} ${LENGTH} .+)$`),
  gradient: /^linear-gradient\(.+\)$/,
  filter: /^(?:none|var\(--panelBlur\))$/,
};

/** Each ink and a surface it sits on, as the frame draws them: an ink can sit on more than one. */
const INK_ON: readonly (readonly [ink: string, surface: string])[] = [
  ["tName", "plate"], ["tTyped", "plate"], ["tCost", "plate"], ["tNum2", "plate"], ["tGlyph", "plate"], ["tLocked", "plateLocked"], ["thumb", "track"],
  ["tWord", "head"], ["tState", "head"], ["tStateSet", "head"], ["tDim", "head"], ["tRead1", "head"], ["tRead2", "head"],
  ["tabCount", "head"], ["tabIcon", "head"], ["amber", "head"], ["tQuery", "fieldBg"],
  ["armText", "arm"], ["armNum", "arm"], ["pillText", "pillBg"], ["tagText", "tagBg"],
  ["bodyChipText", "bodyChipBg"], ["bodyChipDim", "bodyChipBg"], ["bodyWord", "bodyChipBg"],
  ["bodyCtlText", "bodyCtl"], ["bodyCtlDim", "bodyCtl"], ["bodyLabel", "body"],
  ["bodyMilestone", "plateLocked"], ["bodyEntMark", "plate"],
  // The icons: a locked icon's "MS n" on its own plate, bare under the styles, so on the body.
  ["bodyMilestone", "body"],
  // The label plates: a group's name, its count, and Locked.
  ["bodyWord", "labBg"], ["bodyChipDim", "labBg"], ["bodyMilestone", "labBg"],
  // The cards: Enter's mark on its badge.
  ["entMark", "badgeBg"],
  // The hover card: its name and figures, their words and the key number's glyph, a locked building's milestone.
  ["tStateSet", "popBg"], ["tWord", "popBg"], ["amber", "popBg"],
];

/** A surface an interface style can turn light: Bright blue makes these pale. */
const turnsLight = (value: string): boolean => /--panelColorNormal|--menuPanel/.test(value);
/** Ink that comes from the style itself, which Bright blue turns dark. */
const styleInk = (value: string): boolean => /--menuText|--menuTitle/.test(value);

describe("the looks' tokens", () => {
  it("give every look and every interface style the keys Standard declares, and no others", () => {
    const keys = Object.keys(tokens(STANDARD)).sort();

    assert.ok(keys.length >= 70, `the look declares ${keys.length} keys`);
    assert.deepEqual(OWN, [".standard", ".plates"]);
    for (const selector of [...OWN, ...FOLLOW]) assert.deepEqual(Object.keys(tokens(selector)).sort(), keys, selector);
  });

  it("draw Plates as Standard but for its tiles, its pills, tags and bands, and its plated tabs", () => {
    const standard = tokens(STANDARD);
    const plates = tokens(".plates");
    const moved = Object.keys(standard).filter((key) => plates[key] !== standard[key]).sort();

    // Its name bands' ground is the one Standard declares.
    assert.deepEqual(moved, ["pillBg", "tabHover", "tabUnlit", "tagBg", "tile"]);
    assert.equal(plates.tile, "rgba(98, 128, 138, 0.34)");
    for (const key of ["bandBg", "pillBg", "tagBg"]) assert.equal(plates[key], "rgba(20, 27, 34, 0.66)", key);
    assert.equal(plates.tabUnlit, "rgba(98, 128, 138, 0.2)");
    assert.equal(plates.tabHover, "rgba(98, 128, 138, 0.3)");
  });

  it("hold one kind of value per key, in the look and under every style", () => {
    for (const selector of [...OWN, ...FOLLOW]) {
      for (const [key, value] of Object.entries(tokens(selector))) {
        const kind = KIND[key] ?? "colour";
        assert.match(value, PATTERN[kind], `${selector} --bbm-${key} is not a ${kind}`);
      }
    }
  });

  it("never put light ink on a panel a style turns light, nor a style's ink on the look's own panel", () => {
    for (const selector of [...OWN, ...FOLLOW]) {
      const map = tokens(selector);

      for (const [ink, surface] of INK_ON) {
        const where = `${selector}: ${ink} on ${surface}`;
        if (turnsLight(map[surface])) assert.ok(styleInk(map[ink]), where);
        else assert.ok(!/--menuText1Normal|--menuText2Normal/.test(map[ink]), where);
      }
    }
  });

  it("follow the game's style with every ink drawn on the body, which the pane draws its chips and summaries on", () => {
    // The blur is the body's material, not an ink, and the body itself is pinned above.
    const bodyInks = Object.keys(tokens(STANDARD)).filter((key) => /^body[A-Z]/.test(key) && key !== "bodyBlur");

    assert.ok(bodyInks.length >= 8, `the look declares ${bodyInks.length} body inks`);
    for (const selector of FOLLOW) {
      for (const key of bodyInks) {
        assert.match(tokens(selector)[key], /^var\(--(?:menuPanel\d|menuText\dNormal)\)$/, `${selector} --bbm-${key}`);
      }
    }
  });

  it("draw the list's milestone and Enter's mark in body inks, the look's amber and blue, dark on Bright blue's light plates", () => {
    const list = "mods/Bodies/listBody.module.scss";

    assert.equal(declarationsOf(list, ".milestone").color, "var(--bbm-bodyMilestone)");
    assert.equal(declarationsOf(list, ".enterMark")["background-color"], "var(--bbm-bodyEntMark)");
    for (const own of OWN) {
      assert.equal(tokens(own).bodyMilestone, tokens(own).amber, own);
      assert.equal(tokens(own).bodyEntMark, tokens(own).entMark, own);
    }
    for (const selector of FOLLOW) {
      assert.equal(tokens(selector).bodyMilestone, "var(--menuText1Normal)", selector);
      assert.equal(tokens(selector).bodyEntMark, "var(--menuText1Normal)", selector);
    }
  });

  it("draw a dimmed typed word in the style's own second ink on its plates, the look's dim ink in the look", () => {
    for (const own of OWN) assert.equal(tokens(own).tTyped, tokens(own).tDim, own);
    for (const selector of FOLLOW) assert.equal(tokens(selector).tTyped, "var(--menuText2Normal)", selector);
  });

  it("draw a list plate's unit glyph in the glyph ink, dim on a built plate and the armed ink on the armed, as its number", () => {
    const list = "mods/Bodies/listBody.module.scss";
    const ink = (selector: string, prop: string) => declarationsOf(list, selector)[prop];

    assert.equal(ink(".unitGlyph", "background-color"), "var(--bbm-tGlyph)");
    assert.equal(ink(".built .unitGlyph", "background-color"), ink(".built .second", "color"));
    assert.equal(ink(".armed .unitGlyph", "background-color"), ink(".armed .second", "color"));
  });

  it("draw the label plates in body inks on a plate that follows the style, Locked in the milestone's ink", () => {
    const labels = "mods/Bodies/labelPlate.module.scss";

    assert.equal(declarationsOf(labels, ".label")["background-color"], "var(--bbm-labBg)");
    assert.equal(declarationsOf(labels, ".labelText").color, "var(--bbm-bodyWord)");
    assert.equal(declarationsOf(labels, ".labelCount").color, "var(--bbm-bodyChipDim)");
    assert.equal(declarationsOf(labels, ".lockedLabel .labelText").color, "var(--bbm-bodyMilestone)");
    for (const selector of FOLLOW) assert.equal(tokens(selector).labBg, "var(--menuPanel2)", selector);
  });

  it("draw the cards in the plates' inks, the milestone in the body's, and Enter's mark on a badge no style turns light", () => {
    const cards = "mods/Bodies/cardsBody.module.scss";

    assert.equal(declarationsOf(cards, ".card")["background-color"], "var(--bbm-plate)");
    assert.equal(declarationsOf(cards, ".name").color, "var(--bbm-tName)");
    assert.equal(declarationsOf(cards, ".facts").color, "var(--bbm-tNum2)");
    assert.equal(declarationsOf(cards, ".sorted").color, "var(--bbm-tCost)");
    assert.equal(declarationsOf(cards, ".milestone").color, "var(--bbm-bodyMilestone)");
    assert.equal(declarationsOf(cards, ".enterBadge")["background-color"], "var(--bbm-badgeBg)");
    assert.equal(declarationsOf(cards, ".enterMark")["background-color"], "var(--bbm-entMark)");
    for (const selector of [...OWN, ...FOLLOW]) assert.ok(!turnsLight(tokens(selector).badgeBg), selector);
  });

  it("draw the icons' milestone in the body's ink on the locked plate a style can turn light, a family's word on its dark pill", () => {
    const icons = "mods/Bodies/iconsBody.module.scss";

    assert.equal(declarationsOf(icons, ".milestone").color, "var(--bbm-bodyMilestone)");
    assert.equal(declarationsOf(icons, ".unplaceable")["background-color"], "var(--bbm-iconLocked)");
    assert.equal(declarationsOf(icons, ".pillWord")["background-color"], "var(--bbm-pillBg)");
    assert.equal(declarationsOf(icons, ".pillWord").color, "var(--bbm-pillText)");
    for (const selector of [...OWN, ...FOLLOW]) assert.ok(!turnsLight(tokens(selector).pillBg), selector);
  });

  it("give a locked icon a plate apart from both family tones and the lit plate, in the look and under every style", () => {
    for (const selector of [...OWN, ...FOLLOW]) {
      const map = tokens(selector);

      assert.ok(map.iconLocked, `${selector}: no iconLocked`);
      // Bare, or a plate no style turns light, so "MS n" stands on what the body pair above pins.
      assert.ok(map.iconLocked === "transparent" || !turnsLight(map.iconLocked), selector);
      for (const other of ["icon", "iconAlt", "plateHover"]) assert.notEqual(map.iconLocked, map[other], `${selector}: iconLocked and ${other}`);
    }
  });

  it("draw the tiles' milestone in the look's amber on the tag, whose dark ground no style turns light", () => {
    const tiles = "mods/Bodies/tilesBody.module.scss";

    assert.equal(declarationsOf(tiles, ".milestone").color, "var(--bbm-amber)");
    assert.equal(declarationsOf(tiles, ".tag")["background-color"], "var(--bbm-tagBg)");
    for (const selector of [...OWN, ...FOLLOW]) {
      const map = tokens(selector);
      assert.ok(!turnsLight(map.tagBg) && !styleInk(map.amber), selector);
    }
  });

  it("keep the top row's ink light under every style, since its band stays dark", () => {
    // The head is the style's dark panel, so no ink on it may be the style's own, which Bright blue
    // turns dark for its light list.
    const inks = everyDeclaration("mods/TopRow/topRow.module.scss")
      .filter(({ prop }) => prop === "color" || prop === "background-color")
      .map(({ value }) => /^var\(--bbm-(\w+)\)$/.exec(value)?.[1])
      .filter((key): key is string => key !== undefined);

    assert.ok(inks.length >= 4, `the top row reads ${inks.length} inks`);
    for (const selector of FOLLOW) {
      const map = tokens(selector);
      for (const ink of inks) assert.ok(!styleInk(map[ink]), `${selector}: --bbm-${ink} is ${map[ink]}`);
    }
  });

  it("take each panel's alpha from the root, and the game's own panels under a style", () => {
    for (const look of OWN) {
      const own = tokens(look);
      assert.match(own.head, /var\(--bbm-a-head\)/, look);
      assert.match(own.body, /var\(--bbm-a-body\)/, look);
      assert.match(own.popBg, /var\(--bbm-a-popBg\)/, look);
    }
    for (const selector of FOLLOW) {
      assert.equal(tokens(selector).head, "var(--panelColorDark)", selector);
      assert.equal(tokens(selector).body, "var(--panelColorNormal)", selector);
    }
  });

  it("write nothing the game's engine drops", () => {
    // Cohtml has no :not(), :has(), :is() or :nth-child(an+b), no outline and no currentColor, and
    // a token goes to one longhand, never the background shorthand Cohtml may not resolve.
    const found: string[] = [];
    const readers = [
      LOOKS,
      "mods/TopRow/topRow.module.scss",
      "mods/BuildingMenu/assetMenu.module.scss",
      "mods/ControlPopover/controlPopover.module.scss",
      "mods/Pickers/pickerList.module.scss",
      "mods/Pickers/filterPanel.module.scss",
      "mods/ControlPane/controlPane.module.scss",
      "mods/Notch/notch.module.scss",
    ];
    for (const sheet of readers) {
      assert.ok(TOKEN_SHEETS.includes(sheet), `${sheet} reads the tokens`);
    }

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
