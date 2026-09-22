import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Stylesheet contracts: layout rules Cohtml gets wrong or the design pins,
 * asserted against the SCSS as text. A renderer draws markup, not layout, so
 * no markup assertion can see a heading clipped or a row of tabs sliced.
 */
const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");

const buildingCatalogStyles = read("../src/mods/BuildingCatalog/buildingCatalog.module.scss");
const lensControlPaneStyles = read("../src/mods/LensControlPane/lensControlPane.module.scss");
const surfaceStylesFor = () => read("../src/mods/BuildingMenu/buildingMenuSurface.module.scss");
const groupedResultsStyles = read("../src/mods/GroupedResults/groupedResults.module.scss");
const hoverCardStyles = read("../src/mods/BuildingHoverCard/buildingHoverCard.module.scss");
const extensionMenuStyles = read("../src/mods/ExtensionMenu/extensionMenu.module.scss");
const lensResizeHandleStyles = read("../src/mods/LensResizeHandle/lensResizeHandle.module.scss");

describe("Building Lens stylesheet contracts", () => {
  it("sizes a group to its tiles and lets the heading wrap inside it", () => {
    // The heading wraps to the width the tiles occupy, rather than the tiles
    // being spread to the width the heading wants: reserving label room buys
    // readable headings at the price of mostly-empty groups.
    assert.doesNotMatch(groupedResultsStyles, /\.group \{[^}]*min-width:/);
    assert.match(groupedResultsStyles, /\.groupLabel \{[^}]*white-space: normal;/);
    // A band sizes to its content rather than claiming the whole line: one
    // that is wider than the row still fills it, via max-width and its own
    // children wrapping, while a narrow one lets a sibling share the line.
    assert.match(groupedResultsStyles, /\.groupBand \{[^}]*flex: 0 1 auto;/);
    // No heading, no row reserved for one.
    assert.match(groupedResultsStyles, /\.groupUnlabeled \{[^}]*padding-top: 0;/);
  });

  it("keeps the heading out of flow so it cannot widen the group", () => {
    // The whole reason the reserve is measured in JS rather than being the
    // heading's own height: an in-flow heading sets the group's intrinsic
    // width. GroupRow reserves the row's tallest heading instead.
    assert.match(groupedResultsStyles, /\.groupHeading \{[^}]*position: absolute;/);
    // Against a wrapping label the count sits on the first line, not the
    // middle of the stack.
    assert.match(groupedResultsStyles, /\.groupHeading \{[^}]*align-items: flex-start;/);
  });

  it("stops the expanded row's chevron resolving its height against the whole row", () => {
    // .rowDetailsButton sets `height: 100%` so it fills the collapsed row,
    // which has a definite height to resolve against. Expanded, the row is
    // `height: auto` and that percentage resolves against the WRAPPED row.
    const expanded = buildingCatalogStyles.slice(
      buildingCatalogStyles.indexOf('.row[data-expanded="true"] {')
    );
    const block = expanded.slice(0, expanded.indexOf("\n}"));

    assert.match(block, /\.rowDetailsButton \{[^}]*height: auto;/);
    // And the collapsed rule it is overriding must still be the percentage,
    // so this contract keeps pointing at something real.
    assert.match(buildingCatalogStyles, /\.rowDetailsButton \{[^}]*height: 100%;/);
  });

  it("keeps a details label-value pair on one line and wraps it as a unit", () => {
    // A .rowDetail is a flex item in a wrapping row; left free to shrink it
    // narrows to its longest word and the label wraps, and the engine does not
    // grow the line, so the text overflows into what is drawn beneath it.
    const detail = buildingCatalogStyles.slice(buildingCatalogStyles.indexOf("\n.rowDetail {"));
    const block = detail.slice(0, detail.indexOf("\n}"));
    assert.match(block, /flex: 0 0 auto;/);
    assert.match(block, /white-space: nowrap;/);

    const label = buildingCatalogStyles.slice(buildingCatalogStyles.indexOf("\n.rowDetailLabel {"));
    assert.match(label.slice(0, label.indexOf("\n}")), /white-space: nowrap;/);
  });

  it("pairs the hover card's figures two across, and lets a list take the row", () => {
    // The pairing is left to the flow: each row is exactly half and does not
    // grow, so two fit, a third cannot, and only a stack of values takes a
    // whole row.
    assert.match(hoverCardStyles, /\.cardLines \{[^}]*flex-wrap: wrap;/);
    assert.match(hoverCardStyles, /\.cardLine \{[^}]*flex: 0 0 50%;/);
    assert.match(hoverCardStyles, /\.cardLineWide \{[^}]*min-width: 100%;/);
    // Row spacing here is margins, so the stack reads as one column with the
    // container pulling the first row's back off.
    assert.doesNotMatch(hoverCardStyles, /\.cardLines \{[^}]*[^-]gap:/);
    assert.match(hoverCardStyles, /\.cardLines \{[^}]*margin-top: -2rem;/);
  });

  it("keeps the trailing reserve and the name budget agreeing", () => {
    // buildingCatalog.module.scss is the authority for what a row reserves to
    // the right of its name, and buildingLensLayout mirrors it so the name can
    // be elided to fit. A control dropped from one mis-sizes every name.
    assert.match(buildingCatalogStyles, /\$table-trailing-reserve: \$row-padding-right \+ \$row-details-width \+ \$row-outer-padding-right \+ \$row-gap;/);
    assert.match(buildingCatalogStyles, /\$row-details-width: 26rem;/);
    assert.doesNotMatch(buildingCatalogStyles, /\$row-place-width/, "Place is the row now; its reserve is gone");
  });

  it("spaces the header's columns as the rows space their cells", () => {
    // .columnHeader > * + * gives each header the rows' gap, and .metricHeader's
    // button-chrome reset (`margin: 0`, same specificity, later) takes it
    // straight back, stepping every header left of the cells it heads.
    const block = buildingCatalogStyles.match(/\.metricHeader \{([\s\S]*?)\n\}/);
    assert.ok(block, ".metricHeader block");
    assert.doesNotMatch(block![1], /\n\s*margin: 0;/, "margin: 0 discards the column gap");
    assert.match(block![1], /margin: 0 0 0 \$row-gap;/);
  });

  it("makes the row Place hint visible for hover and keyboard focus", () => {
    assert.match(buildingCatalogStyles, /\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:hover[^\{]*\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:focus[^\{]*\.placeHint/);
  });

  it("gives the height drag a target worth aiming at", () => {
    // The only way to change the height now that the Expand toggle is gone, so
    // it has to be both findable and hittable. The strip is the target and the
    // grip is the mark, which is why they are two elements.
    // Shared by the build menu and the extension picker, so it lives in its
    // own module rather than in either panel's.
    const strip = lensResizeHandleStyles.match(/\.resizeHandle\s*\{[^}]*\}/)?.[0] ?? "";
    const grip = lensResizeHandleStyles.match(/\.resizeGrip\s*\{[^}]*\}/)?.[0] ?? "";

    // NOT absolute. As an overlay on the panel edge it is invisible AND
    // unclickable — the tab strip paints over it whatever z-index it carries.
    // In the flow above the strip it cannot be occluded by it.
    assert.doesNotMatch(strip, /position:\s*absolute/);
    // Taller than the mark it draws, so the edge is grabbable without aiming.
    assert.match(strip, /height:\s*14rem/);
  });

  it("announces the drag the way the game does: its cursors, its thumb's weight", () => {
    // The game draws its own cursors and maps none of the CSS keywords past
    // default/pointer/none: `ns-resize` shows NOTHING on hover, so the edge
    // never announced itself. vertical-can-resize is what vanilla's own
    // draggable value fields show, and vertical-resize is what they show
    // mid-drag.
    const strip = lensResizeHandleStyles.match(/\.resizeHandle\s*\{[^}]*\}/)?.[0] ?? "";
    const blocker = lensResizeHandleStyles.match(/\.resizeBlocker\s*\{[^}]*\}/)?.[0] ?? "";
    const grip = lensResizeHandleStyles.match(/\.resizeGrip\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(strip, /cursor: url\(cursor:\/\/vertical-can-resize\);/);
    assert.match(blocker, /cursor: url\(cursor:\/\/vertical-resize\);/);
    assert.doesNotMatch(lensResizeHandleStyles, /cursor:\s*ns-resize/);
    // At rest the pill weighs what the game's scrollbar thumb weighs, so it
    // reads as a thing to grab rather than a texture of the chrome.
    assert.match(grip, /background-color: rgba\(var\(--scrollbarColor\), 0\.6\);/);
    // A short bar on the edge. Anything wider is a border between two regions,
    // and rem and px differ here, so a smaller number draws a thinner mark.
    assert.match(grip, /height:\s*8rem/);
    assert.match(grip, /width:\s*75rem/);
  });

  it("lets the catalog strip grow rather than slicing a wrapped row of tabs", () => {
    // The strip wraps when its tabs outrun the width left beside the search
    // field. Pinned to a height with overflow: hidden, the second line is cut
    // through the middle; stopping the wrap costs the player five categories.
    const headerStyles = readFileSync(
      new URL("../src/mods/BuildingMenu/buildingMenuHeader.module.scss", import.meta.url),
      "utf8"
    );
    const row = headerStyles.match(/\.catalogStripRow\s*\{[^}]*\}/)?.[0] ?? "";
    const tabs = headerStyles.match(/\.catalogStripTabs\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(row, /min-height:/);
    assert.doesNotMatch(row, /^\s*height:/m);
    assert.doesNotMatch(row, /overflow:\s*hidden/);
    assert.doesNotMatch(tabs, /overflow:\s*hidden/);
  });

  it("matches the vanilla options bank it sits opposite", () => {
    // Read off the live tool-options bank rather than eyeballed: rows are
    // padding 4rem 12rem with no min-height, and labels are bold 16rem. Both
    // banks are on screen together, so any drift between them shows.
    const row = lensControlPaneStyles.match(/\.row\s*\{[^}]*\}/)?.[0] ?? "";
    const label = lensControlPaneStyles.match(/\.rowLabel\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(row, /padding:\s*4rem 12rem/);
    assert.match(label, /font-weight:\s*bold/);
    assert.match(label, /font-size:\s*16rem/);
  });

  it("lets the pane's text buttons size to their text", () => {
    // The icon variant pins a square width, so any control here carrying text
    // has to override it, or the button sizes to the square and elides the
    // word inside it.
    for (const rule of [
      /\.pickerSummary\s*\{[^}]*width:\s*auto\s*!important/,
      /\.clearAll\s*\{[^}]*width:\s*auto\s*!important/,
    ]) {
      assert.match(lensControlPaneStyles, rule);
    }
  });

  it("opens the pane's menus upward, away from the bottom bar", () => {
    // The pane is bottom-aligned against the bottom bar, so a menu growing
    // downward opens off the screen.
    assert.match(lensControlPaneStyles, /\.pickerOptions\s*\{[^}]*bottom:/);
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
const UNSUPPORTED: { pattern: RegExp; declaration: string; why: string }[] = [
  {
    pattern: /align-(?:items|self):\s*baseline/g,
    declaration: "align-items / align-self: baseline",
    why:
      "Cohtml logs `Unable to parse declaration: align-items - baseline` and drops it, "
      + "leaving the flex default. Use flex-start, which is what it degrades to anyway.",
  },
  {
    pattern: /display:\s*(?:inline-)?grid\b/g,
    declaration: "display: grid",
    why: "Cohtml has no CSS grid (still absent on 2.2.1.3). Lay it out with flex.",
  },
  {
    pattern: /(?:^|[\s;{])object-fit:/gm,
    declaration: "object-fit",
    why: "Never implemented in Cohtml (no changelog row through 3.1; the parser rejects it). Size the picture's box instead.",
  },
];

const scssFiles = (): string[] =>
  readdirSync(new URL("../src/", import.meta.url), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".scss"))
    .map((name) => `../src/${name}`);

describe("a wrapping row of cards keeps each card its own height", () => {
  // Cohtml sizes a wrapping flex container for all its lines, then stretches
  // the FIRST line's items to the whole container rather than the line: two
  // cards grow to two rows' height and the third lands below the box, where
  // the group's overflow clips it. A heading then says 3 over 2 visible cards.
  // Only cards can grow — the compact row states its height — but the rule
  // belongs on the container, which both share.
  it("does not let a wrapped line stretch its items", () => {
    const list = read("../src/mods/BuildingList/buildingList.module.scss").match(/\.list \{[^}]*\}/)?.[0] ?? "";

    assert.match(list, /flex-wrap: wrap;/);
    assert.match(list, /align-items: flex-start;/);
  });

  it("spaces the cards with gap, not a negative gutter", () => {
    // A group is sized to the list's max-content. With the negative-margin
    // gutter, Cohtml computed that max-content without the margins and then
    // laid the cards out with them, so a row that fit its group by
    // construction wrapped its last card on a tenth of a pixel. gap is part
    // of the max-content, so the cards fit the group they sized.
    const source = read("../src/mods/BuildingList/buildingList.module.scss");
    const list = source.match(/\.list \{[^}]*\}/)?.[0] ?? "";

    assert.match(list, /\n\s*gap: 4rem;/);
    assert.doesNotMatch(list, /margin-left: -/);
    assert.doesNotMatch(list, /margin-top: -/);
    assert.doesNotMatch(source, /\.list::after/);
  });

  it("spaces the grid's tiles with gap, for the same reason", () => {
    // Two tiles in a group sized for two stacked into a column, three went
    // two and one, while five fit their row: the same zero-slack rounding,
    // flipping per group.
    const tiles = read("../src/mods/BuildingGrid/buildingGrid.module.scss").match(/\.tiles \{[^}]*\}/)?.[0] ?? "";

    assert.match(tiles, /\n\s*gap: 4rem;/);
    assert.doesNotMatch(tiles, /margin-left: -/);
    assert.doesNotMatch(tiles, /margin-top: -/);
  });
});

