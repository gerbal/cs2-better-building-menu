import { useValue } from "cs2/api";
import { useMemo } from "react";

import { blockLabelsOf, bodyCells, type BlockLabels, type BodyCells, type NearField } from "domain/bodyCells";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";

/** The Block labels knob, as the bodies place labels by it. */
export function useBlockLabels(): BlockLabels {
  return blockLabelsOf(useValue(AssetMenuTuning$).blockLabels ?? SHIPPED_TUNING.blockLabels);
}

/**
 * A typed search's flow at a wider step, from the Search flow on wide boxes knob: nearest the field
 * as it ships, or none, so the results run along each row. A value outside its list reads as shipped.
 */
export function useNearField(searching: boolean, firstCols: number, lines: number): NearField | undefined {
  const knob = useValue(AssetMenuTuning$).searchFlow ?? SHIPPED_TUNING.searchFlow;
  const near = searching && knob !== "rowOrder";

  return useMemo(() => (near ? { firstCols, lines } : undefined), [near, firstCols, lines]);
}

/**
 * A body's cells under the Block labels knob, placed again only when the window, its labels, its
 * columns, the knob, a search's flow or the slots a label takes change.
 */
export function useBodyCells(
  entries: readonly BuildingCatalogEntry[],
  sections: readonly CatalogSection[],
  cols: number,
  offset: number,
  flow?: NearField,
  labelSpan = 1,
): BodyCells {
  const blockLabels = useBlockLabels();

  return useMemo(
    () => bodyCells(entries, sections, cols, blockLabels, offset, flow, labelSpan),
    [entries, sections, cols, blockLabels, offset, flow, labelSpan]
  );
}
