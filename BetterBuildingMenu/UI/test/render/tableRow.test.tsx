import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderHtml, entry } from "../harness/render";
import { TableRow, type TableRowProps } from "../../src/mods/BuildingCatalog/TableRow";

const labels = { place: "Place", inspect: "Details", locked: "Locked", built: "Already built" };

const row = (over: Partial<TableRowProps> = {}) =>
  renderHtml(
    <TableRow
      entry={entry(7, { name: "Clinic" })}
      expanded={false}
      nameBudget={40}
      separators={{ thousands: ",", decimal: "." } as never}
      labels={labels}
      columnStyle={() => ({})}
      resolveFacetLabel={() => null}
      onPlace={() => {}}
      onToggleExpanded={() => {}}
      {...over}
    />
  );

describe("a table row", () => {
  it("makes the row itself the Place control", () => {
    // A click in Grid, List and Cards arms the tool, and the table matches it.
    const html = row();

    assert.match(html, /<button class="rowSelect"[^>]*aria-label="Place: Clinic"/);
    assert.match(html, /<button class="rowSelect"[^>]*data-has-select="true"/);
    assert.doesNotMatch(html, /<button class="rowSelect"[^>]*data-refused/);
  });

  it("does not disable an unplaceable row, because that would take its hover card too", () => {
    // The hover card is where a locked building explains what it is waiting
    // for, so the refusal is named in the label and the button stays live.
    const html = row({ entry: entry(7, { name: "Clinic", isLocked: true }) });

    assert.match(html, /aria-label="Place: Clinic — Locked"/);
    assert.match(html, /<button class="rowSelect"[^>]*data-refused="true"/);
    assert.doesNotMatch(html, /<button class="rowSelect"[^>]*disabled/);
    assert.match(html, /data-locked="true"/);
  });

  it("names a unique the city already holds as already built", () => {
    const html = row({ entry: entry(7, { name: "Clinic", isUnique: true, isAlreadyBuilt: true }) });

    assert.match(html, /aria-label="Place: Clinic — Already built"/);
    assert.match(html, /data-already-built="true"/);
  });

  it("gives expanding a row its own control", () => {
    // It used to be the whole row, which taught two verbs for one gesture.
    const html = row();

    assert.match(html, /<button class="rowDetailsButton"[^>]*aria-label="Details: Clinic"/);
    assert.doesNotMatch(html, /rowDetailsButtonOpen/);
    assert.doesNotMatch(html, /class="rowDetails"/);
  });

  it("renders the details, with the upgrades the building supports, when expanded", () => {
    // supportedUpgrades, never extensions: extensions is a self-tag and is
    // empty for every asset a menu can show.
    const html = row({ expanded: true, entry: entry(7, { name: "Clinic", supportedUpgrades: ["Extra Wing"], extensions: ["Clinic"] }) });

    assert.match(html, /rowDetailsButtonOpen/);
    assert.match(html, /Upgrades/);
    assert.match(html, /Extra Wing/);
  });

  it("carries the id the scroll anchor finds the row by", () => {
    assert.match(row(), /data-catalog-entry="7"/);
  });
});

describe("a network's lot in the table", () => {
  // Seen in the first screenshot after capture came back: a road's Lot read
  // "0 × 0" in the Table, a measurement of something that does not exist. The
  // hover card and the tile already omit it through hasFootprint.
  it("is no data, not 0 × 0", () => {
    const html = renderHtml(row({ entry: entry(1, { lotWidth: 0, lotDepth: 0 }) }));

    assert.doesNotMatch(html, /0 × 0/);
    // The row's cells come back HTML-escaped inside the hover-card wrapper's
    // attribute, so the quotes and brackets may be entities.
    assert.match(html, /data-metric=(?:"|&quot;)lot(?:"|&quot;)[^>]*?(?:&gt;|>)—/);
  });
});
