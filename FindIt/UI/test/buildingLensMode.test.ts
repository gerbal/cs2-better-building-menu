import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBuildingLensModeView,
  type BuildingLensMode,
} from "../src/domain/buildingLensMode.ts";

describe("building lens mode contract", () => {
  it("keeps catalog navigation, rows, and paging owned by Catalog mode", () => {
    assert.deepEqual(getBuildingLensModeView("catalog"), {
      mode: "catalog",
      showCatalogNavigation: true,
      showCatalogContent: true,
      showToolsContent: false,
      showCatalogPaging: true,
    });
  });

  it("hides catalog rows and paging while Tools mode is selected", () => {
    assert.deepEqual(getBuildingLensModeView("tools"), {
      mode: "tools",
      showCatalogNavigation: false,
      showCatalogContent: false,
      showToolsContent: true,
      showCatalogPaging: false,
    });
  });

  it("supports returning to the prior catalog mode without rewriting catalog state", () => {
    const priorMode: BuildingLensMode = "catalog";
    const toolsView = getBuildingLensModeView("tools");
    const restoredView = getBuildingLensModeView(priorMode);

    assert.equal(toolsView.showCatalogContent, false);
    assert.equal(restoredView.mode, priorMode);
    assert.equal(restoredView.showCatalogContent, true);
    assert.equal(restoredView.showCatalogPaging, true);
  });
});
