import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { useMemo } from "react";

import { clampAssetMenuHeight } from "domain/assetMenuLayout";
import { groupDigits } from "domain/assetMenuMetricFormat";
import { bodyGrid, lineSpacing, screenSlots, type LineSpacing } from "domain/bodyGeometry";
import { heightReadout, snapToLines, type EdgeWords } from "domain/boxEdges";
import { cardGeometry, cardLineSpacing } from "domain/cardsLayout";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuTopEdge$, AssetMenuTuning$, SHIPPED_TUNING } from "mods/bindings";
import { useBodyGridInput } from "mods/BuildingCatalog/useBodyGrid";
import { useNumberSeparators } from "mods/Bodies/useBodyWords";
import { useMenuBody } from "mods/useMenuBody";

/** What the box's edges read of the open body: where a release lands, and what the readout says during a drag. */
export interface BoxEdges {
  /** Where a release of the top edge lands: whole lines of the open body, or under Top edge's Free where it is let go. */
  snap: (height: number) => number;
  /** What the readout says while the top edge is dragged to this height. */
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
  const input = useBodyGridInput(body);
  const textScale = useTextScale();
  const cardHeight = useValue(AssetMenuTuning$).cardHeight ?? SHIPPED_TUNING.cardHeight;
  const separators = useNumberSeparators();
  // Top edge's Free keeps the height where the pointer lets go, held to the drag's range.
  const free = useValue(AssetMenuTopEdge$) === "free";

  return useMemo(() => {
    const spacing: LineSpacing = input === null ? cardLineSpacing(cardHeight, textScale) : lineSpacing(input);
    const words: EdgeWords = {
      lines: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLines]", "{0} lines · {1} buildings (game: {2})") ?? "{0} lines · {1} buildings (game: {2})",
      linesOnly: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragLinesOnly]", "{0} lines (game: {1})") ?? "{0} lines (game: {1})",
    };
    const format = (count: number) => groupDigits(count, separators);
    const snap = free ? clampAssetMenuHeight : (height: number) => snapToLines(height, spacing);
    // The slots the body would show at the height the release lands on; the cards' rows alone, as a card is as wide as its words.
    const heightText = (height: number) => {
      const landed = snap(height);
      if (input === null) return heightReadout(cardGeometry(cardHeight, landed, textScale).lines, null, words, format);
      const grid = bodyGrid({ ...input, bodyHeight: landed, smallMenusGrow: false });
      return heightReadout(grid.lines, screenSlots(grid), words, format);
    };

    return { snap, heightText };
  }, [input, cardHeight, textScale, translate, separators, free]);
}
