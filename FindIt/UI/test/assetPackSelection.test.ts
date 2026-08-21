import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ASSET_PACK_FACET_ID,
  assetPackIndex,
  isAssetPackFacetCommand,
  parseAssetPackId,
  toggleAssetPack,
} from "../src/domain/assetPackSelection.ts";

describe("asset pack selection", () => {
  it("parses the index:version id C# mints", () => {
    assert.deepEqual(parseAssetPackId("4211:1"), { index: 4211, version: 1 });
  });

  it("refuses an id it cannot turn back into an entity", () => {
    // A bare index is the trap: vanilla's setter takes entities, so half an
    // identity has to be rejected rather than guessed at with version 0.
    assert.equal(parseAssetPackId("4211"), null);
    assert.equal(parseAssetPackId(""), null);
    assert.equal(parseAssetPackId("pack:one"), null);
    assert.equal(parseAssetPackId(null), null);
  });

  it("reads an index out of all three shapes the toolbar hands out", () => {
    assert.equal(assetPackIndex(4211), 4211);
    assert.equal(assetPackIndex("4211:1"), 4211);
    assert.equal(assetPackIndex({ index: 4211, version: 1 }), 4211);
    assert.equal(assetPackIndex(null), null);
  });

  it("adds a pack the game has not got selected", () => {
    assert.deepEqual(toggleAssetPack([], "4211:1"), [{ index: 4211, version: 1 }]);
  });

  it("removes one it has, whatever shape it arrived in", () => {
    assert.deepEqual(toggleAssetPack([4211], "4211:1"), []);
    assert.deepEqual(toggleAssetPack([{ index: 4211, version: 1 }], "4211:1"), []);
  });

  it("passes existing entries through untouched", () => {
    // They may be bare indices, and re-minting one as a pair would mean
    // inventing a version the binding never gave us.
    assert.deepEqual(toggleAssetPack([77, { index: 88, version: 2 }], "4211:1"), [
      77,
      { index: 88, version: 2 },
      { index: 4211, version: 1 },
    ]);
  });

  it("leaves the selection alone when the id is unusable", () => {
    assert.deepEqual(toggleAssetPack([77], "nonsense"), [77]);
  });

  it("recognises a pack chip's remove command", () => {
    assert.equal(isAssetPackFacetCommand({ args: [ASSET_PACK_FACET_ID, "4211:1"] }), true);
    assert.equal(isAssetPackFacetCommand({ args: ["theme", "European"] }), false);
    assert.equal(isAssetPackFacetCommand(null), false);
  });
});
