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
  fieldRing: "shadow", popRing: "shadow",
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
  // Plates' name band on a look-alike tile.
  ["pillText", "bandBg"],
  // The tile's own surface, which a look may set apart from the plate's: a plate's inks hold on it too.
  ["tName", "tile"], ["tCost", "tile"],
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
  // The upgrades panel: a row's inks under the pointer, a locked row's too, and the list's own ink on its body.
  ["tName", "plateHover"], ["tNum2", "plateHover"], ["tCost", "plateHover"], ["tLocked", "plateHover"],
  ["tNum2", "plateLocked"], ["tCost", "plateLocked"], ["tName", "body"],
  // The top row's open control: its word, glyph and caret, its value, a set value and its dot, on the open fill.
  ["ctlOpenWord", "ctlOpen"], ["ctlOpenValue", "ctlOpen"], ["ctlOpenSet", "ctlOpen"], ["ctlOpenDot", "ctlOpen"],
];

/** Each fill and the surface it sits on: a style that turns the surface light must set the fill apart on it. */
const FILL_ON: readonly (readonly [fill: string, surface: string])[] = [
  // The upgrades panel's empty thumbnail square, which holds a row's baseline until its picture is drawn,
  // on a row's plate and on a locked or built row's.
  ["iconSlot", "plate"],
  ["iconSlot", "plateLocked"],
];

