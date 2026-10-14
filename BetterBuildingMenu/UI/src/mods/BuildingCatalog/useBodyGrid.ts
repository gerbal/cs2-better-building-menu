import { useValue } from "cs2/api";
import { useMemo, useRef } from "react";

import { drawnBodyHeight } from "domain/assetMenuLayout";
import { bodyCells } from "domain/bodyCells";
import type { BodyKind } from "domain/bodyChoice";
import { bodyGrid, deviceRem, sameGrid, type BodyGrid, type BodyGridInput } from "domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { lookOf } from "domain/looks";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuAtLargeText$, AssetMenuHeight$, AssetMenuLook$, AssetMenuTileSize$, AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useOpenMenuShare } from "mods/useMenuBody";
import { useBlockLabels } from "mods/Bodies/useBodyCells";

/** A device pixel in rem on this screen, the shortfall a body's line forgives; none where there is no screen. */
export function screenPixelRem(): number {
  return deviceRem(typeof window === "undefined" ? 0 : window.innerHeight);
}

/**
 * The body's height as drawn: the stored one, or `held`, the one a drag of the top edge holds it at, where the
 * release lands, so the body draws again only as that changes. See docs/design-notes.md, "The top edge".
 */
export function useDrawnBodyHeight(held: number | null = null): number {
  const stored = useValue(AssetMenuHeight$);
  return drawnBodyHeight(held ?? stored);
}

/**
 * What sizes the slots of the body the menu draws: the box's width, the body's height, the text scale and the
 * settings; null for Cards, which packs its own rows. Read by the body and by the box's edges, whose readout
 * counts the slots a drag would show.
 */
export function useBodyGridInput(body: BodyKind, held: number | null = null): BodyGridInput | null {
  const { menuWidth } = useAssetMenuLayout();
  const bodyHeight = useDrawnBodyHeight(held);
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
  // The look's tiles: Standard's keep a name line under them, Plates' sit centred in the body.
  const tileNameLine = lookOf(useValue(AssetMenuLook$)).tileNameLine;

  return useMemo<BodyGridInput | null>(
    () => (body === "cards"
      ? null
      : { body, boxWidth: menuWidth, bodyHeight, textScale, atLargeText, tileSize, iconSize, plateHeight, nameLines, pixelRem, menuRows, smallMenusGrow, tileNameLine }),
    [body, menuWidth, bodyHeight, textScale, atLargeText, tileSize, iconSize, plateHeight, nameLines, pixelRem, menuRows, smallMenusGrow, tileNameLine]
  );
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
  held: number | null = null,
): BodyGrid | null {
  const input = useBodyGridInput(body, held);
  const blockLabels = useBlockLabels();
  const plain = useMemo(() => (input === null ? null : bodyGrid(input)), [input]);
  // The columns never depend on the growth, so the slots counted at them hold for the grown grid; a
  // count, so a new page that draws as many slots keeps the grid.
  const drawnSlots = useMemo(
    () => (plain === null || plain.form === "tile" || plain.form === "icon" ? 0 : bodyCells(entries, sections, plain.cols, blockLabels, offset).slots),
    [plain, entries, sections, blockLabels, offset]
  );

  // The grown grid where the slots grow it; else the plain one, the very object, so a page that draws
  // more slots of the same grid redraws none of the cells already drawn.
  const grid = useMemo(() => {
    if (input === null || plain === null || plain.form === "tile" || plain.form === "icon") return plain;
    const grown = bodyGrid({ ...input, drawnSlots });
    return sameGrid(grown, plain) ? plain : grown;
  }, [input, plain, drawnSlots]);
  // The grid drawn last while every slot sits alike, so a height that moves no slot, as a drag's, redraws none.
  const drawn = useRef(grid);
  if (grid === null || drawn.current === null || !sameGrid(grid, drawn.current)) drawn.current = grid;
  return drawn.current;
}