describe("Cohtml stylesheet support", () => {
  it("states no declaration the engine silently drops", () => {
    // Catching it here turns a silent log warning into a build failure.
    const found: string[] = [];

    for (const relative of scssFiles()) {
      const source = read(relative);
      const lines = source.split("\n");

      for (const { pattern, declaration, why } of UNSUPPORTED) {
        lines.forEach((line, i) => {
          // Comments describe these rules on purpose — this file and several
          // stylesheets explain why each is avoided. Only real declarations count.
          const code = line.replace(/\/\/.*$/, "");
          pattern.lastIndex = 0;
          if (pattern.test(code)) {
            found.push(`${relative.replace("../", "")}:${i + 1}  ${declaration} — ${why}`);
          }
        });
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
const remOf = (source: string, rule: string, property: string): number => {
  const body = new RegExp(`\\.${rule} \\{([^}]*)\\}`).exec(source);
  assert.ok(body, `${rule} not found`);
  const found = new RegExp(`(?:^|[\\s;])${property}:\\s*([0-9.]+)rem`, "m").exec(body![1]);
  assert.ok(found, `${rule} has no ${property}`);
  return Number(found![1]);
};

describe("footprint glyph pixel grid", () => {
  it("steps one cell to the next by a whole pixel", () => {
    // The pitch is what matters: a cell whose own width is fractional still
    // draws identically to its neighbours as long as every cell shares one
    // phase. It is the VARIATION that is visible, not the softness.
    const styles = read("../src/mods/BuildingList/buildingList.module.scss");
    const cell = remOf(styles, "glyphCell", "width");
    const gap = Number(/\.glyphCell \{[^}]*margin:\s*0\s+([0-9.]+)rem/.exec(styles)![1]);
    const pitch = cell + gap;

    assert.equal((pitch * REM_PX) % 1, 0,
      `glyph pitch ${pitch}rem = ${pitch * REM_PX}px must be a whole pixel`);
    assert.equal((cell * REM_PX) % 1, 0,
      `glyph cell ${cell}rem = ${cell * REM_PX}px must be a whole pixel`);
    // Square cells: a lot glyph is read as a shape, and a non-square cell
    // would make a 4x2 look like a 4x4.
    assert.equal(remOf(styles, "glyphCell", "height"), cell);
  });
});

describe("hover card figures line up", () => {
  it("ends every value on the column's edge instead of after its label", () => {
    // Every value ends on the column's edge instead of after its own label, so
    // there is a column to run an eye down. justify-content, NOT text-align:
    // .cardValue computes to display: flex, which text-align does not reach.
    assert.match(hoverCardStyles, /\.cardValue \{[^}]*justify-content: flex-end;/);
    assert.match(hoverCardStyles, /\.cardValue \{[^}]*flex: 1 1 auto;/);
    // The stacked list opts out: a column of conditions reads down the left,
    // not the right.
    assert.match(hoverCardStyles, /\.cardValueList \{[^}]*justify-content: flex-start;/);
  });
});

describe("the extension picker wears the same panel frame as the build menu", () => {
  // The picker's rows sit in the slot where vanilla draws a framed Panel. The
  // frame is three surfaces, the build menu's own: the resize strip with the
  // top corners rounded, a dark header square beneath it, and a normal body
  // with the gradient.
  it("gives the header the top bar's surface, square under the resize strip", () => {
    assert.match(extensionMenuStyles, /\.header \{[^}]*background-color: var\(--panelColorDark\);/);
    assert.match(extensionMenuStyles, /\.header \{[^}]*backdrop-filter: var\(--panelBlur\);/);
    // The strip owns the rounding; a rounded header beneath it would stack
    // two curved edges.
    assert.match(extensionMenuStyles, /\.header \{[^}]*border-top-left-radius: 0;/);
    assert.match(extensionMenuStyles, /\.header \{[^}]*border-top-right-radius: 0;/);
    assert.match(lensResizeHandleStyles, /\.resizeHandle \{[^}]*border-top-left-radius: var\(--panelRadius\);/);
    assert.match(lensResizeHandleStyles, /\.resizeHandle \{[^}]*border-top-right-radius: var\(--panelRadius\);/);
  });

  it("scrolls its body inside the dragged height rather than growing past it", () => {
    // The cap is stated inline from the shared height; these are what make a
    // flex column honour it. Without min-height: 0 the column will not
    // shrink the body below its rows, and the cap is decorative.
    assert.match(extensionMenuStyles, /\.content \{[^}]*min-height: 0;/);
    assert.match(extensionMenuStyles, /\.content \{[^}]*overflow-y: auto;/);
  });

  it("gives the body the content surface", () => {
    assert.match(extensionMenuStyles, /\.content \{[^}]*background-color: var\(--panelColorNormal\);/);
    assert.match(extensionMenuStyles, /\.content \{[^}]*backdrop-filter: var\(--panelBlur\);/);
    assert.match(extensionMenuStyles, /\.content \{[^}]*background-image: linear-gradient\(/);
    assert.match(extensionMenuStyles, /\.content \{[^}]*border-bottom-left-radius: var\(--panelRadius\);/);
    assert.match(extensionMenuStyles, /\.content \{[^}]*border-bottom-right-radius: var\(--panelRadius\);/);
  });

  it("takes the pointer, as vanilla's Panel does", () => {
    assert.match(extensionMenuStyles, /\.panel \{[^}]*pointer-events: auto;/);
  });
});

describe("the hover card's second tier is quieter", () => {
  // Ours sit below a hairline in the dim text colour, one step smaller. The
  // divider and the dimming are the whole message; there is no heading.
  it("dims and shrinks the extra block, and rules it off", () => {
    assert.match(hoverCardStyles, /\.cardLinesExtra \{[^}]*color: var\(--textColorDim\);/);
    assert.match(hoverCardStyles, /\.cardLinesExtra \{[^}]*font-size: var\(--fontSizeXS\);/);
    assert.match(hoverCardStyles, /\.cardDivider \{[^}]*border-top: 1rem solid/);
  });
});

describe("a lone last row keeps its column", () => {
  // Half the row, no growing: an odd count's last row must keep its column
  // rather than stretching across both. Only a stack of values (cardLineWide)
  // may take the whole line.
  it("does not grow a row past half the card", () => {
    assert.match(hoverCardStyles, /\.cardLine \{[^}]*flex: 0 0 50%;/);
    assert.doesNotMatch(hoverCardStyles, /\.cardLine \{[^}]*flex: 1 1 auto;/);
    assert.match(hoverCardStyles, /\.cardLineWide \{[^}]*flex: 1 1 100%;/);
  });
});
