import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildToolSurfaceHandoff,
  buildToolSurfaceRenderModel,
  getToolSurfaceAvailability,
  normalizeToolSurfaceText,
  resolveToolSurfaceTarget,
  type ToolSurfaceDescriptor,
  type ToolbarGroup,
  type ToolbarItem,
} from "../src/domain/toolSurfaceContracts.ts";

const roads: ToolSurfaceDescriptor = {
  id: "Roads",
  icon: "road.svg",
  toolTip: "Roads",
  action: "NativeAssetMenu",
  aliases: ["Roads", "Networks"],
};

const paths: ToolSurfaceDescriptor = {
  id: "Paths",
  icon: "path.svg",
  toolTip: "Paths",
  action: "NativeAssetCategory",
  aliases: ["PedestrianPath", "Paths"],
};

const terrain: ToolSurfaceDescriptor = {
  id: "LotTerraform",
  icon: "terrain.svg",
  toolTip: "Lot and terrain tools",
  action: "NativeTool",
  aliases: ["Terrain Tool"],
};

function item(overrides: Partial<ToolbarItem>): ToolbarItem {
  return {
    entity: 1,
    name: "Roads",
    uiTag: "Roads",
    type: 1,
    locked: false,
    ...overrides,
  };
}

function group(children: ToolbarItem[]): ToolbarGroup {
  return { entity: 10, children };
}

describe("tool surface toolbar contracts", () => {
  it("normalizes labels and tags without changing their semantic words", () => {
    assert.equal(normalizeToolSurfaceText("  Pedestrian_Path  "), "pedestrian path");
    assert.equal(normalizeToolSurfaceText("Terrain Tool"), "terrain tool");
  });

  it("prefers an exact uiTag match over a display-name fallback", () => {
    const resolution = resolveToolSurfaceTarget(
      roads,
      [group([item({ entity: 11, name: "Road tools", uiTag: "Roads" }), item({ entity: 12, name: "Roads", uiTag: "Other" })])],
      []
    );

    assert.equal(resolution.enabled, true);
    assert.equal(resolution.target?.entity, 11);
    assert.equal(resolution.target?.alias, "Roads");
  });

  it("resolves an asset category from the vanilla category map", () => {
    const resolution = resolveToolSurfaceTarget(paths, [], new Map([[10, [item({ entity: 21, name: "Pedestrian paths", uiTag: "PedestrianPath" })]]]));

    assert.equal(resolution.enabled, true);
    assert.equal(resolution.target?.entity, 21);
    assert.equal(resolution.target?.trigger, "selectAssetCategory");
  });

  it("resolves category maps keyed by vanilla Entity objects", () => {
    const menuEntity = { index: 17095, version: 1 };
    const categoryEntity = { index: 901, version: 1 };
    const resolution = resolveToolSurfaceTarget(
      paths,
      [],
      new Map([[menuEntity, [item({ entity: categoryEntity, name: "Pedestrian paths", uiTag: "PedestrianPath" })]]])
    );

    assert.equal(resolution.enabled, true);
    assert.deepEqual(resolution.target?.entity, categoryEntity);
    assert.equal(resolution.target?.trigger, "selectAssetCategory");
  });

  it("keeps distinct vanilla Entity objects distinct for ambiguity checks", () => {
    const resolution = resolveToolSurfaceTarget(
      paths,
      [],
      new Map([
        [
          { index: 17095, version: 1 },
          [
            item({ entity: { index: 901, version: 1 }, name: "Pedestrian paths", uiTag: "PedestrianPath" }),
            item({ entity: { index: 902, version: 1 }, name: "Pathways", uiTag: "PedestrianPath" }),
          ],
        ],
      ])
    );

    assert.equal(resolution.enabled, false);
    assert.match(resolution.reason, /ambiguous/i);
  });

  it("fails closed for locked, missing, and ambiguous matches", () => {
    const locked = resolveToolSurfaceTarget(roads, [group([item({ locked: true })])], []);
    assert.equal(getToolSurfaceAvailability(locked).enabled, false);
    assert.match(getToolSurfaceAvailability(locked).reason, /locked/i);

    const missing = resolveToolSurfaceTarget(roads, [], []);
    assert.equal(getToolSurfaceAvailability(missing).enabled, false);
    assert.match(getToolSurfaceAvailability(missing).reason, /match|ready/i);

    const ambiguous = resolveToolSurfaceTarget(roads, [group([item({ entity: 31 }), item({ entity: 32, uiTag: "Networks", name: "Networks" })])], []);
    assert.equal(getToolSurfaceAvailability(ambiguous).enabled, false);
    assert.match(getToolSurfaceAvailability(ambiguous).reason, /ambiguous/i);
  });

  it("does not invent a direct ToolSystem handoff for NativeTool descriptors", () => {
    const resolution = resolveToolSurfaceTarget(terrain, [group([item({ name: "Terrain Tool", uiTag: "Terrain Tool" })])], []);

    assert.equal(resolution.enabled, false);
    assert.match(getToolSurfaceAvailability(resolution).reason, /native tool/i);
    assert.equal(buildToolSurfaceHandoff(resolution), null);
  });

  it("orders the native toolbar trigger before closing FindIt", () => {
    const resolution = resolveToolSurfaceTarget(roads, [group([item({ entity: 41 })])], []);
    const handoff = buildToolSurfaceHandoff(resolution);

    assert.deepEqual(handoff, {
      toolbar: { group: "toolbar", method: "selectAssetMenu", args: [41] },
      afterToolbar: [
        { group: "mod", method: "SetBuildingLensEnabled", args: [false] },
        { group: "mod", method: "FindItCloseToggled", args: [] },
      ],
    });
  });

  it("keeps the six surfaces in a distinct tools render model", () => {
    const model = buildToolSurfaceRenderModel([roads, paths, terrain], [group([item({ entity: 51 })])], []);

    assert.deepEqual(model.map((entry) => entry.id), ["Roads", "Paths", "LotTerraform"]);
    assert.ok(model.every((entry) => entry.surfaceKind === "tools"));
    assert.equal(model[1].enabled, false);
    assert.match(model[1].reason, /match|ready/i);
  });
});
