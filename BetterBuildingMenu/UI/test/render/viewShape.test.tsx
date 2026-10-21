import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { resetBindings } from "../harness/stubs/cs2-api";
import { mountEach } from "../harness/mount";
import { seed } from "../harness/seed";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { AssetMenuViewMode$, BuildingCatalogGroupBy$ } from "../../src/mods/bindings";
import { currentViewShape, useViewShape, type ViewShape } from "../../src/mods/viewShape";

let drawn: ViewShape;
const Probe = () => {
  drawn = useViewShape();
  return null;
};

describe("what the catalog is drawn as", () => {
  const tree = mountEach();

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  // The catalog and the pane read it in a render; the kept menu reads it outside one.
  const read = (): ViewShape[] => {
    tree.mount(<Probe />);
    return [drawn, currentViewShape()];
  };

  it("draws the session's pick over the saved view", () => {
    setAssetMenuView({ viewMode: "table" });
    seed(AssetMenuViewMode$, "list");

    for (const shape of read()) assert.equal(shape.viewMode, "table");
  });

  it("draws the saved view while nothing has been picked this session", () => {
    seed(AssetMenuViewMode$, "list");

    for (const shape of read()) assert.equal(shape.viewMode, "list");
  });

  it("draws the default view with neither", () => {
    seed(AssetMenuViewMode$, "");

    for (const shape of read()) assert.equal(shape.viewMode, "cards");
  });

  it("groups as C# says", () => {
    seed(BuildingCatalogGroupBy$, "theme");

    for (const shape of read()) assert.equal(shape.groupBy, "theme");
  });

  it("groups by category until C# says", () => {
    seed(BuildingCatalogGroupBy$, "");

    for (const shape of read()) assert.equal(shape.groupBy, "category");
  });
});
