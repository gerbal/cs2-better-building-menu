import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ASSET_MENU_MIN_HEIGHT, ASSET_MENU_RESIZE_HANDLE_HEIGHT, TAB_CELL_MIN_WIDTH, TAB_CELL_PADDING } from "../src/domain/assetMenuLayout.ts";
import { declarationsOf, everyDeclaration, moduleSheets, rem, resolvedOn, selectorsOf, sides, winnerOn } from "./harness/compiledCss.ts";

/**
 * Stylesheet contracts: layout rules Cohtml gets wrong or the design pins,
 * asserted against the compiled stylesheets. A renderer draws markup, not
 * layout, so no markup assertion can see a heading clipped or a row of tabs
 * sliced.
 */
const CATALOG = "mods/BuildingCatalog/buildingCatalog.module.scss";
const PANE = "mods/ControlPane/controlPane.module.scss";
const ASSET_MENU = "mods/BuildingMenu/assetMenu.module.scss";
const TOP_ROW = "mods/TopRow/topRow.module.scss";
const TOP_EDGE = "mods/TopEdge/topEdge.module.scss";
const GROUPS = "mods/GroupedResults/groupedResults.module.scss";
const CARD = "mods/BuildingHoverCard/buildingHoverCard.module.scss";
const PICKER = "mods/ExtensionMenu/extensionMenu.module.scss";
const RESIZE = "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
const LIST = "mods/BuildingList/buildingList.module.scss";
const GRID = "mods/BuildingGrid/buildingGrid.module.scss";
const TAB_ROW = "mods/TabRow/tabRow.module.scss";
const FILTER_PANEL = "mods/Pickers/filterPanel.module.scss";
const PICKER_LIST = "mods/Pickers/pickerList.module.scss";
const POPOVER = "mods/ControlPopover/controlPopover.module.scss";

const catalog = (selector: string) => declarationsOf(CATALOG, selector);
const pane = (selector: string) => declarationsOf(PANE, selector);
const groups = (selector: string) => declarationsOf(GROUPS, selector);
const card = (selector: string) => declarationsOf(CARD, selector);
const picker = (selector: string) => declarationsOf(PICKER, selector);
const resize = (selector: string) => declarationsOf(RESIZE, selector);

