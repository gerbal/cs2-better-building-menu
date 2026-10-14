import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { useMemo } from "react";

import { ASSET_MENU_DEFAULT_HEIGHT, clampAssetMenuHeight, drawnBodyHeight } from "domain/assetMenuLayout";
import { groupDigits } from "domain/assetMenuMetricFormat";
import { bodyGrid, lineSpacing, screenSlots, type LineSpacing } from "domain/bodyGeometry";
import { collapses, heightReadout, snapToLines, type EdgeWords } from "domain/boxEdges";
import { cardGeometry, cardLineSpacing } from "domain/cardsLayout";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuCollapsed$, AssetMenuTopEdge$, AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";
import { screenPixelRem, useBodyGridInput } from "mods/BuildingCatalog/useBodyGrid";
import { useNumberSeparators } from "mods/Bodies/useBodyWords";
import { useMenuBody } from "mods/useMenuBody";

/** What the box's edges read of the open body: where a release lands, and what the readout says during a drag. */
export interface BoxEdges {
  /** Where a release of the top edge lands: whole lines of the open body, or under Top edge's Free where it is let go. */
  snap: (height: number) => number;
  /** Whether a release below the body's floor collapses the box: under Whole lines; under Top edge's Free the floor holds. */
  collapsible: boolean;
  /**
   * What the readout says while the top edge is dragged to this height: the lines a release lands on, or below the
   * floor that the release collapses the box, or leaves it collapsed.
   */
  heightText: (height: number) => string;
}

/**
 * The open body's lines, as the box's edges read them: the body the menu draws now, at its text scale and settings,
 * a small menu's growth left out, and the slots it would show at a dragged height. See docs/design-notes.md, "The
 * top edge".
 */
export function useBoxEdges(): BoxEdges {
  const { translate } = useLocalization();
  const body = useMenuBody().drawn;
  // At a fixed height, which the readout replaces with the dragged one, so a height's echo builds nothing again.
  const input = useBodyGridInput(body, ASSET_MENU_DEFAULT_HEIGHT);
  const textScale = useTextScale();
  const cardHeight = useValue(AssetMenuTuning$).cardHeight ?? SHIPPED_TUNING.cardHeight;
  const separators = useNumberSeparators();
  // Top edge's Free keeps the height where the pointer lets go, held to the drag's range.
  const free = useValue(AssetMenuTopEdge$) === "free";
  // A collapsed box stays so after a release below the floor, under Free too.
  const collapsed = useValue(AssetMenuCollapsed$);

  return useMemo(() => {
    const spacing: LineSpacing = input === null ? cardLineSpacing(cardHeight, textScale) : lineSpacing(input);
    const words: EdgeWords = {
      lines: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLines]", "{0} lines · {1} buildings (game: {2})") ?? "{0} lines · {1} buildings (game: {2})",
      linesOnly: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLinesOnly]", "{0} lines (game: {1})") ?? "{0} lines (game: {1})",
      line: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLine]", "{0} line · {1} buildings (game: {2})") ?? "{0} line · {1} buildings (game: {2})",
      lineOnly: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLineOnly]", "{0} line (game: {1})") ?? "{0} line (game: {1})",
      collapse: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragCollapse]", "Release to collapse") ?? "Release to collapse",
    };
    const format = (count: number) => groupDigits(count, separators);
    const snap = free ? clampAssetMenuHeight : (height: number) => snapToLines(height, spacing);
    // The slots the body would show at the height the release lands on, as the box draws it; the cards' rows alone, as a
    // card is as wide as its words.
    const heightText = (height: number) => {
      if (collapses(height) && (!free || collapsed)) return words.collapse;
      const landed = drawnBodyHeight(snap(height));
      if (input === null) return heightReadout(cardGeometry(cardHeight, landed, textScale, screenPixelRem()).lines, null, words, format);
      const grid = bodyGrid({ ...input, bodyHeight: landed, smallMenusGrow: false });
      return heightReadout(grid.lines, screenSlots(grid), words, format);
    };

    return { snap, collapsible: !free, heightText };
  }, [input, cardHeight, textScale, translate, separators, free, collapsed]);
}
