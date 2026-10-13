import { useValue } from "cs2/api";
import { useMemo } from "react";

import { bodyCells, type BlockLabels, type BodyCells } from "domain/bodyCells";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";

/** The Block labels knob: a value outside its list reads as shipped, as C# reads it. */
export function useBlockLabels(): BlockLabels {
  const knob = useValue(AssetMenuTuning$).blockLabels ?? SHIPPED_TUNING.blockLabels;
  return knob === "ownLine" ? "ownLine" : "inline";
}

/**
 * A body's cells under the Block labels knob, placed again only when the window, its labels, its
 * columns or the knob change.
 */
export function useBodyCells(entries: readonly BuildingCatalogEntry[], sections: readonly CatalogSection[], cols: number, offset: number): BodyCells {
  const blockLabels = useBlockLabels();

  return useMemo(() => bodyCells(entries, sections, cols, blockLabels, offset), [entries, sections, cols, blockLabels, offset]);
}