describe("Asset menu stylesheet contracts", () => {
  it("sizes a group to its tiles and keeps the heading to one line inside it", () => {
    // The heading is cut to the width the tiles occupy, rather than the tiles
    // being spread to the width the heading wants: reserving label room buys
    // readable headings at the price of mostly-empty groups. Never a second
    // line, which costs every group in the row a line of tiles.
    assert.equal(groups(".group")["min-width"], undefined);
    assert.equal(groups(".groupLabel")["white-space"], "nowrap");
    assert.equal(groups(".groupLabel").overflow, "hidden");
    // A band sizes to its content rather than claiming the whole line: one
    // that is wider than the row still fills it, via max-width and its own
    // children wrapping, while a narrow one lets a sibling share the line.
    assert.equal(groups(".groupBand").flex, "0 1 auto");
    // No heading, no row reserved for one.
    assert.equal(groups(".groupUnlabeled")["padding-top"], "0");
  });

  it("keeps the heading out of flow so it cannot widen the group", () => {
    // The whole reason the reserve is measured in JS rather than being the
    // heading's own height: an in-flow heading sets the group's intrinsic
    // width. GroupRow reserves the row's tallest heading instead.
    assert.equal(groups(".groupHeading").position, "absolute");
    // Against a wrapping label the count sits on the first line, not the
    // middle of the stack.
    assert.equal(groups(".groupHeading")["align-items"], "flex-start");
  });

  it("stops the expanded row's chevron resolving its height against the whole row", () => {
    // .rowDetailsButton sets `height: 100%` so it fills the collapsed row,
    // which has a definite height to resolve against. Expanded, the row is
    // `height: auto` and that percentage resolves against the WRAPPED row.
    assert.equal(catalog(".row[data-expanded=true] .rowDetailsButton").height, "auto");
    // And the collapsed rule it is overriding must still be the percentage,
    // so this contract keeps pointing at something real.
    assert.equal(catalog(".rowDetailsButton").height, "100%");
  });

  it("keeps a details label-value pair on one line and wraps it as a unit", () => {
    // A .rowDetail is a flex item in a wrapping row; left free to shrink it
    // narrows to its longest word and the label wraps, and the engine does not
    // grow the line, so the text overflows into what is drawn beneath it.
    assert.equal(catalog(".rowDetail").flex, "0 0 auto");
    assert.equal(catalog(".rowDetail")["white-space"], "nowrap");
    assert.equal(catalog(".rowDetailLabel")["white-space"], "nowrap");
  });

  it("pairs the hover card's figures two across, and lets a list take the row", () => {
    // The pairing is left to the flow: each row is exactly half and does not
    // grow, so two fit, a third cannot, and only a stack of values takes a
    // whole row.
    assert.equal(card(".cardLines")["flex-wrap"], "wrap");
    assert.equal(card(".cardLine").flex, "0 0 50%");
    assert.equal(card(".cardLineWide")["min-width"], "100%");
    // Cohtml wraps by the flex basis clamped to max-width, so the half's cap has
    // to be lifted too, or the wide line stays beside its neighbour.
    assert.equal(card(".cardLineWide")["max-width"], "100%");
    // A value keeps its width in a half, so a pair too long for it overflows the
    // line where CardLine can measure it; Cohtml squeezed a shrinkable value to
    // a sliver instead, and drew its text over the label. With the row to
    // itself, the value may wrap.
    assert.equal(card(".cardValue").flex, "1 0 auto");
    assert.equal(card(".cardValue")["white-space"], "nowrap");
    assert.equal(card(".cardLineWide .cardValue")["flex-shrink"], "1");
    assert.equal(card(".cardLineWide .cardValue")["white-space"], "normal");
    // Row spacing here is margins, so the stack reads as one column with the
    // container pulling the first row's back off.
    assert.equal(card(".cardLines").gap, undefined);
    assert.equal(rem(card(".cardLines")["margin-top"]), -rem(card(".cardLine")["margin-top"]));
  });

  it("reserves in the header exactly what a row spends right of its last cell", () => {
    // The header and the rows are two flex containers describing one table,
    // so a column lines up only if both reserve the same space: the row's
    // own right padding, the chevron, the outer padding, and ONE gap — the
    // one between the select and the chevron. A control added to the row and
    // not to the reserve steps every header off the cells it heads.
    const spent = rem(sides(catalog(".rowSelect").padding)[1])
      + rem(catalog(".rowDetailsButton").width)
      + rem(sides(catalog(".row").padding)[1])
      + rem(catalog(".row > * + *")["margin-left"]);

    assert.equal(rem(sides(catalog(".columnHeader").padding)[1]), spent);
    // And on the left, the header starts where the row's select does.
    assert.equal(sides(catalog(".columnHeader").padding)[3], sides(catalog(".rowSelect").padding)[3]);
  });

  it("spaces the header's columns as the rows space their cells", () => {
    // .columnHeader > * + * gives each header the rows' gap, and .metricHeader's
    // button-chrome reset (`margin: 0`, same specificity, later) takes it
    // straight back, stepping every header left of the cells it heads.
    const gap = catalog(".rowSelect > * + *")["margin-left"];

    assert.equal(catalog(".columnHeader > * + *")["margin-left"], gap);
    assert.equal(sides(catalog(".metricHeader").margin)[3], gap, "a margin reset discards the column gap");
  });

  it("makes the row Place hint visible for hover and keyboard focus", () => {
    const hidden = catalog(".placeHint");
    for (const state of [".rowSelect:hover .placeHint", ".rowSelect:focus .placeHint"]) {
      assert.notDeepEqual(catalog(state), {}, `${state} draws nothing`);
      assert.ok(
        Object.entries(catalog(state)).some(([property, value]) => hidden[property] !== value),
        `${state} leaves the hint as it was`
      );
    }
  });

  it("gives the height drag a target worth aiming at", () => {
    // The only way to change the height now that the Expand toggle is gone, so
    // it has to be both findable and hittable. The strip is the target and the
    // grip is the mark, which is why they are two elements.
    // Shared by the build menu and the extension picker, so it lives in its
    // own module rather than in either panel's.
    const strip = resize(".resizeHandle");

    // Not absolute: the upgrades panel's top edge is its first row, in the flow above its header.
    assert.notEqual(strip.position, "absolute");
    // Taller than the mark it draws, so the edge is grabbable without aiming.
    // The strip is drawn at the height a drag measures against.
    assert.equal(rem(strip.height), ASSET_MENU_RESIZE_HANDLE_HEIGHT);
    const gripHeight = rem(resize(".resizeGrip").height);
    assert.ok(gripHeight > 0 && gripHeight < ASSET_MENU_RESIZE_HANDLE_HEIGHT, `grip height ${gripHeight}rem`);
  });

  it("announces the drag the way the game does: its cursors, its thumb's weight", () => {
    // The game draws its own cursors and maps none of the CSS keywords past
    // default/pointer/none: `ns-resize` shows NOTHING on hover, so the edge
    // never announced itself. vertical-can-resize is what vanilla's own
    // draggable value fields show, and vertical-resize is what they show
    // mid-drag.
    const grip = resize(".resizeGrip");

    assert.equal(resize(".resizeHandle").cursor, "url(cursor://vertical-can-resize)");
    assert.equal(resize(".resizeBlocker").cursor, "url(cursor://vertical-resize)");
    assert.deepEqual(everyDeclaration(RESIZE).filter(({ prop, value }) => prop === "cursor" && !value.startsWith("url(cursor://")), []);
    // At rest the pill weighs what the game's scrollbar thumb weighs, so it
    // reads as a thing to grab rather than a texture of the chrome.
    assert.equal(grip["background-color"], "rgba(var(--scrollbarColor), 0.6)");
    // A short bar on the edge. Anything wider is a border between two regions,
    // and rem and px differ here, so a smaller number draws a thinner mark.
    assert.equal(grip.height, "8rem");
    assert.equal(grip.width, "75rem");
  });

  it("keeps the top row one row high and the tab row one line", () => {
    // The box keeps its height whatever a menu holds, so nothing in its chrome may wrap or grow.
    const band = declarationsOf(TOP_ROW, ".topBand");
    const row = declarationsOf(TOP_ROW, ".topRow");
    const tabs = declarationsOf(TAB_ROW, ".tabRow");

    assert.equal(band["padding-top"], "2rem");
    assert.equal(band["padding-bottom"], "4rem");
    assert.equal(row.height, "28rem");
    assert.equal(row["min-height"], undefined);
    assert.equal(row["flex-wrap"], undefined);
    assert.equal(tabs["flex-wrap"], "nowrap");
    assert.equal(tabs.height, "26rem");
    assert.equal(tabs.overflow, "hidden");
  });

  it("lays the top edge over the box's top edge, above the top row", () => {
    // The box's last child, 6 rem above the box and 2 inside it, over the top row's band.
    const edge = declarationsOf(TOP_EDGE, ".topEdge");

    assert.equal(edge.position, "absolute");
    assert.equal(edge.top, "-6rem");
    assert.equal(edge.height, "8rem");
    assert.ok(Number(edge["z-index"]) > Number(declarationsOf(TOP_ROW, ".topBand")["z-index"]), "over the top row's band");
    assert.equal(edge.cursor, "url(cursor://vertical-can-resize)");
  });

  it("keeps the controls on one line: the strip and its cells never wrap or shrink, a value never widens its cell", () => {
    const strip = declarationsOf(TOP_ROW, ".strip");

    assert.equal(strip.flex, "0 0 auto");
    assert.equal(strip["flex-wrap"], "nowrap");
    assert.equal(declarationsOf(TOP_ROW, ".cellBox").flex, "0 0 auto");
    assert.equal(declarationsOf(TOP_ROW, ".value").overflow, "hidden");
    assert.equal(declarationsOf(TOP_ROW, ".dot").position, "absolute");
  });

  it("draws the popovers over the top edge's strip, from a bottom offset", () => {
    const popover = declarationsOf("mods/ControlPopover/controlPopover.module.scss", ".popover");

    assert.equal(popover.position, "absolute");
    assert.ok(Number(popover["z-index"]) > Number(declarationsOf(TOP_EDGE, ".topEdge")["z-index"]), "over the top edge");
    // Anchored by a fixed bottom offset, inline, as the pane's own menus are on this engine.
    assert.equal(popover.top, undefined);
    assert.equal(popover.bottom, undefined);
  });

  it("paints the pane's lists over the box's top row and top edge, and under the popovers", () => {
    // The pane's blur makes it a stacking context, so its lists, which open left over the box, paint
    // at the pane's own order: above the top row's band and the top edge, below a popover.
    const shown = pane(".pane");
    const order = (sheet: string, selector: string) => Number(declarationsOf(sheet, selector)["z-index"]);

    assert.equal(shown["backdrop-filter"], "var(--bbm-bodyBlur)");
    assert.equal(shown.position, "relative");
    assert.ok(Number(shown["z-index"]) > order(TOP_ROW, ".topBand"), "over the top row's band");
    assert.ok(Number(shown["z-index"]) > order(TOP_EDGE, ".topEdge"), "over the top edge");
    assert.ok(Number(shown["z-index"]) < order(POPOVER, ".popover"), "under the popovers");
    assert.ok(order(POPOVER, ".popover") > order(TOP_EDGE, ".topEdge"), "the popovers still over the top edge");
    assert.ok(order(TOP_EDGE, ".topEdge") > order(TOP_ROW, ".topBand"), "the top edge still over the top row");
    // The lists keep their own anchor: each picker is positioned, so the pane's position moves none.
    assert.equal(pane(".picker").position, "relative");
    assert.equal(pane(".pickerOptions").position, "absolute");
  });

  it("draws the box's surfaces in the look's material: the bands its head, the body its list under its blur", () => {
    // One material for the whole box: the game's translucent list between the look's bands shows a seam.
    assert.equal(declarationsOf(TOP_ROW, ".topBand")["background-color"], "var(--bbm-head)");
    assert.equal(declarationsOf(TAB_ROW, ".band")["background-color"], "var(--bbm-head)");
    const body = declarationsOf(ASSET_MENU, ".content");
    assert.equal(body["background-color"], "var(--bbm-body)");
    assert.equal(body["backdrop-filter"], "var(--bbm-bodyBlur)");
    assert.equal(body["background-image"], undefined);
  });

  it("sizes the clear button itself, over the game's Button and its background", () => {
    // The clear button is the game's icon Button, whose one class pins its size and paints a
    // background: two classes outrank it whichever sheet loads last.
    const clear = [["field"], ["clear"]];

    for (const [prop, value] of [["width", "22rem"], ["height", "22rem"], ["background-color", "transparent"]]) {
      const winner = winnerOn(TOP_ROW, clear, prop);
      assert.equal(winner?.value, value, prop);
      assert.ok((winner?.classes ?? 0) >= 2 || winner?.important, `${prop}: ${JSON.stringify(winner)}`);
    }
  });

  it("sizes a tab cell itself, over the game's Button and its square", () => {
    // A cell is the game's Button, whose one class pins 24 x 24. The cell's own size outranks it
    // with two classes whichever sheet loads last, so a cell is as wide as its picture or its name.
    const cell = [["tabRow"], ["cells"], ["cell"]];
    const width = winnerOn(TAB_ROW, cell, "width");
    const height = winnerOn(TAB_ROW, cell, "height");

    assert.equal(width?.value, "auto");
    assert.equal(height?.value, "26rem");
    for (const size of [width, height]) assert.ok((size?.classes ?? 0) >= 2 || size?.important, JSON.stringify(size));
  });

  it("puts a picture cell's least width in its slot, where the row's width sees it", () => {
    // Cohtml sizes the row of cells from each cell's own width and skips its min-width, so a cell
    // narrower than its floor would be cut. The slot's stated width makes the floor the content's.
    const slot = rem(declarationsOf(TAB_ROW, ".iconSlot").width);

    assert.equal(slot + 2 * TAB_CELL_PADDING, TAB_CELL_MIN_WIDTH);
  });

  it("draws the lit tab's count in the lit text while a search is typed", () => {
    // During a search every count is a match count in the search's mark, but the lit cell keeps
    // its own text colour: the mark's light cyan drops out against the lit gradient.
    const count = (...cell: string[]) => resolvedOn(TAB_ROW, [["tabRow"], ["cell", ...cell], ["count"]], "color");

    assert.equal(count("lit", "matches"), "var(--bbm-armText)");
    assert.equal(count("lit"), "var(--bbm-armText)");
    assert.equal(count("matches"), "var(--bbm-entMark)");
    assert.equal(count(), "var(--bbm-tabCount)");
  });

  it("draws a tab's picture whole at its own aspect, without measuring it", () => {
    // Cohtml has no object-fit and reports no natural size for a picture, and a mod's picture
    // need not be square: drawn as a background, contained and centred, it keeps its shape.
    const shown = declarationsOf(TAB_ROW, ".picture");

    assert.equal(shown["background-size"], "contain");
    assert.equal(shown["background-position"], "center");
    assert.equal(shown["background-repeat"], "no-repeat");
    assert.equal(shown.width, shown.height);
  });

  it("squares the list's bottom corners, which the tab row's band rounds", () => {
    // The band under the list is the box's bottom edge, so it carries the rounding. A rounded
    // list above the band's square top would notch the seam between them.
    const list = declarationsOf(ASSET_MENU, ".content");
    const band = declarationsOf(TAB_ROW, ".band");

    assert.equal(list["border-bottom-left-radius"], "0");
    assert.equal(list["border-bottom-right-radius"], "0");
    assert.equal(band["border-bottom-left-radius"], "var(--bbm-boxRadius)");
    assert.equal(band["border-bottom-right-radius"], "var(--bbm-boxRadius)");
  });

  it("matches the vanilla options bank it sits opposite", () => {
    // Read off the live tool-options bank rather than eyeballed: rows are
    // padding 4rem 12rem with no min-height, and labels are bold 16rem. Both
    // banks are on screen together, so any drift between them shows.
    assert.equal(pane(".row").padding, "4rem 12rem");
    assert.equal(pane(".row")["min-height"] ?? "0", "0");
    assert.equal(pane(".rowLabel")["font-weight"], "bold");
    assert.equal(pane(".rowLabel")["font-size"], "16rem");
  });

  it("lets the lists' text buttons size to their text", () => {
    // The icon variant pins a square width, so any control here carrying text
    // has to override it, or the button sizes to the square and elides the
    // word inside it.
    for (const [sheet, selector] of [[PANE, ".pickerSummary"], [FILTER_PANEL, ".chips .clearAll"], [PICKER_LIST, ".list .row"]] as const) {
      assert.equal(declarationsOf(sheet, selector).width, "auto !important", selector);
    }
  });

  it("keeps a pane row's label whole, its value cut inside the summary, at any text size", () => {
    // A summary gives way at a larger text size, never the row's label beside it.
    assert.equal(pane(".rowLabel").flex, "0 0 auto");
    assert.equal(pane(".rowLabel")["white-space"], "nowrap");
    for (const selector of [".rowValue", ".picker", ".pickerSummary", ".pickerLabel"]) {
      assert.equal(pane(selector)["min-width"], "0", selector);
    }
    assert.equal(pane(".pickerLabel").overflow, "hidden");
    // A flex item: Cohtml ignores text-overflow there, so the summary states none.
    assert.equal(pane(".pickerLabel")["text-overflow"], undefined);
  });

  it("draws a list on the same surface over the pane as in the top row's popover", () => {
    const popover = declarationsOf(POPOVER, ".popover");

    for (const prop of ["width", "padding", "border-radius", "background-color", "box-shadow"]) {
      assert.equal(pane(".pickerOptions")[prop], popover[prop], prop);
    }
  });

  it("draws the pane's chips and summaries in the body's inks, which follow the game's style, and the popover's chips in its own", () => {
    // The pane's surface is the look's body, which Bright blue turns light; the popover stays dark.
    const chip = (onBody: boolean, rest: string[][], prop: string) =>
      winnerOn(FILTER_PANEL, [onBody ? ["chips", "onBody"] : ["chips"], ...rest], prop)?.value;
    const cases: [string[][], string, string, string][] = [
      [[["chip"]], "background-color", "bodyChipBg", "chipBg"],
      [[["chip"], ["chipText"]], "color", "bodyChipText", "tState"],
      [[["chip"], ["chipRemove"]], "color", "bodyChipDim", "tDim"],
      [[["clearAll"]], "color", "bodyWord", "tWord"],
      [[["clearAll"]], "background-color", "bodyChipBg", "chipBg"],
    ];

    for (const [rest, prop, body, popover] of cases) {
      const where = `${rest.map((classes) => classes.join(".")).join(" ")} ${prop}`;
      assert.equal(chip(true, rest, prop), `var(--bbm-${body})`, where);
      assert.equal(chip(false, rest, prop), `var(--bbm-${popover})`, where);
    }

    // Three classes on the body outrank the hovers on a tie, so the body restates them.
    assert.equal(declarationsOf(FILTER_PANEL, ".chips.onBody .chipRemove:hover").color, "var(--bbm-tStateSet)");
    assert.equal(declarationsOf(FILTER_PANEL, ".chips.onBody .clearAll:hover")["background-color"], "var(--bbm-ctlOpen)");

    assert.equal(pane(".rowLabel").color, "var(--bbm-bodyLabel)");
    assert.equal(pane(".pickerSummary")["background-color"], "var(--bbm-bodyCtl)");
    assert.equal(pane(".pickerSummary").color, "var(--bbm-bodyCtlText)");
    assert.equal(pane(".pickerSummary:hover")["background-color"], "var(--bbm-bodyCtlHover)");
    assert.equal(pane(".caret").color, "var(--bbm-bodyCtlDim)");
  });

  it("draws a list row that is lit and dimmed at once in the selected fill's ink, faded, never the dim ink on that fill", () => {
    const row = (...states: string[]) => [["list"], ["row", ...states]];

    assert.equal(resolvedOn(PICKER_LIST, row("lit", "dim"), "color"), "var(--bbm-armText)");
    assert.equal(resolvedOn(PICKER_LIST, row("lit", "dim"), "opacity"), "0.7");
    assert.equal(resolvedOn(PICKER_LIST, row("lit", "dim"), "background-color"), "var(--bbm-popOn)");
    assert.equal(resolvedOn(PICKER_LIST, row("dim"), "color"), "var(--bbm-tDim)");
    assert.equal(resolvedOn(PICKER_LIST, row("lit"), "opacity"), undefined);
  });

  it("opens Width, every menu each way by one fixed offset, so neither way unsets the other's", () => {
    const up = declarationsOf(PICKER_LIST, ".widthList.up");
    const down = declarationsOf(PICKER_LIST, ".widthList.down");

    assert.ok(up.bottom && up.top === undefined, "upward from its bottom");
    assert.ok(down.top && down.bottom === undefined, "downward from its top");
    assert.equal(declarationsOf(PICKER_LIST, ".widthList").bottom, undefined);
  });

  it("opens the pane's menus upward, away from the bottom bar", () => {
    // The pane is bottom-aligned against the bottom bar, so a menu growing
    // downward opens off the screen.
    assert.ok(pane(".pickerOptions").bottom, "anchored by its bottom edge");
    assert.equal(pane(".pickerOptions").top, undefined);
  });
});

