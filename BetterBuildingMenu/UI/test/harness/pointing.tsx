import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { getAssetMenuView, resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { entry } from "./render";

const globals = globalThis as unknown as Record<string, unknown>;

/**
 * A body of three buildings, mounted: a cell's enter says its building is pointed at, its leave takes it
 * away, and a cell that goes from under a resting pointer takes it away too, as it sends no leave.
 * `body` draws the entries it is given.
 */
export function assertCellsTellThePointer(body: (entries: BuildingCatalogEntry[]) => ReactElement): void {
  const saved = { requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
  globals.requestAnimationFrame = () => 0;
  globals.cancelAnimationFrame = () => undefined;
  resetAssetMenuView();
  let root: ReactTestRenderer | undefined;
  const pointedId = () => getAssetMenuView().pointed?.entry.id ?? null;

  try {
    act(() => { root = create(body([entry(1), entry(2), entry(3)])); });
    // The cell, and the element the stub draws for it, which the enter reaches too: the cell's own.
    const [cell] = root!.root.findAll((node) => node.props["data-catalog-entry"] === 2 && typeof node.props.onMouseEnter === "function");

    act(() => cell.props.onMouseEnter({ currentTarget: null }));
    assert.equal(pointedId(), 2, "an enter");
    act(() => cell.props.onMouseLeave());
    assert.equal(pointedId(), null, "a leave");

    act(() => cell.props.onMouseEnter({ currentTarget: null }));
    act(() => root!.update(body([entry(1), entry(3)])));
    assert.equal(pointedId(), null, "the cell gone");
  } finally {
    act(() => root?.unmount());
    Object.assign(globals, saved);
  }
}
