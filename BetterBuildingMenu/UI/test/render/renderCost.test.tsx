import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry, showBody } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

// Mounted, so bindings re-render their readers as they do in the game. Each row
// reads its entry's prefabName once per render (the name is blank), so a
// counting getter says how many times the rows drew.
const globals = globalThis as unknown as Record<string, unknown>;
let reads = 0;

const counted = (id: number): BuildingCatalogEntry => {
  const row = entry(id, { name: "" });
  Object.defineProperty(row, "prefabName", {
    get: () => {
      reads++;
      return `Prefab${id}`;
    },
  });
  return row;
};

describe("what a keystroke re-renders", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    reads = 0;
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
    showBody("list");
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const mount = () => act(() => {
    root = create(<BuildingCatalogComponent />);
  });

  for (const body of ["tiles", "list", "cards"]) {
    it(`leaves the rows alone in the ${body} body when only the search box moves`, () => {
      // The box echoes every keystroke, and the catalog reads it; the rows'
      // props do not change until the page does. The first letter turns tiles
      // to the list, so the query is under way before the count starts.
      showBody(body);
      setBinding("BetterBuildingMenu", "CurrentSearch", "c");
      setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([counted(1), counted(2), counted(3)]));
      mount();
      const afterMount = reads;

      act(() => setBinding("BetterBuildingMenu", "CurrentSearch", "cli"));
      act(() => setBinding("BetterBuildingMenu", "CurrentSearch", "clin"));

      assert.ok(afterMount > 0, `${body}: the rows drew once`);
      assert.equal(reads, afterMount, body);
    });
  }

  it("redraws the rows when the page changes", () => {
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([counted(1), counted(2)]));
    mount();
    const afterMount = reads;

    act(() => setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([counted(1), counted(2)])));

    assert.ok(reads > afterMount);
  });
});