/**
 * Declarations Cohtml parses and drops, or never implemented. Each is a rule
 * the stylesheet states and the engine silently ignores, so the source reads as
 * if the layout were handled and only a WARN in UI.log disagrees.
 *
 * `text-overflow: ellipsis` is deliberately NOT here: it is a no-op on a FLEX
 * ITEM and works normally elsewhere. tileLabel.ts elides in JS where it matters.
 */
/** Shorthands Cohtml drops whole when a var() feeds any part of them. */
const VAR_FED_SHORTHANDS = new Set([
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style", "border-radius", "background",
]);
const UNSUPPORTED: { matches: (prop: string, value: string) => boolean; declaration: string; why: string }[] = [
  {
    matches: (prop, value) => (prop === "align-items" || prop === "align-self") && value === "baseline",
    declaration: "align-items / align-self: baseline",
    why:
      "Cohtml logs `Unable to parse declaration: align-items - baseline` and drops it, "
      + "leaving the flex default. Use flex-start, which is what it degrades to anyway.",
  },
  {
    matches: (prop, value) => prop === "display" && (value === "grid" || value === "inline-grid"),
    declaration: "display: grid",
    why: "Cohtml has no CSS grid (still absent on 2.2.1.3). Lay it out with flex.",
  },
  {
    matches: (prop) => prop === "object-fit",
    declaration: "object-fit",
    why: "Never implemented in Cohtml (no changelog row through 3.1; the parser rejects it). Size the picture's box instead.",
  },
  {
    matches: (_, value) => /var\(\s*--[\w-]+\s*,/.test(value),
    declaration: "var(--name, fallback)",
    why:
      "Cohtml has no two-argument var(): it logs an unresolved-variable warning for every element "
      + "carrying one and drops the declaration. Name a token the game always defines.",
  },
  {
    matches: (prop, value) => VAR_FED_SHORTHANDS.has(prop) && /var\(/.test(value),
    declaration: "a border or background shorthand fed by var()",
    why:
      "Cohtml logs `Custom CSS expressions are not supported in shorthand declaration` and drops it: "
      + "the colour or radius never draws. Write each longhand (border-top-color, "
      + "border-bottom-left-radius, background-color) with the var() instead.",
  },
];

describe("the catalog's floor is one row of cards", () => {
  // The player drags the height; the floor is where the drag stops. C# owns
  // it, the TS clamp reads the generated copy, and the stylesheet states it
  // again as a min-height; this keeps the stylesheet honest.
  it("is one card row under two headings: the deepest grouping a menu draws", () => {
    // Zones groups two levels deep (Residential Zones > Low Density), so its
    // first row of cards sits under two heading reserves; a floor for one
    // would clip that row by a heading's height in the menu the floor is
    // most used in.
    const vertical = (shorthand: string | undefined) => rem(sides(shorthand)[0]) + rem(sides(shorthand)[2]);
    const catalogPadding = vertical(catalog(".catalog").padding);
    const groupReserve = rem(groups(".group")["padding-top"]);
    const listPadding = vertical(declarationsOf(LIST, ".list").padding);
    // Every card is also an .item, which carries the border.
    const border = rem(declarationsOf(LIST, ".item").border.split(/\s+/)[0]);
    const cardHeight = rem(declarationsOf(LIST, ".itemCard")["min-height"]) + 2 * border;

    assert.equal(ASSET_MENU_MIN_HEIGHT, catalogPadding + 2 * groupReserve + listPadding + cardHeight);
  });

  it("states the same floor in the stylesheet", () => {
    assert.equal(rem(declarationsOf(ASSET_MENU, ".content")["min-height"]), ASSET_MENU_MIN_HEIGHT);
  });
});

describe("a wrapping row of cards keeps each card its own height", () => {
  // Cohtml sizes a wrapping flex container for all its lines, then stretches
  // the FIRST line's items to the whole container rather than the line: two
  // cards grow to two rows' height and the third lands below the box, where
  // the group's overflow clips it. A heading then says 3 over 2 visible cards.
  // Only cards can grow — the compact row states its height — but the rule
  // belongs on the container, which both share.
  it("does not let a wrapped line stretch its items", () => {
    const list = declarationsOf(LIST, ".list");

    assert.equal(list["flex-wrap"], "wrap");
    assert.equal(list["align-items"], "flex-start");
  });

  it("spaces the cards with gap, not a negative gutter", () => {
    // A group is sized to the list's max-content. With the negative-margin
    // gutter, Cohtml computed that max-content without the margins and then
    // laid the cards out with them, so a row that fit its group by
    // construction wrapped its last card on a tenth of a pixel. gap is part
    // of the max-content, so the cards fit the group they sized.
    const list = declarationsOf(LIST, ".list");

    assert.equal(list.gap, "4rem");
    assert.equal(list["margin-left"], undefined);
    assert.equal(list["margin-top"], undefined);
    assert.ok(!selectorsOf(LIST).includes(".list::after"));
  });

  it("spaces the grid's tiles with gap, for the same reason", () => {
    // Two tiles in a group sized for two stacked into a column, three went
    // two and one, while five fit their row: the same zero-slack rounding,
    // flipping per group.
    const tiles = declarationsOf(GRID, ".tiles");

    assert.equal(tiles.gap, "4rem");
    assert.equal(tiles["margin-left"], undefined);
    assert.equal(tiles["margin-top"], undefined);
  });
});

describe("Cohtml stylesheet support", () => {
  it("states no declaration the engine silently drops", () => {
    // Catching it here turns a silent log warning into a build failure.
    // Compiled, so a declaration a mixin brings in counts, and the comments
    // that explain why each is avoided cannot.
    const found: string[] = [];

    for (const sheet of moduleSheets()) {
      for (const { selectors, prop, value } of everyDeclaration(sheet)) {
        for (const { matches, declaration, why } of UNSUPPORTED) {
          if (matches(prop, value)) found.push(`${sheet} ${selectors.join(", ")}  ${declaration} — ${why}`);
        }
      }
    }

    assert.deepEqual(found, [], `Cohtml drops these declarations:\n  ${found.join("\n  ")}\n`);
  });
});

/**
 * The engine resolves 1rem to 2/3 px at the 1280x720 both instances here run,
 * because CS2 authors its UI against a 1920 design width. So a rem value lands
 * on a whole pixel only when it is a multiple of 1.5.
 */
const REM_PX = 2 / 3;

describe("footprint glyph pixel grid", () => {
  it("steps one cell to the next by a whole pixel", () => {
    // The pitch is what matters: a cell whose own width is fractional still
    // draws identically to its neighbours as long as every cell shares one
    // phase. It is the VARIATION that is visible, not the softness.
    const glyph = declarationsOf(LIST, ".glyphCell");
    const cell = rem(glyph.width);
    const gap = rem(sides(glyph.margin)[1]);
    const pitch = cell + gap;

    assert.equal((pitch * REM_PX) % 1, 0,
      `glyph pitch ${pitch}rem = ${pitch * REM_PX}px must be a whole pixel`);
    assert.equal((cell * REM_PX) % 1, 0,
      `glyph cell ${cell}rem = ${cell * REM_PX}px must be a whole pixel`);
    // Square cells: a lot glyph is read as a shape, and a non-square cell
    // would make a 4x2 look like a 4x4.
    assert.equal(rem(glyph.height), cell);
  });
});

describe("hover card figures line up", () => {
  it("ends every value on the column's edge instead of after its label", () => {
    // Every value ends on the column's edge instead of after its own label, so
    // there is a column to run an eye down. justify-content, NOT text-align:
    // .cardValue computes to display: flex, which text-align does not reach.
    assert.equal(card(".cardValue")["justify-content"], "flex-end");
    // Grows to reach the edge; never shrinks in a half (see the pairing test).
    assert.equal(card(".cardValue").flex, "1 0 auto");
    // The stacked list opts out: a column of conditions reads down the left,
    // not the right.
    assert.equal(card(".cardValueList")["justify-content"], "flex-start");
  });
});

describe("the extension picker wears the game's panel frame", () => {
  // The picker's rows sit in the slot where vanilla draws a framed Panel. The
  // frame is three of the game's surfaces: the resize strip with the top
  // corners rounded, a dark header square beneath it, and a normal body with
  // the gradient.
  it("gives the header the game's dark surface, square under the resize strip", () => {
    const header = picker(".header");
    assert.equal(header["background-color"], "var(--panelColorDark)");
    assert.equal(header["backdrop-filter"], "var(--panelBlur)");
    // The strip owns the rounding; a rounded header beneath it would stack
    // two curved edges.
    assert.equal(header["border-top-left-radius"], "0");
    assert.equal(header["border-top-right-radius"], "0");
    assert.equal(resize(".resizeHandle")["border-top-left-radius"], "var(--panelRadius)");
    assert.equal(resize(".resizeHandle")["border-top-right-radius"], "var(--panelRadius)");
  });

  it("scrolls its body inside the dragged height rather than growing past it", () => {
    // The cap is stated inline from the shared height; these are what make a
    // flex column honour it. Without min-height: 0 the column will not
    // shrink the body below its rows, and the cap is decorative.
    assert.equal(picker(".content")["min-height"], "0");
    assert.equal(picker(".content")["overflow-y"], "auto");
  });

  it("keeps the game's own body surface until it takes the look", () => {
    // The build menu's body is the look's; the picker takes the look with its own restyle. It has
    // no tab row under its body, so the body rounds the frame's bottom corners itself.
    const body = picker(".content");

    assert.equal(body["background-color"], "var(--panelColorNormal)");
    assert.equal(body["backdrop-filter"], "var(--panelBlur)");
    assert.match(body["background-image"] ?? "", /linear-gradient/);
    assert.equal(body["border-bottom-left-radius"], "var(--panelRadius)");
    assert.equal(body["border-bottom-right-radius"], "var(--panelRadius)");
  });

  it("takes the pointer only where it draws", () => {
    // The tool column lays the root out as tall as the column, so a root that
    // took the pointer swallowed the wheel and every click above the menu.
    assert.equal(picker(".panel")["pointer-events"], "none");
    assert.equal(picker(".panel > *")["pointer-events"], "auto");
  });
});

describe("the hover card's second tier is quieter", () => {
  // Ours sit below a hairline in the dim text colour, one step smaller. The
  // divider and the dimming are the whole message; there is no heading.
  it("dims and shrinks the extra block, and rules it off", () => {
    assert.equal(card(".cardLinesExtra").color, "var(--textColorDim)");
    assert.equal(card(".cardLinesExtra")["font-size"], "var(--fontSizeXS)");
    assert.match(card(".cardDivider")["border-top"], /^1rem solid /);
  });
});

describe("a lone last row keeps its column", () => {
  // Half the row, no growing: an odd count's last row must keep its column
  // rather than stretching across both. Only a stack of values (cardLineWide)
  // may take the whole line.
  it("does not grow a row past half the card", () => {
    assert.equal(card(".cardLine").flex, "0 0 50%");
    assert.equal(card(".cardLineWide").flex, "1 1 100%");
  });
});
