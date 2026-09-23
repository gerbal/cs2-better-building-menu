import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILDING_LENS_MIN_HEIGHT, LENS_RESIZE_HANDLE_HEIGHT } from "../src/domain/buildingLensLayout.ts";
import { declarationsOf, everyDeclaration, moduleSheets, rem, selectorsOf, sides } from "./harness/compiledCss.ts";

/**
 * Stylesheet contracts: layout rules Cohtml gets wrong or the design pins,
 * asserted against the compiled stylesheets. A renderer draws markup, not
 * layout, so no markup assertion can see a heading clipped or a row of tabs
 * sliced.
 */
const CATALOG = "mods/BuildingCatalog/buildingCatalog.module.scss";
const PANE = "mods/LensControlPane/lensControlPane.module.scss";
const SURFACE = "mods/BuildingMenu/buildingMenuSurface.module.scss";
const HEADER = "mods/BuildingMenu/buildingMenuHeader.module.scss";
const GROUPS = "mods/GroupedResults/groupedResults.module.scss";
const CARD = "mods/BuildingHoverCard/buildingHoverCard.module.scss";
const PICKER = "mods/ExtensionMenu/extensionMenu.module.scss";
const RESIZE = "mods/LensResizeHandle/lensResizeHandle.module.scss";
const LIST = "mods/BuildingList/buildingList.module.scss";
const GRID = "mods/BuildingGrid/buildingGrid.module.scss";

const catalog = (selector: string) => declarationsOf(CATALOG, selector);
const pane = (selector: string) => declarationsOf(PANE, selector);
const groups = (selector: string) => declarationsOf(GROUPS, selector);
const card = (selector: string) => declarationsOf(CARD, selector);
const picker = (selector: string) => declarationsOf(PICKER, selector);
const resize = (selector: string) => declarationsOf(RESIZE, selector);

describe("Building Lens stylesheet contracts", () => {
  it("sizes a group to its tiles and lets the heading wrap inside it", () => {
    // The heading wraps to the width the tiles occupy, rather than the tiles
    // being spread to the width the heading wants: reserving label room buys
    // readable headings at the price of mostly-empty groups.
    assert.equal(groups(".group")["min-width"], undefined);
    assert.equal(groups(".groupLabel")["white-space"], "normal");
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

    // NOT absolute. As an overlay on the panel edge it is invisible AND
    // unclickable — the tab strip paints over it whatever z-index it carries.
    // In the flow above the strip it cannot be occluded by it.
    assert.notEqual(strip.position, "absolute");
    // Taller than the mark it draws, so the edge is grabbable without aiming.
    // The strip is drawn at the height a drag measures against.
    assert.equal(rem(strip.height), LENS_RESIZE_HANDLE_HEIGHT);
    const gripHeight = rem(resize(".resizeGrip").height);
    assert.ok(gripHeight > 0 && gripHeight < LENS_RESIZE_HANDLE_HEIGHT, `grip height ${gripHeight}rem`);
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

  it("lets the catalog strip grow rather than slicing a wrapped row of tabs", () => {
    // The strip wraps when its tabs outrun the width left beside the search
    // field. Pinned to a height with overflow: hidden, the second line is cut
    // through the middle; stopping the wrap costs the player five categories.
    const row = declarationsOf(HEADER, ".catalogStripRow");
    const tabs = declarationsOf(HEADER, ".catalogStripTabs");

    assert.ok(row["min-height"], "the row has a floor");
    assert.equal(row.height, undefined);
    assert.notEqual(row.overflow, "hidden");
    assert.notEqual(tabs.overflow, "hidden");
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

  it("lets the pane's text buttons size to their text", () => {
    // The icon variant pins a square width, so any control here carrying text
    // has to override it, or the button sizes to the square and elides the
    // word inside it.
    for (const selector of [".pickerSummary", ".clearAll"]) {
      assert.equal(pane(selector).width, "auto !important", selector);
    }
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
];

describe("the catalog's floor is one row of cards", () => {
  // The player drags the height; the floor is where the drag stops. Three
  // copies exist — the TS clamp, the C# clamp (asserted equal by
  // BuildingLensDimensionTests) and the stylesheet's min-height — and this
  // keeps the third one honest.
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

    assert.equal(BUILDING_LENS_MIN_HEIGHT, catalogPadding + 2 * groupReserve + listPadding + cardHeight);
  });

  it("states the same floor in the stylesheet", () => {
    assert.equal(rem(declarationsOf(SURFACE, ".content")["min-height"]), BUILDING_LENS_MIN_HEIGHT);
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
    assert.equal(card(".cardValue").flex, "1 1 auto");
    // The stacked list opts out: a column of conditions reads down the left,
    // not the right.
    assert.equal(card(".cardValueList")["justify-content"], "flex-start");
  });
});

describe("the extension picker wears the same panel frame as the build menu", () => {
  // The picker's rows sit in the slot where vanilla draws a framed Panel. The
  // frame is three surfaces, the build menu's own: the resize strip with the
  // top corners rounded, a dark header square beneath it, and a normal body
  // with the gradient.
  it("gives the header the top bar's surface, square under the resize strip", () => {
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

  it("gives the body the content surface", () => {
    // The build menu's own body, surface for surface.
    const body = picker(".content");
    const buildMenuBody = declarationsOf(SURFACE, ".content");
    for (const property of ["background-color", "backdrop-filter", "background-image", "border-bottom-left-radius", "border-bottom-right-radius"]) {
      assert.ok(body[property], `the picker's body has no ${property}`);
      assert.equal(body[property], buildMenuBody[property], property);
    }
  });

  it("takes the pointer, as vanilla's Panel does", () => {
    assert.equal(picker(".panel")["pointer-events"], "auto");
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
