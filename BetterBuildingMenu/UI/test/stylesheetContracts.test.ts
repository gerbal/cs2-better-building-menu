import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Stylesheet contracts: layout rules Cohtml gets wrong or the design pins,
 * asserted against the SCSS as text.
 *
 * These read source on purpose. A renderer draws markup, not layout, and
 * every rule here exists because a live game drew something wrong — a
 * heading clipped, a drag target too thin, a row of tabs sliced — that no
 * markup assertion could see. They moved here from buildingLensUx.test.ts,
 * which now holds only behaviour tests; see scrollContainerContracts.test.ts
 * and uniqueMarkScale.test.ts for the same pattern.
 */
const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");

const buildingCatalogStyles = read("../src/mods/BuildingCatalog/buildingCatalog.module.scss");
const lensControlPaneStyles = read("../src/mods/LensControlPane/lensControlPane.module.scss");
const surfaceStylesFor = () => read("../src/mods/BuildingMenu/buildingMenuSurface.module.scss");
const groupedResultsStyles = read("../src/mods/GroupedResults/groupedResults.module.scss");
const hoverCardStyles = read("../src/mods/BuildingHoverCard/buildingHoverCard.module.scss");

describe("Building Lens stylesheet contracts", () => {
  it("sizes a group to its tiles and lets the heading wrap inside it", () => {
    // SUPERSEDES "three tiles of label room". That reservation existed so a
    // one-tile group's name was not cut to "ROAD SER…", and it bought readable
    // headings with empty row: measured in Fire & Rescue, six nested groups
    // were each 200px around a single 67px tile, two thirds of every group
    // nothing at all. The heading now wraps to the width the tiles occupy
    // rather than the tiles being spread to the width the heading wanted.
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
    // width, which is what made CENTRAL INTELLIGENCE BUREAU a 177px group
    // around one 72px tile. GroupRow reserves the row's tallest heading.
    assert.match(groupedResultsStyles, /\.groupHeading \{[^}]*position: absolute;/);
    // Against a wrapping label the count sits on the first line, not the
    // middle of the stack.
    assert.match(groupedResultsStyles, /\.groupHeading \{[^}]*align-items: flex-start;/);
  });

  it("stops the expanded row's chevron resolving its height against the whole row", () => {
    // .rowDetailsButton sets `height: 100%` so it fills the collapsed row,
    // which has a definite 92rem to resolve against. The expanded row is
    // `height: auto`, so that percentage resolved against the WRAPPED row
    // instead of line one: measured live on Alley, the button rendered 109
    // tall beside a 59-tall .rowSelect, putting the row's content at 160 while
    // the row settled at 109. `.row` is overflow: hidden, so the details block
    // was laid out complete and then clipped away whole — the row grew taller
    // and showed nothing.
    //
    // The expanded block must neutralise it. `align-self: stretch` already
    // fills the line in both states without a percentage.
    const expanded = buildingCatalogStyles.slice(
      buildingCatalogStyles.indexOf('.row[data-expanded="true"] {')
    );
    const block = expanded.slice(0, expanded.indexOf("\n}"));

    assert.match(block, /\.rowDetailsButton \{[^}]*height: auto;/);
    // And the collapsed rule it is overriding must still be the percentage,
    // so this contract keeps pointing at something real.
    assert.match(buildingCatalogStyles, /\.rowDetailsButton \{[^}]*height: 100%;/);
  });

  it("pairs the hover card's figures two across, and lets a list take the row", () => {
    // Measured on a zone card: six label/value pairs, each on its own 215px row
    // using about fifty of it. The pairing is left to the flow — min-width just
    // under half means two fit and a third cannot — so a long line still takes
    // a whole row without a rule predicting which lines are long.
    assert.match(hoverCardStyles, /\.cardLines \{[^}]*flex-wrap: wrap;/);
    assert.match(hoverCardStyles, /\.cardLine \{[^}]*min-width: 45%;/);
    assert.match(hoverCardStyles, /\.cardLineWide \{[^}]*min-width: 100%;/);
    // gap is a no-op in this engine, so row spacing is margins with the
    // container pulling the first row's back off.
    assert.doesNotMatch(hoverCardStyles, /\.cardLines \{[^}]*[^-]gap:/);
    assert.match(hoverCardStyles, /\.cardLines \{[^}]*margin-top: -2rem;/);
  });

  it("keeps the trailing reserve and the name budget agreeing", () => {
    // buildingCatalog.module.scss is the authority for what a row reserves to
    // the right of its name, and buildingLensLayout mirrors it so the name can
    // be elided to fit. They drifted once already; a control removed from one
    // and not the other silently mis-sizes every name in the table.
    assert.match(buildingCatalogStyles, /\$table-trailing-reserve: \$row-padding-right \+ \$row-details-width \+ \$row-outer-padding-right;/);
    assert.match(buildingCatalogStyles, /\$row-details-width: 26rem;/);
    assert.doesNotMatch(buildingCatalogStyles, /\$row-place-width/, "Place is the row now; its reserve is gone");
  });

  it("makes the row Place hint visible for hover and keyboard focus", () => {
    assert.match(buildingCatalogStyles, /\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:hover[^\{]*\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:focus[^\{]*\.placeHint/);
  });

  it("gives the height drag a target worth aiming at", () => {
    // The only way to change the height now that the Expand toggle is gone, so
    // it has to be both findable and hittable. Measured at 40x5px on the first
    // attempt: a 5px-tall grab target, at 25% white on a dark panel.
    //
    // The strip is the target and the grip is the mark, which is why they are
    // two elements — a bar sized to be easy to hit would be a bar too heavy to
    // sit on the panel edge.
    const strip = surfaceStylesFor().match(/\.resizeHandle\s*\{[^}]*\}/)?.[0] ?? "";
    const grip = surfaceStylesFor().match(/\.resizeGrip\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(strip, /cursor:\s*ns-resize/);
    // NOT absolute. As an overlay on the panel edge it was invisible and
    // unclickable — measured with elementFromPoint at the grip's own centre,
    // the hit went to a subcategory tab, because the tab strip paints over it
    // whatever z-index it carries. In the flow above the strip it cannot be
    // occluded by it.
    assert.doesNotMatch(strip, /position:\s*absolute/);
    // Taller than the mark it draws, so the edge is grabbable without aiming.
    assert.match(strip, /height:\s*14rem/);
    // A short bar on the edge. Anything wider is a border between two regions.
    // 8rem, because 1rem is 0.6667px: a 5px grip is 8rem, and 5rem draws 3px.
    // Written as 5rem the first time — the fourth px/rem slip on this branch.
    assert.match(grip, /height:\s*8rem/);
    assert.match(grip, /width:\s*75rem/);
  });

  it("lets the catalog strip grow rather than slicing a wrapped row of tabs", () => {
    // Measured on Roads & Networks at the narrowed panel width: 20 subcategory
    // tabs, which do not fit the 424px left beside the search field, so the
    // strip wraps. With the row pinned to height: 45rem and overflow: hidden,
    // the second line was cut through the middle — tops at y=89 and y=110, the
    // row ending at y=126 while the lower icons ran to y=132.
    //
    // The fix must not be to stop the wrap: that draws cleanly and silently
    // costs the player five categories. So the row sizes to its content, and
    // the tab container does not clip.
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
    // padding 4rem 12rem with no min-height, and labels are bold 16rem. Ours
    // had drifted on all three, which is visible the moment both banks are on
    // screen together — and they always are.
    const row = lensControlPaneStyles.match(/\.row\s*\{[^}]*\}/)?.[0] ?? "";
    const label = lensControlPaneStyles.match(/\.rowLabel\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(row, /padding:\s*4rem 12rem/);
    assert.match(label, /font-weight:\s*bold/);
    assert.match(label, /font-size:\s*16rem/);
  });

  it("lets the pane's text buttons size to their text", () => {
    // The icon variant pins a square width, so any control here carrying text
    // has to override it. Measured live when one did not: a button 16px wide
    // around 33px of text, drawing "Shrink Panel" as "S…l".
    //
    // .heightToggle was the third of these and is gone with the Expand control
    // it operated; .clearAll came in with the filter chips and needs the same
    // override for the same reason. .panelButton was the fourth and went with
    // the panel-level control row — see "draws no panel-level controls of its
    // own"; the rule it needed went with it rather than being left behind as a
    // style for nothing.
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
