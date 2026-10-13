import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ASSET_MENU_MIN_HEIGHT, ASSET_MENU_RESIZE_HANDLE_HEIGHT, NOTCH_TOP_WIDTH, TAB_CELL_MIN_WIDTH, TAB_CELL_PADDING } from "../src/domain/assetMenuLayout.ts";
import { cardGeometry } from "../src/domain/cardsLayout.ts";
import { READOUT_GLYPH, READOUT_GLYPH_GAP, READOUT_SEP_PADDING } from "../src/domain/tabRow.ts";
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
const LABELS = "mods/Bodies/labelPlate.module.scss";
const CARDS = "mods/Bodies/cardsBody.module.scss";
const CARD = "mods/BuildingHoverCard/buildingHoverCard.module.scss";
const PICKER = "mods/ExtensionMenu/extensionMenu.module.scss";
const RESIZE = "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
const LIST = "mods/BuildingList/buildingList.module.scss";
const TILES = "mods/Bodies/tilesBody.module.scss";
const TAB_ROW = "mods/TabRow/tabRow.module.scss";
const LIST_BODY = "mods/Bodies/listBody.module.scss";
const FILTER_PANEL = "mods/Pickers/filterPanel.module.scss";
const PICKER_LIST = "mods/Pickers/pickerList.module.scss";
const POPOVER = "mods/ControlPopover/controlPopover.module.scss";
const PLANNED = "mods/Bodies/plannedName.module.scss";

const catalog = (selector: string) => declarationsOf(CATALOG, selector);
const pane = (selector: string) => declarationsOf(PANE, selector);
const labels = (selector: string) => declarationsOf(LABELS, selector);
const cards = (selector: string) => declarationsOf(CARDS, selector);
const card = (selector: string) => declarationsOf(CARD, selector);
const picker = (selector: string) => declarationsOf(PICKER, selector);
const resize = (selector: string) => declarationsOf(RESIZE, selector);

