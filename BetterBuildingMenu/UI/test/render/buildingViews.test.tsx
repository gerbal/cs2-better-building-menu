import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { renderHtml, entry } from "../harness/render";
import { installFakeBrowser, type FakeBrowser } from "../harness/fakeBrowser";
import { mountEach } from "../harness/mount";
import { seed } from "../harness/seed";
import { resetBindings } from "../harness/stubs/cs2-api";
import { loadLocale, resetLocale } from "../harness/stubs/cs2-l10n";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { BuildingGrid } from "../../src/mods/BuildingGrid/BuildingGrid";
import { BuildingList } from "../../src/mods/BuildingList/BuildingList";
import { TableRow } from "../../src/mods/BuildingCatalog/TableRow";
import { useHoverCardContext } from "../../src/mods/BuildingHoverCard/BuildingHoverCard";
import { BuildingCatalogSortColumn$ } from "../../src/mods/bindings";

// The table reads the hover card's context once and hands it to every row.
const TableRowInTable = ({ entry: rowEntry }: { entry: BuildingCatalogEntry }) => (
  <TableRow
    entry={rowEntry}
    expanded={false}
    nameBudget={40}
    labels={{ place: "Place", inspect: "Details" }}
    hoverCard={useHoverCardContext()}
    columnStyle={() => ({})}
    resolveFacetLabel={() => null}
    onPlace={() => {}}
    onToggleExpanded={() => {}}
  />
);

const grid = (entries: BuildingCatalogEntry[]) => renderHtml(<BuildingGrid entries={entries} onPlace={() => {}} />);
const list = (entries: BuildingCatalogEntry[]) => renderHtml(<BuildingList entries={entries} onPlace={() => {}} />);
const table = (entries: BuildingCatalogEntry[]) =>
  renderHtml(<>{entries.map((rowEntry) => <TableRowInTable key={rowEntry.id} entry={rowEntry} />)}</>);

/** The sorted figure each view draws, in page order. */
const sortedFigures = (html: string): string[] =>
  [...html.matchAll(/<span class="sortedMetric">([^<]*)<\/span>/g)].map(([, text]) => text);

describe("the sorted figure on a tile and a row", () => {
  beforeEach(() => {
    resetBindings();
    seed(BuildingCatalogSortColumn$, "LotWidth");
  });

  it("draws no lot for a road, whose lot is 0 × 0", () => {
    // A measurement of something that does not exist; the badge explains an
    // order, and "0×0" explains none.
    const road = [entry(1, { lotWidth: 0, lotDepth: 0 })];

    assert.deepEqual(sortedFigures(grid(road)), []);
    assert.deepEqual(sortedFigures(list(road)), []);
  });

  it("states a lot the same way in the grid as in the list", () => {
    const lot = [entry(1, { lotWidth: 6, lotDepth: 4 })];

    assert.deepEqual(sortedFigures(grid(lot)), sortedFigures(list(lot)));
    assert.equal(sortedFigures(list(lot)).length, 1);
  });
});

describe("the words for an unplaceable tile and row", () => {
  beforeEach(() => resetBindings());
  afterEach(() => resetLocale());

  it("names an already-built unique in the game's own words", () => {
    loadLocale({ "Toolbar.ASSET_ALREADY_BUILT": "Déjà construit" });
    const built = [entry(1, { name: "Clinic", isUnique: true, isAlreadyBuilt: true })];

    assert.match(grid(built), /aria-label="Clinic — Déjà construit"/);
    assert.match(list(built), /aria-label="Clinic — Déjà construit"/);
    assert.match(table(built), /aria-label="Place: Clinic — Déjà construit"/);
  });

  it("falls back to the mod's word where the game has none", () => {
    const built = [entry(1, { name: "Clinic", isUnique: true, isAlreadyBuilt: true })];
    const locked = [entry(2, { name: "Clinic", isLocked: true })];

    assert.match(grid(built), /aria-label="Clinic — Already built"/);
    assert.match(grid(locked), /aria-label="Clinic — Locked"/);
    assert.match(list(locked), /aria-label="Clinic — Locked"/);
    assert.match(table(locked), /aria-label="Place: Clinic — Locked"/);
  });
});

// Mounted, so a tile's handler runs. The tile name's effects need a frame clock;
// none of its frames run here.
describe("placing from the grid and the list", () => {
  const tree = mountEach();
  let browser: FakeBrowser;

  beforeEach(() => {
    resetBindings();
    browser = installFakeBrowser({ frames: "none" });
  });
  afterEach(() => browser.restore());

  const select = (id: number) =>
    act(() => tree.root.find((node) => node.props["data-catalog-entry"] === id && typeof node.props.onSelect === "function").props.onSelect());
  const entries = [entry(1), entry(2, { isLocked: true }), entry(3, { isUnique: true, isAlreadyBuilt: true })];

  for (const [name, View] of [["grid", BuildingGrid], ["list", BuildingList]] as const) {
    it(`${name}: places what the game would place, and refuses the rest`, () => {
      const placed: number[] = [];
      tree.mount(<View entries={entries} onPlace={(placedEntry) => placed.push(placedEntry.id)} />);

      select(1);
      select(2);
      select(3);

      assert.deepEqual(placed, [1]);
    });

    it(`${name}: hands every row one place callback, which calls the newest onPlace`, () => {
      const first: number[] = [];
      const second: number[] = [];
      const placeProp = () => tree.root.find((node) => node.props.entry?.id === 1 && typeof node.props.onPlace === "function").props.onPlace;
      tree.mount(<View entries={entries} onPlace={(placedEntry) => first.push(placedEntry.id)} />);
      const before = placeProp();

      act(() => tree.renderer.update(<View entries={entries} onPlace={(placedEntry) => second.push(placedEntry.id)} />));
      select(1);

      assert.equal(placeProp(), before);
      assert.deepEqual(first, []);
      assert.deepEqual(second, [1]);
    });
  }
});
