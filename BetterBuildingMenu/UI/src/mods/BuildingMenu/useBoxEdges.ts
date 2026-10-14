import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { useMemo } from "react";

import { ASSET_MENU_DEFAULT_HEIGHT, ASSET_MENU_MIN_HEIGHT, clampAssetMenuHeight, drawnBodyHeight } from "domain/assetMenuLayout";
import { groupDigits } from "domain/assetMenuMetricFormat";
import { bodyGrid, lineSpacing, screenSlots, type LineSpacing } from "domain/bodyGeometry";
import { collapses, heightOfLines, heightReadout, snapToLines, widthReadout, type EdgeWords } from "domain/boxEdges";
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
  /**
   * Where the body draws while the top edge moves: whole lines, the ones the release lands on, or under Top edge's Free,
   * where the box follows the pointer and the release keeps the height let go at, the ones that height draws. The body
   * then draws again only as its lines change, not every pointer frame.
   */
  hold: (height: number) => number;
  /** Whether a release below the body's floor collapses the box: under Whole lines; under Top edge's Free the floor holds. */
  collapsible: boolean;
  /**
   * What the readout says while the top edge is dragged to this height: the lines a release lands on, or below the
   * floor that the release collapses the box, or leaves it collapsed; nothing under Top edge's Free below the floor
   * of a collapsed box, whose release does neither.
   */
  heightText: (height: number) => string | null;
  /**
   * What the readout says while a side edge is dragged to a step: the step and the buildings its width shows at the
   * body's drawn height, or the step alone for the cards and where the box draws no body (a null height).
   */
  widthText: (step: number, width: number, bodyHeight: number | null) => string;
}

/**
 * The open body's lines, as the box's edges read them: the body the menu draws now, at its text scale and settings,
 * a small menu's growth left out, and the slots it would show at a dragged height. See docs/design-notes.md, "The
 * top edge".
 */
export function useBoxEdges(): BoxEdges {
  const { translate } = useLocalization();
  const body = useMenuBody().drawn;
  // At a fixed height, which each readout replaces with the one it counts at, the dragged height or the body's drawn
  // one, so a height's echo builds nothing again.
  const input = useBodyGridInput(body, ASSET_MENU_DEFAULT_HEIGHT);
  const textScale = useTextScale();
  const cardHeight = useValue(AssetMenuTuning$).cardHeight ?? SHIPPED_TUNING.cardHeight;
  const separators = useNumberSeparators();
  // Top edge's Free keeps the height where the pointer lets go, held to the drag's range.
  const free = useValue(AssetMenuTopEdge$) === "free";
  // A collapsed box stays so after a release below the floor, under Free too, where the readout says nothing of it.
  const collapsed = useValue(AssetMenuCollapsed$);

  return useMemo(() => {
    const spacing: LineSpacing = input === null ? cardLineSpacing(cardHeight, textScale) : lineSpacing(input);
    const words: EdgeWords = {
      lines: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLines]", "{0} lines · {1} buildings (game: {2})") ?? "{0} lines · {1} buildings (game: {2})",
      linesOnly: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLinesOnly]", "{0} lines (game: {1})") ?? "{0} lines (game: {1})",
      line: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLine]", "{0} line · {1} buildings (game: {2})") ?? "{0} line · {1} buildings (game: {2})",
      lineOnly: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLineOnly]", "{0} line (game: {1})") ?? "{0} line (game: {1})",
      collapse: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragCollapse]", "Release to collapse") ?? "Release to collapse",
      width: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragWidth]", "Width {0} · {1} buildings") ?? "Width {0} · {1} buildings",
      widthOnly: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragWidthOnly]", "Width {0}") ?? "Width {0}",
    };
    const format = (count: number) => groupDigits(count, separators);
    // The lines the body draws at a body height, and the slots they show (the cards' rows alone, as a card is as wide
    // as its words): the one count the readout says and Free's hold keeps, worked out once for each height a frame asks.
    let counted: { bodyHeight: number; lines: number; slots: number | null } | null = null;
    const countAt = (bodyHeight: number) => {
      if (counted?.bodyHeight === bodyHeight) return counted;
      if (input === null) {
        counted = { bodyHeight, lines: cardGeometry(cardHeight, bodyHeight, textScale, screenPixelRem()).lines, slots: null };
      } else {
        const grid = bodyGrid({ ...input, bodyHeight, smallMenusGrow: false });
        counted = { bodyHeight, lines: grid.lines, slots: screenSlots(grid) };
      }
      return counted;
    };
    // Under Free the release keeps the height let go at, so the body is held at the whole lines that height draws, the
    // floor's below it; under Whole lines, at the lines the release lands on.
    const fitted = (height: number) =>
      Math.max(ASSET_MENU_MIN_HEIGHT, heightOfLines(Math.max(1, countAt(drawnBodyHeight(clampAssetMenuHeight(height))).lines), spacing));
    const hold = free ? fitted : (height: number) => snapToLines(height, spacing);
    const snap = free ? clampAssetMenuHeight : hold;
    // What the body would show at the height the release lands on, as the box draws it.
    const heightText = (height: number): string | null => {
      if (collapses(height) && !free) return words.collapse;
      if (collapses(height) && collapsed) return null;
      const { lines, slots } = countAt(drawnBodyHeight(snap(height)));
      return heightReadout(lines, slots, words, format);
    };

    const widthText = (step: number, width: number, bodyHeight: number | null) => {
      if (input === null || bodyHeight === null) return widthReadout(step, null, words, format);
      return widthReadout(step, screenSlots(bodyGrid({ ...input, boxWidth: width, bodyHeight, smallMenusGrow: false })), words, format);
    };

    return { snap, hold, collapsible: !free, heightText, widthText };
  }, [input, cardHeight, textScale, translate, separators, free, collapsed]);
}
