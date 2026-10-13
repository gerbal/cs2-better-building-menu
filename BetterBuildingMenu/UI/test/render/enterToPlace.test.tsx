import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { fakeSearchField, keysPage, type KeysPage } from "../harness/fakeKeys";
import { catalogPage, entry } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

// Mounted, not rendered to markup: the Enter listener is an effect. Node has no
// document, so the few globals the catalog's effects reach for are faked here.
type KeyEvent = { key: string; keyCode?: number; target?: unknown; preventDefault?: () => void };
const globals = globalThis as unknown as Record<string, unknown>;
let page: KeysPage = keysPage();

function installDocument(): void {
  page = keysPage();
  globals.document = page.document;
  globals.requestAnimationFrame = () => 0;
  globals.cancelAnimationFrame = () => undefined;
}

const press = (event: KeyEvent) => act(() => page.keydown(event));
const enter = (target?: unknown) => press({ key: "Enter", target });
const armed = () => triggers.filter((call) => call.name === "SetCurrentPrefab").map((call) => call.args[0]);

// Two groups, the weaker match first: grouping orders the page by group before
// relevance, which is exactly when the first row is not the one to arm.
const groupedPage = (searchText: string, bestMatchId: number | null) => {
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(
    [
      entry(2, { name: "Old Clinic", groupPath: ["Buildings"] }),
      entry(1, { name: "Clinic", groupPath: ["ServiceBuildings"] }),
    ],
    { bestMatchId, searchText }
  ));
  setBinding("BetterBuildingMenu", "BuildingCatalogGroupBy", "category");
};
const typed = (text: string) => setBinding("BetterBuildingMenu", "CurrentSearch", text);

describe("Enter in the catalog", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    installDocument();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const mount = () => act(() => {
    root = create(<BuildingCatalogComponent />);
  });
  const rerender = () => act(() => {
    root!.update(<BuildingCatalogComponent />);
  });

  for (const mode of ["grid", "list", "cards", "table"]) {
    it(`arms the best match exactly once in ${mode} mode`, () => {
      setAssetMenuView({ viewMode: mode });
      groupedPage("clinic", 1);
      typed("clinic");
      mount();

      enter();

      assert.deepEqual(armed(), [1]);
    });
  }

  it("arms on Enter reported by keyCode alone", () => {
    // Cohtml leaves `key` empty for some keys and fills `keyCode`.
    groupedPage("clinic", 1);
    typed("clinic");
    mount();

    press({ key: "", keyCode: 13 });

    assert.deepEqual(armed(), [1]);
  });

  it("arms the best match by id when its row is past the ones loaded", () => {
    // C# chose it from the whole result; the window holds only the first rows.
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(
      [entry(2, { name: "Parking Lot 001" })],
      { bestMatchId: 240, searchText: "parking" }
    ));
    typed("parking");
    mount();

    enter();

    assert.deepEqual(armed(), [240]);
  });

  it("holds an Enter pressed before the page catches up, and arms when it does", () => {
    // Type and press Enter inside the search debounce: the page is still the
    // unsearched one, and its first tile is not what was asked for.
    groupedPage("", null);
    typed("clinic");
    mount();

    enter();
    assert.deepEqual(armed(), []);

    groupedPage("clinic", 1);
    rerender();
    assert.deepEqual(armed(), [1]);
  });

  it("arms the new search's match, not the previous one's", () => {
    groupedPage("clinic", 1);
    typed("old clinic");
    mount();

    enter();
    assert.deepEqual(armed(), [], "the page still answers the old search");

    groupedPage("old clinic", 2);
    rerender();
    assert.deepEqual(armed(), [2]);
  });

  it("drops a held Enter when the player types on", () => {
    groupedPage("", null);
    typed("clinic");
    mount();
    enter();

    typed("clinics");
    rerender();
    groupedPage("clinics", 1);
    rerender();

    assert.deepEqual(armed(), []);
  });

  it("leaves Enter in another text field to that field", () => {
    // A metric bound commits on Enter; placing a building there throws the edit away.
    groupedPage("clinic", 1);
    typed("clinic");
    mount();

    enter({ tagName: "TEXTAREA" });
    assert.deepEqual(armed(), []);

    enter(fakeSearchField());
    assert.deepEqual(armed(), [1], "the search box's own Enter still arms");
  });

  it("arms nothing without a search", () => {
    groupedPage("", null);
    typed("");
    mount();

    enter();

    assert.deepEqual(armed(), []);
  });

  it("moves the target with Down only once the page answers the query, and from the search field", () => {
    const down = () => press({ key: "ArrowDown", keyCode: 40, target: fakeSearchField(), preventDefault: () => undefined });
    const moves = () => triggers.filter((call) => call.name === "MoveEnterTarget").map((call) => call.args[0]);
    // The page names a target, but for the search before the last letter.
    groupedPage("clini", 1);
    typed("clinic");
    mount();

    down();
    assert.deepEqual(moves(), [], "the page still answers the older search");

    groupedPage("clinic", 1);
    rerender();
    down();
    assert.deepEqual(moves(), [1]);
  });

  it("ignores other keys, and lets go of the document when it unmounts", () => {
    groupedPage("clinic", 1);
    typed("clinic");
    mount();

    press({ key: "a" });
    assert.deepEqual(armed(), []);

    act(() => root?.unmount());
    root = undefined;
    assert.equal(page.listeners(), 0);
  });
});