/** A surface an interface style can turn light: Bright blue makes these pale. */
const turnsLight = (value: string): boolean => /--panelColorNormal|--menuPanel/.test(value);
/** Ink that comes from the style itself, which Bright blue turns dark. */
const styleInk = (value: string): boolean => /--menuText|--menuTitle/.test(value);
/** A surface in the style's own bright accent, which each style redefines and no light ink reads on. */
const styleAccent = (value: string): boolean => /--accentColor/.test(value);
/** The ink a style draws on its accent: its inverted ink, dark under both styles. */
const ON_ACCENT = "var(--menuText1Inverted)";

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

  it("set each fill apart from the surface under it, in the style's own panels where the style turns that surface light", () => {
    for (const selector of [...OWN, ...FOLLOW]) {
      const map = tokens(selector);

      for (const [fill, surface] of FILL_ON) {
        const where = `${selector}: ${fill} on ${surface}`;
        assert.notEqual(map[fill], map[surface], where);
        if (turnsLight(map[surface])) assert.match(map[fill], /^var\(--menuPanel\d\)$/, where);
      }
    }
  });

  it("never put light ink on a panel a style turns light, nor a style's ink on the look's own panel", () => {
    for (const selector of [...OWN, ...FOLLOW]) {
      const map = tokens(selector);

      for (const [ink, surface] of INK_ON) {
        const where = `${selector}: ${ink} on ${surface}`;
        if (turnsLight(map[surface])) assert.ok(styleInk(map[ink]), where);
        else if (styleAccent(map[surface])) assert.equal(map[ink], ON_ACCENT, where);
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

  it("ring the upgrades panel's empty square in an edge apart from every plate a row draws on, the style's ink under a style", () => {
    const list = "mods/BuildingList/buildingList.module.scss";
    const square = declarationsOf(list, ".iconPlaceholder");

    // Every side's longhand, as Cohtml drops a border shorthand fed by var(); a border-box square keeps its size.
    for (const side of ["top", "right", "bottom", "left"]) {
      assert.equal(square[`border-${side}-color`], "var(--bbm-iconSlotEdge)", side);
      assert.equal(square[`border-${side}-style`], "solid", side);
      assert.match(square[`border-${side}-width`] ?? "", /^\d*\.?\d+rem$/, side);
    }
    for (const selector of [...OWN, ...FOLLOW]) {
      const map = tokens(selector);
      for (const surface of ["plate", "plateLocked", "plateHover"]) {
        const where = `${selector}: iconSlotEdge on ${surface}`;
        assert.notEqual(map.iconSlotEdge, map[surface], where);
        // On a plate a style turns light, the style's own ink, which it turns dark.
        if (turnsLight(map[surface])) assert.ok(styleInk(map.iconSlotEdge), where);
      }
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

  it("keep the hover card's inks light under every style, on the game's tooltip, which no style turns light", () => {
    // The game's tooltip is its own dark --tooltipColor, which neither style redefines; the upgrades panel's
    // card draws on it in these inks, as the detail slot's does on the dark popover panel.
    const card = "mods/BuildingHoverCard/buildingHoverCard.module.scss";
    const inks = [...new Set(everyDeclaration(card)
      .filter(({ selectors, prop }) => prop === "color" && selectors.some((selector) => selector.includes(".lookInks")))
      .map(({ value }) => /^var\(--bbm-(\w+)\)$/.exec(value)?.[1])
      .filter((key): key is string => key !== undefined))];

    assert.deepEqual(inks.sort(), ["tStateSet", "tWord"]);
    for (const selector of FOLLOW) for (const ink of inks) assert.ok(!styleInk(tokens(selector)[ink]), `${selector}: --bbm-${ink}`);
  });

  it("draw the upgrades panel's head in light inks no style turns dark, and its rows on the plates in the plates' inks", () => {
    const panel = (selector: string) => declarationsOf("mods/ExtensionMenu/extensionMenu.module.scss", selector);
    const rows = (selector: string) => declarationsOf("mods/BuildingList/buildingList.module.scss", selector);

    for (const ink of [panel(".title").color, panel(".kind").color, panel(".closeGlyph")["background-color"]]) {
      const key = /^var\(--bbm-(\w+)\)$/.exec(ink ?? "")?.[1] ?? "";
      for (const selector of FOLLOW) assert.ok(key !== "" && !styleInk(tokens(selector)[key]), `${selector}: ${ink}`);
    }
    assert.deepEqual(
      [rows(".item")["background-color"], rows(".name").color, rows(".facts").color, rows(".sortedMetric").color],
      ["var(--bbm-plate)", "var(--bbm-tName)", "var(--bbm-tNum2)", "var(--bbm-tCost)"],
    );
    assert.deepEqual([rows(".itemSelected")["background-color"], rows(".itemSelected .name").color], ["var(--bbm-arm)", "var(--bbm-armText)"]);
    // Under the pointer, locked, and the list's own ink on its body: each pair INK_ON pins.
    assert.deepEqual(
      [rows(".item:hover")["background-color"], rows(".item[data-locked=true]")["background-color"], rows(".item[data-locked=true] .name").color],
      ["var(--bbm-plateHover)", "var(--bbm-plateLocked)", "var(--bbm-tLocked)"],
    );
    assert.deepEqual([panel(".content")["background-color"], panel(".content").color], ["var(--bbm-body)", "var(--bbm-tName)"]);
  });

  it("draw the top row's open control in its own inks, the look's as before and the style's inverted ink on the style's accent", () => {
    const strip = (selector: string) => declarationsOf("mods/TopRow/topRow.module.scss", selector);

    assert.equal(strip(".strip .open")["background-color"], "var(--bbm-ctlOpen)");
    assert.deepEqual(
      [strip(".strip .open .word").color, strip(".strip .cell.open .controlGlyph")["background-color"], strip(".strip .cell.open .caret")["background-color"]],
      ["var(--bbm-ctlOpenWord)", "var(--bbm-ctlOpenWord)", "var(--bbm-ctlOpenWord)"],
    );
    assert.equal(strip(".strip .open .value").color, "var(--bbm-ctlOpenValue)");
    assert.equal(strip(".strip .open .set").color, "var(--bbm-ctlOpenSet)");
    assert.equal(strip(".strip .open .dot")["background-color"], "var(--bbm-ctlOpenDot)");
    // In the look, the inks a closed control draws in, so the look's open control reads as it did.
    for (const own of OWN) {
      const map = tokens(own);
      assert.deepEqual([map.ctlOpenWord, map.ctlOpenValue, map.ctlOpenSet, map.ctlOpenDot], [map.tWord, map.tState, map.tStateSet, map.dot], own);
    }
    for (const selector of FOLLOW) assert.ok(styleAccent(tokens(selector).ctlOpen), selector);
  });

  it("keep the open control's ink at 3:1 or more on the accent under Bright blue and Dark grey-orange", () => {
    // The game's own values for the two styles' accent and inverted ink, composited as they draw.
    const STYLES = {
      "style--bright-blue": { "--accentColorDark": [0, 139, 220, 1], "--menuText1Inverted": [0, 18, 51, 0.8] },
      "style--dark-grey-orange": { "--accentColorDark": [220, 132, 0, 1], "--menuText1Inverted": [29, 29, 29, 0.8] },
    } as const;
    const channel = (value: number) => {
      const unit = value / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: readonly number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const over = ([r, g, b, a]: readonly number[], ground: readonly number[]) => [r, g, b].map((value, at) => value * a + ground[at] * (1 - a));

    for (const [style, values] of Object.entries(STYLES)) {
      const map = tokens(`:global(.${style}) .standard.followStyle`);
      const read = (token: string) => values[/^var\((--[\w-]+)\)$/.exec(token)?.[1] as keyof typeof values];
      const ground = read(map.ctlOpen);
      for (const ink of ["ctlOpenWord", "ctlOpenValue", "ctlOpenSet", "ctlOpenDot"]) {
        const [light, dark] = [luminance(ground), luminance(over(read(map[ink]), ground))].sort((one, other) => other - one);
        assert.ok((light + 0.05) / (dark + 0.05) >= 3, `${style}: ${ink} on ${map.ctlOpen}`);
      }
    }
  });

  it("keep the top row's ink light under every style, since its band stays dark", () => {
    // The head is the style's dark panel, so no ink on it may be the style's own, which Bright blue
    // turns dark for its light list. The open control sits on the style's accent, and the test above
    // pins its inks.
    const inks = everyDeclaration("mods/TopRow/topRow.module.scss")
      .filter(({ selectors }) => !selectors.some((selector) => selector.includes(".open")))
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
