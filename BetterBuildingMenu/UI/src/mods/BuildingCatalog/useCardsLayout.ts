import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import { useMemo } from "react";

import { BODY_SIDE_MARGIN, drawnBodyHeight } from "domain/assetMenuLayout";
import { groupDigits } from "domain/assetMenuMetricFormat";
import { bodyOrder, NO_SECTIONS } from "domain/bodyCells";
import type { DrawnBody } from "domain/bodyChoice";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { cardGeometry, cardText, cardWidth, labelWidth, packCards, type CardGeometry, type CardText } from "domain/cardsLayout";
import { sortedMetricFor } from "domain/sortedMetric";
import { sectionLabel } from "domain/vanillaServiceLabels";
import { useTextScale } from "domain/textScaleSetting";
import { useBlockLabels } from "mods/Bodies/useBodyCells";
import { useNumberSeparators, useStateWords } from "mods/Bodies/useBodyWords";
import { AssetMenuHeight$, AssetMenuTuning$, BuildingCatalogSortColumn$, SHIPPED_TUNING } from "mods/bindings";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { screenPixelRem } from "./useBodyGrid";

/** Where a cell sits in the cards' box, and how big it is, in rem. */
export interface CardPlace {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CardCell =
  | { kind: "label"; section: CatalogSection; place: CardPlace }
  | { kind: "item"; entry: BuildingCatalogEntry; text: CardText; place: CardPlace };

export interface CardsLayout {
  geometry: CardGeometry;
  cells: CardCell[];
  /** The cards' box's height: every row the window holds. */
  height: number;
  /** How many buildings one screen of the body shows: the cards in its rows. */
  screen: number;
}

const thousandths = (rem: number): number => Math.round(rem * 1000) / 1000;

/**
 * The Cards body's cells, each placed by the row packer from the words it draws, at the box's width,
 * the body's height, the text scale and the Card height knob; null for any other body. Read by the
 * catalog, which tells C# the screen, and drawn by the body. See docs/design-notes.md, "The cards".
 */
export function useCardsLayout(
  body: DrawnBody,
  entries: readonly BuildingCatalogEntry[],
  sections: readonly CatalogSection[] = NO_SECTIONS,
  offset: number = 0,
): CardsLayout | null {
  const { menuWidth } = useAssetMenuLayout();
  const bodyHeight = drawnBodyHeight(useValue(AssetMenuHeight$));
  const textScale = useTextScale();
  const knob = useValue(AssetMenuTuning$).cardHeight ?? SHIPPED_TUNING.cardHeight;
  const blockLabels = useBlockLabels();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const separators = useNumberSeparators();
  const lockedWord = useStateWords().locked;
  const { translate } = useLocalization();
  // "MS n" only for a milestone ahead of the city: past it, only the development tree holds a building back.
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  const pixelRem = screenPixelRem();

  return useMemo(() => {
    if (body !== "cards") return null;

    const geometry = cardGeometry(knob, bodyHeight, textScale, pixelRem);
    const rowWidth = Math.max(0, menuWidth - 2 * BODY_SIDE_MARGIN);
    const order = bodyOrder(entries, sections, offset).map((next) => next.kind === "item"
      ? { ...next, text: cardText(next.entry, sortedMetric, separators, lockedWord, achievedMilestone) }
      : next);
    // A label is sized from the words its plate draws, the game's in the player's language.
    const packed = packCards(order.map((next) => next.kind === "item"
      ? { width: cardWidth(next.text, textScale) }
      : {
          width: labelWidth(sectionLabel(next.section, (key) => translate(key, null), lockedWord), groupDigits(next.section.count, separators), textScale),
          ownLine: blockLabels === "ownLine",
        }), rowWidth);
    // Whole thousandths of a rem: the widths' sums carry float noise into the inline style.
    const placeOf = (at: number): CardPlace => ({
      left: thousandths(packed[at].left),
      top: thousandths(geometry.y0 + packed[at].row * geometry.pitchY),
      width: thousandths(packed[at].width),
      height: thousandths(geometry.height),
    });
    const cells: CardCell[] = order.map((next, at) => next.kind === "item"
      ? { kind: "item", entry: next.entry, text: next.text, place: placeOf(at) }
      : { kind: "label", section: next.section, place: placeOf(at) });
    const rows = packed.length === 0 ? 0 : packed[packed.length - 1].row + 1;

    return {
      geometry,
      cells,
      height: rows === 0 ? 0 : geometry.y0 + rows * geometry.pitchY - geometry.rowGap,
      screen: cells.filter((cell, at) => cell.kind === "item" && packed[at].row < geometry.lines).length,
    };
  }, [body, entries, sections, offset, knob, bodyHeight, textScale, pixelRem, menuWidth, blockLabels, sortedMetric, separators, lockedWord, translate, achievedMilestone]);
}