describe("Asset menu stylesheet contracts", () => {
  it("keeps a label plate's name to its slot, on one line, and never cuts its count", () => {
    // The slot is the plate's size, so a long name is planned inside it rather than widening it;
    // the count says how many the label holds, so it gives way last.
    assert.equal(declarationsOf(PLANNED, ".line")["white-space"], "nowrap");
    assert.equal(labels(".labelText").overflow, "hidden");
    assert.equal(labels(".labelCount").flex, "0 0 auto");
    assert.equal(labels(".label").overflow, "hidden");
  });

  it("keeps each card's name and facts on one line each, inside the card", () => {
    // The packer sizes each card from these two lines, so a second line would draw past it.
    assert.equal(cards(".name")["white-space"], "nowrap");
    assert.equal(cards(".facts")["white-space"], "nowrap");
    assert.equal(cards(".card").overflow, "hidden");
    assert.equal(cards(".card")["box-sizing"], "border-box");
  });

  it("gives a held card's planned name the width of the card's words, whatever its lines hold", () => {
    // The name is planned again in the box as drawn: a box that hugged its lines would narrow it each frame.
    assert.equal(cards(".nameHeld")["align-self"], "stretch");
    assert.equal(cards(".nameHeld").overflow, "hidden");
  });

  it("lets every body's scroller fill the body and no more, and the body shrink below its content", () => {
    // A scroller with no cap outgrows the box, and a body that cannot shrink lays its rows out
    // below the screen, present in the DOM and never drawn.
    for (const sheet of ["mods/Bodies/listBody.module.scss", "mods/Bodies/tilesBody.module.scss", CARDS]) {
      assert.equal(declarationsOf(sheet, ".body")["min-height"], "0", sheet);
      // A zero basis resolves against nothing in the catalog, whose height is a cap: no height at all.
      assert.doesNotMatch(declarationsOf(sheet, ".body").flex, /(^|\s)0(px|rem)?\s*$/, sheet);
      assert.equal(declarationsOf(sheet, ".scroller.scroller")["max-height"], "100%", sheet);
    }
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

  it("rings the search field in the focus ring while it has the keys, and in its plain ring otherwise", () => {
    // A compound class from the TextInput's own focus: Cohtml has no :focus to lean on here, and no outline.
    assert.equal(declarationsOf(TOP_ROW, ".field")["box-shadow"], "var(--bbm-fieldRing)");
    assert.equal(declarationsOf(TOP_ROW, ".field.focused")["box-shadow"], "var(--bbm-focusRing)");
  });

  it("hangs the notch under the box's bottom edge, a trapezoid of border longhands that takes no presses", () => {
    const notch = declarationsOf("mods/Notch/notch.module.scss", ".notch");

    assert.equal(notch.position, "absolute");
    assert.equal(notch.top, "100%");
    assert.equal(notch["pointer-events"], "none");
    // Cohtml sizes every box border-box, so the width is the drawn top, the side borders inside it:
    // the foot is what is left between them, 4 tall, in the look's notch.
    assert.equal(notch["box-sizing"], "border-box");
    assert.ok(Math.abs(rem(notch.width) - NOTCH_TOP_WIDTH) < 1e-9, "the width is the top notch.ts places");
    assert.ok(Math.abs(rem(notch.width) - 2 * rem(notch["border-left-width"]) - 26.4) < 1e-9, "the foot is what the borders leave");
    assert.equal(notch["border-right-width"], notch["border-left-width"]);
    assert.equal(notch["border-top-width"], "4rem");
    assert.equal(notch["border-top-color"], "var(--bbm-notch)");
    assert.equal(notch["border-left-color"], "transparent");
    assert.equal(notch["border-right-color"], "transparent");
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

  it("draws a one-line plate's key number in the cost's place in the key number's ink", () => {
    // Where the readout said the cost, the key number moves to the first line; it keeps its own ink, as
    // on the armed and the built plate.
    const ink = (...plate: string[]) => resolvedOn(LIST_BODY, [["plate", ...plate], ["numbers"], ["firstLine"], ["first", "keyNumber"]], "color");

    assert.equal(ink(), resolvedOn(LIST_BODY, [["plate"], ["numbers"], ["secondLine"], ["second"]], "color"));
    assert.equal(ink(), "var(--bbm-tNum2)");
    assert.equal(ink("armed"), "var(--bbm-armNum)");
    assert.equal(ink("built"), "var(--bbm-tLocked)");
  });

  it("sizes the readout's legend as the tab row's plan counts it", () => {
    // planTabRow budgets the legend from these: a glyph that scales with the text, a fixed gap to its
    // words, a fixed room each side of the dot, and the words and the dot in the range's font.
    const glyph = declarationsOf(TAB_ROW, ".saidGlyph");
    const [, right, , left] = sides(declarationsOf(TAB_ROW, ".sep").padding);
    const range = declarationsOf(TAB_ROW, ".range")["font-size"];

    assert.equal(glyph.width, `calc(${READOUT_GLYPH}rem * var(--fontScale))`);
    assert.equal(glyph.height, glyph.width);
    assert.equal(rem(declarationsOf(TAB_ROW, ".said").gap), READOUT_GLYPH_GAP);
    assert.deepEqual([rem(right), rem(left)], [READOUT_SEP_PADDING, READOUT_SEP_PADDING]);
    assert.equal(declarationsOf(TAB_ROW, ".saidText")["font-size"], range);
    assert.equal(declarationsOf(TAB_ROW, ".sep")["font-size"], range);
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
    matches: (prop, value) => prop === "box-sizing" && value === "content-box",
    declaration: "box-sizing: content-box",
    why:
      "Cohtml 2.2 has no content-box: it sizes every box border-box, so a width meant as the content's "
      + "draws that much narrower by the padding and borders. Size the box as border-box.",
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
  it("is a floor guard: it holds a row of the tallest card and a line of the shipped tiles, every body placing its own cells", () => {
    // The catalog adds nothing around a body; the floor holds one row of the Card height knob's
    // taller 50 rem cards, and one line of 64 rem tiles. The next case holds the sheet to the floor.
    assert.equal(catalog(".catalog").padding, "0");
    assert.ok(cardGeometry(50, ASSET_MENU_MIN_HEIGHT, 1).height <= ASSET_MENU_MIN_HEIGHT, `${ASSET_MENU_MIN_HEIGHT}`);
    assert.ok(64 <= ASSET_MENU_MIN_HEIGHT, `${ASSET_MENU_MIN_HEIGHT}`);
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

});

describe("a tile's tag and name line are the sizes the UI budgets them at", () => {
  it("draws the tag in the font and padding tileTag.ts measures it by, clipped where it still runs over", () => {
    const tag = declarationsOf(TILES, ".tag");

    assert.equal(tag["font-size"], "calc(10rem * var(--fontScale))");
    assert.equal(tag.padding, "0 3rem");
    assert.equal(tag.left, "2rem");
    assert.equal(tag["box-sizing"], "border-box");
    assert.equal(tag.overflow, "hidden");
    assert.equal(tag["white-space"], "nowrap");
  });

  it("draws the name line's name in the font TilesBody budgets its characters by", () => {
    assert.equal(declarationsOf(TILES, ".lineName")["font-size"], "calc(11rem * var(--fontScale))");
  });
});

describe("a planned name's boxes", () => {
  /** The game's Overpass draws its ascent and descent within this many em, as Chromium reports its content area. */
  const ASCENT_AND_DESCENT = 1.3;
  const em = (value: string | undefined) => Number(/^(-?[\d.]+)em$/.exec(value ?? "")?.[1]);
  /** The N of a calc(N rem * var(--fontScale)). */
  const scaled = (value: string | undefined) => rem(/^calc\(([\d.]+rem) \* var\(--fontScale\)\)$/.exec(value ?? "")?.[1]);

  it("clip across but never an accent or a descender: each is tall enough for the font, its pitch unchanged", () => {
    for (const selector of [".planned", ".line"]) {
      const box = declarationsOf(PLANNED, selector);
      const room = em(box["padding-top"]);

      assert.equal(box.overflow, "hidden", selector);
      assert.equal(em(box["padding-bottom"]), room, selector);
      assert.deepEqual([em(box["margin-top"]), em(box["margin-bottom"])], [-room, -room], selector);

      // Every line-height a planned name draws at, against its font: the list's names and the labels' caps.
      for (const [sheet, rule] of [[LIST_BODY, ".name"], [LABELS, ".label"]]) {
        const drawn = declarationsOf(sheet, rule);
        const pitch = scaled(drawn["line-height"]) / scaled(drawn["font-size"]);
        assert.ok(pitch + 2 * room >= ASCENT_AND_DESCENT, `${selector} in ${sheet} ${rule}: ${pitch} + 2 × ${room}`);
      }
    }
  });
});

describe("Cohtml stylesheet support", () => {
  it("cuts no text in the bodies with a CSS ellipsis, which Cohtml never draws", () => {
    // A guard: Cohtml computes an inline-block as flex and ignores text-overflow on a flex item, so a
    // CSS ellipsis only clips. Every name in the bodies is cut by the planner, with "…" in its text.
    const found = moduleSheets()
      .filter((sheet) => sheet.startsWith("mods/Bodies/"))
      .flatMap((sheet) => everyDeclaration(sheet)
        .filter(({ prop }) => prop === "text-overflow")
        .map(({ selectors, value }) => `${sheet} ${selectors.join(", ")}  text-overflow: ${value}`));

    assert.deepEqual(found, []);
  });

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
