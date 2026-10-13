import { useValue } from "cs2/api";
import { useMemo } from "react";

import { drawnBodyHeight } from "domain/assetMenuLayout";
import type { DrawnBody } from "domain/bodyChoice";
import { bodyGrid, deviceRem, type BodyGrid } from "domain/bodyGeometry";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuAtLargeText$, AssetMenuHeight$, AssetMenuTileSize$, AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useOpenMenuShare } from "mods/useMenuBody";

/** A device pixel in rem on this screen, the shortfall a body's line forgives; none where there is no screen. */
export function screenPixelRem(): number {
  return deviceRem(typeof window === "undefined" ? 0 : window.innerHeight);
}

/**
 * The slots of the body the menu draws, at the box's width, the body's height, the text scale and the
 * settings that size them; null for Cards, which packs its own rows.
 */
export function useBodyGrid(body: DrawnBody): BodyGrid | null {
  const { menuWidth } = useAssetMenuLayout();
  const bodyHeight = drawnBodyHeight(useValue(AssetMenuHeight$));
  const textScale = useTextScale();
  const atLargeText = useValue(AssetMenuAtLargeText$);
  const tileSize = useValue(AssetMenuTileSize$);
  const tuning = useValue(AssetMenuTuning$);
  const plateHeight = tuning.listPlateHeight ?? SHIPPED_TUNING.listPlateHeight;
  const nameLines = tuning.nameLines ?? SHIPPED_TUNING.nameLines;
  const smallMenusGrow = tuning.smallMenusGrow ?? SHIPPED_TUNING.smallMenusGrow;
  const pixelRem = screenPixelRem();
  // The open menu's whole row count, fixed per menu, so no tab or filter resizes a small menu's plates.
  const menuRows = useOpenMenuShare().share?.rows ?? 0;

  return useMemo(
    () => (body === "cards"
      ? null
      : bodyGrid({ body, boxWidth: menuWidth, bodyHeight, textScale, atLargeText, tileSize, plateHeight, nameLines, pixelRem, menuRows, smallMenusGrow })),
    [body, menuWidth, bodyHeight, textScale, atLargeText, tileSize, plateHeight, nameLines, pixelRem, menuRows, smallMenusGrow]
  );
}
