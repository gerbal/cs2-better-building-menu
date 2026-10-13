import { useValue } from "cs2/api";
import { useMemo } from "react";

import { drawnBodyHeight } from "domain/assetMenuLayout";
import { bodyCells } from "domain/bodyCells";
import type { BodyKind } from "domain/bodyChoice";
import { bodyGrid, deviceRem, type BodyGrid, type BodyGridInput } from "domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuAtLargeText$, AssetMenuHeight$, AssetMenuTileSize$, AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useOpenMenuShare } from "mods/useMenuBody";
import { useBlockLabels } from "mods/Bodies/useBodyCells";

/** A device pixel in rem on this screen, the shortfall a body's line forgives; none where there is no screen. */
export function screenPixelRem(): number {
  return deviceRem(typeof window === "undefined" ? 0 : window.innerHeight);
}

/**
 * The slots of the body the menu draws, at the box's width, the body's height, the text scale and the
 * settings that size them; null for Cards, which packs its own rows. The window and its labels tell a
 * grown list how many slots it draws.
 */
export function useBodyGrid(
  body: BodyKind,
  entries: readonly BuildingCatalogEntry[],
  sections: readonly CatalogSection[],
  offset: number,
): BodyGrid | null {
  const { menuWidth } = useAssetMenuLayout();
  const bodyHeight = drawnBodyHeight(useValue(AssetMenuHeight$));
  const textScale = useTextScale();
  const atLargeText = useValue(AssetMenuAtLargeText$);
  const tileSize = useValue(AssetMenuTileSize$);
  const tuning = useValue(AssetMenuTuning$);
  const plateHeight = tuning.listPlateHeight ?? SHIPPED_TUNING.listPlateHeight;
  const nameLines = tuning.nameLines ?? SHIPPED_TUNING.nameLines;
  const smallMenusGrow = tuning.smallMenusGrow ?? SHIPPED_TUNING.smallMenusGrow;
  const iconSize = tuning.iconSize ?? SHIPPED_TUNING.iconSize;
  const pixelRem = screenPixelRem();
  // The open menu's whole row count, fixed per menu, so no tab or filter resizes a small menu's plates.
  const menuRows = useOpenMenuShare().share?.rows ?? 0;
  const blockLabels = useBlockLabels();

  const input = useMemo<BodyGridInput | null>(
    () => (body === "cards"
      ? null
      : { body, boxWidth: menuWidth, bodyHeight, textScale, atLargeText, tileSize, iconSize, plateHeight, nameLines, pixelRem, menuRows, smallMenusGrow }),
    [body, menuWidth, bodyHeight, textScale, atLargeText, tileSize, iconSize, plateHeight, nameLines, pixelRem, menuRows, smallMenusGrow]
  );
  const plain = useMemo(() => (input === null ? null : bodyGrid(input)), [input]);
  // The columns never depend on the growth, so the slots counted at them hold for the grown grid; a
  // count, so a new page that draws as many slots keeps the grid.
  const drawnSlots = useMemo(
    () => (plain === null || plain.form === "tile" || plain.form === "icon" ? 0 : bodyCells(entries, sections, plain.cols, blockLabels, offset).slots),
    [plain, entries, sections, blockLabels, offset]
  );

  return useMemo(
    () => (input === null || plain === null || plain.form === "tile" || plain.form === "icon" ? plain : bodyGrid({ ...input, drawnSlots })),
    [input, plain, drawnSlots]
  );
}
