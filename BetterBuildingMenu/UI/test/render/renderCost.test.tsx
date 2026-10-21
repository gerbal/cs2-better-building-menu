import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { catalogPage, entry } from "../harness/render";
import { installFakeBrowser } from "../harness/fakeBrowser";
import { resetBindings } from "../harness/stubs/cs2-api";
import { mountEach } from "../harness/mount";
import { seed } from "../harness/seed";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { AssetMenuWidth$, BuildingCatalog$, CurrentSearch$ } from "../../src/mods/bindings";

// Mounted, so bindings re-render their readers as they do in the game. Each row
// reads its entry's prefabName once per render (the name is blank), so a
// counting getter says how many times the rows drew.
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
  const tree = mountEach();

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    reads = 0;
    installFakeBrowser({ frames: "none" });
    seed(AssetMenuWidth$, 700);
    setAssetMenuView({ viewMode: "table" });
  });

  const mount = () => tree.mount(<BuildingCatalogComponent />);

  for (const mode of ["table", "grid", "list", "cards"]) {
    it(`leaves the rows alone in ${mode} mode when only the search box moves`, () => {
      // The box echoes every keystroke, and the catalog reads it; the rows'
      // props do not change until the page does.
      setAssetMenuView({ viewMode: mode });
      seed(BuildingCatalog$, catalogPage([counted(1), counted(2), counted(3)]));
      mount();
      const afterMount = reads;

      act(() => seed(CurrentSearch$, "cli"));
      act(() => seed(CurrentSearch$, "clin"));

      assert.ok(afterMount > 0, `${mode}: the rows drew once`);
      assert.equal(reads, afterMount, mode);
    });
  }

  it("redraws the rows when the page changes", () => {
    seed(BuildingCatalog$, catalogPage([counted(1), counted(2)]));
    mount();
    const afterMount = reads;

    act(() => seed(BuildingCatalog$, catalogPage([counted(1), counted(2)])));

    assert.ok(reads > afterMount);
  });
});
