import { useValue } from "cs2/api";
import { useMemo } from "react";

import { bodyCells, type BlockLabels, type BodyCells } from "domain/bodyCells";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";

/**
 * A body's cells under the Block labels knob, placed again only when the window, its labels, its
 * columns or the knob change. A value outside the knob's list reads as shipped, as C# reads it.
 */
export function useBodyCells(entries: readonly BuildingCatalogEntry[], sections: readonly CatalogSection[], offset: number, cols: number): BodyCells {
  const knob = useValue(AssetMenuTuning$).blockLabels ?? SHIPPED_TUNING.blockLabels;
  const blockLabels: BlockLabels = knob === "ownLine" ? "ownLine" : "inline";

  return useMemo(() => bodyCells(entries, sections, cols, blockLabels, offset), [entries, sections, cols, blockLabels, offset]);
}
