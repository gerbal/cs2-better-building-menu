import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyCells } from "../src/domain/bodyCells";
import type { BuildingCatalogEntry, CatalogSection } from "../src/domain/buildingCatalog";

const rows = (n: number) => Array.from({ length: n }, (_, at) => ({ id: at + 1 }) as BuildingCatalogEntry);
const section = (start: number, count: number, over: Partial<CatalogSection> = {}): CatalogSection =>
  ({ id: `group:${start}`, kind: "group", label: `Group ${start}`, labelId: "", start, count, collapsed: false, ...over });
const layout = (cells: ReturnType<typeof bodyCells>["cells"]) =>
  cells.map((cell) => (cell.kind === "label" ? `L${cell.section.start}@${cell.slot}x${cell.span}` : `${cell.entry.id}@${cell.slot}`));

describe("the cells a body places", () => {
  it("puts each building in the next slot when the result has no labels", () => {
    const { cells, slots } = bodyCells(rows(3), [], 4, "inline");

    assert.deepEqual(layout(cells), ["1@0", "2@1", "3@2"]);
    assert.equal(slots, 3);
  });

  it("puts each group's label in the slot before its first building, one slot each, inline", () => {
    const { cells, slots } = bodyCells(rows(5), [section(0, 3), section(3, 2)], 4, "inline");

    assert.deepEqual(layout(cells), ["L0@0x1", "1@1", "2@2", "3@3", "L3@4x1", "4@5", "5@6"]);
    assert.equal(slots, 7);
  });

  it("draws a label once the window reaches its first row, and a collapsed one at the window's end", () => {
    // The window holds 2 of the first group's rows; the second group waits for its rows.
    assert.deepEqual(layout(bodyCells(rows(2), [section(0, 3), section(3, 2)], 4, "inline").cells), ["L0@0x1", "1@1", "2@2"]);

    const locked = section(2, 5, { id: "locked", kind: "locked", collapsed: true });
    assert.deepEqual(layout(bodyCells(rows(2), [locked], 4, "inline").cells), ["1@0", "2@1", "L2@2x1"]);
  });

  it("draws no label above Load more with no row under it: a group starting where the window ends waits", () => {
    assert.deepEqual(layout(bodyCells(rows(3), [section(0, 3), section(3, 2)], 4, "inline").cells), ["L0@0x1", "1@1", "2@2", "3@3"]);

    const locked = section(3, 5, { id: "locked", kind: "locked" });
    assert.deepEqual(layout(bodyCells(rows(3), [locked], 4, "inline").cells), ["1@0", "2@1", "3@2"]);
  });

  it("counts a section's start from the result's first row, so a window that starts further on places it by the window", () => {
    const { cells } = bodyCells(rows(3), [section(10, 1), section(11, 2)], 4, "inline", 10);

    assert.deepEqual(layout(cells), ["L10@0x1", "1@1", "L11@2x1", "2@3", "3@4"]);
  });

  it("draws no label for a section that ends before the window, and the label of the one it starts inside first", () => {
    const { cells } = bodyCells(rows(4), [section(0, 5), section(5, 3), section(8, 4)], 4, "inline", 6);

    assert.deepEqual(layout(cells), ["L5@0x1", "1@1", "2@2", "L8@3x1", "3@4", "4@5"]);
  });

  it("starts an own-line label on a fresh line and gives it the whole line, so no line holds two blocks", () => {
    const { cells, slots } = bodyCells(rows(5), [section(0, 3), section(3, 2)], 4, "ownLine");

    assert.deepEqual(layout(cells), ["L0@0x4", "1@4", "2@5", "3@6", "L3@8x4", "4@12", "5@13"]);
    assert.equal(slots, 14);
  });
});
