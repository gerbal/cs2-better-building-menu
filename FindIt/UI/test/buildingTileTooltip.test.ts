import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TILE_TOOLTIP_MAX_LINES,
  buildTileTooltipLines,
  isMetricPresent,
  type TileTooltipCandidate,
} from "../src/domain/buildingTileTooltip.ts";

const candidate = (over: Partial<TileTooltipCandidate> = {}): TileTooltipCandidate => ({
  key: "cost",
  label: "Cost",
  value: "12 000",
  applicable: true,
  ...over,
});

describe("metric presence", () => {
  it("treats a real zero as a value, because the indexer only nulls what is missing", () => {
    assert.equal(isMetricPresent(0), true);
  });

  it("treats null and undefined as nothing", () => {
    assert.equal(isMetricPresent(null), false);
    assert.equal(isMetricPresent(undefined), false);
  });

  it("treats a non-finite number as nothing rather than printing NaN", () => {
    assert.equal(isMetricPresent(Number.NaN), false);
    assert.equal(isMetricPresent(Number.POSITIVE_INFINITY), false);
  });
});

describe("tile tooltip lines", () => {
  it("drops a field that does not apply to this asset", () => {
    const lines = buildTileTooltipLines([
      candidate(),
      candidate({ key: "lot", label: "Lot", value: "0 × 0", applicable: false }),
    ]);

    assert.deepEqual(lines.map((line) => line.key), ["cost"]);
  });

  it("drops an applicable field that has no value, rather than printing a placeholder", () => {
    const lines = buildTileTooltipLines([
      candidate(),
      candidate({ key: "capacity", label: "Capacity", value: "" }),
      candidate({ key: "upkeep", label: "Upkeep", value: "   " }),
    ]);

    assert.deepEqual(lines.map((line) => line.key), ["cost"]);
  });

  it("keeps the label with the value, since a bare figure names nothing", () => {
    const [line] = buildTileTooltipLines([candidate({ label: "Upkeep", value: "120/mo" })]);

    assert.equal(line.label, "Upkeep");
    assert.equal(line.value, "120/mo");
  });

  it("carries a tone through so the forecasts keep their colouring", () => {
    const [warn, good] = buildTileTooltipLines([
      candidate({ key: "cost", tone: "warn" }),
      candidate({ key: "capacity", tone: "good" }),
    ]);

    assert.equal(warn.tone, "warn");
    assert.equal(good.tone, "good");
  });

  it("omits tone entirely when there is none, so the key never renders as undefined", () => {
    const [line] = buildTileTooltipLines([candidate()]);

    assert.equal("tone" in line, false);
  });

  it("caps the card — the grid's whole advantage is being shorter than the table", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const lines = buildTileTooltipLines(keys.map((key) => candidate({ key })));

    assert.equal(lines.length, TILE_TOOLTIP_MAX_LINES);
    assert.deepEqual(lines.map((line) => line.key), keys.slice(0, TILE_TOOLTIP_MAX_LINES));
  });

  it("counts only the lines that survived, so dropping one promotes the next", () => {
    const lines = buildTileTooltipLines([
      candidate({ key: "a" }),
      candidate({ key: "b", applicable: false }),
      candidate({ key: "c" }),
      candidate({ key: "d" }),
      candidate({ key: "e" }),
    ]);

    assert.deepEqual(lines.map((line) => line.key), ["a", "c", "d", "e"]);
  });

  it("carries a multi-line value through, for the fields that are lists", () => {
    const [line] = buildTileTooltipLines([
      candidate({ key: "requires", values: ["Small City", "Healthcare tech, 8 pts"] }),
    ]);

    assert.deepEqual(line.values, ["Small City", "Healthcare tech, 8 pts"]);
  });

  it("omits an empty values array rather than rendering an empty list", () => {
    const [line] = buildTileTooltipLines([candidate({ key: "cost", values: [] })]);

    assert.equal("values" in line, false);
  });

  it("honours an explicit lower cap", () => {
    const lines = buildTileTooltipLines([candidate({ key: "a" }), candidate({ key: "b" })], 1);

    assert.deepEqual(lines.map((line) => line.key), ["a"]);
  });

  it("returns nothing when every field is inapplicable", () => {
    const lines = buildTileTooltipLines([candidate({ applicable: false })]);

    assert.deepEqual(lines, []);
  });
});
