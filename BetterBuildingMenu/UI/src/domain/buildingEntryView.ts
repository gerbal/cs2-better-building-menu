/**
 * What every view mode draws the same way for one catalog entry: its name, the
 * figure it is sorted by and the markers its stylesheet keys off. Plain
 * functions, because each runs once per row.
 */

import type { BuildingCatalogEntry } from "./buildingCatalog";
import type { AssetMenuMetric } from "./assetMenuLayout";
import { formatBuildingMetric, formatLotDimensions, hasFootprint, type NumberSeparators } from "./assetMenuMetricFormat";
import { canPlace, entryStateWord, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, type LockableEntry } from "./buildingLockState";
import type { HoverCardLabels } from "./hoverCardLines";
import { sortedMetricValue } from "./sortedMetric";

/** The name a view draws and announces: the prefab's own where the game gives none. */
export function entryLabel(entry: Pick<BuildingCatalogEntry, "name" | "prefabName">): string {
  return entry.name || entry.prefabName;
}

/**
 * Whether a view lights the entry as the armed building. `armedId` is ActivePrefabId,
 * 0 when nothing is armed. Never one that cannot be placed, which is vanilla's answer:
 * its asset tile draws no selection colour under a locked thumbnail.
 */
export function isArmedEntry(entry: LockableEntry & Pick<BuildingCatalogEntry, "id">, armedId: number): boolean {
  return armedId !== 0 && entry.id === armedId && canPlace(entry);
}

/**
 * Why an entry cannot be placed, in the hover card's words, or null when it can. Takes
 * the labels whole, so a row cannot pass `locked`, which heads the conditions, for
 * `lockedValue`, the state.
 */
export function entryStateWordOf(
  entry: LockableEntry | null | undefined,
  labels: Pick<HoverCardLabels, "lockedValue" | "alreadyBuilt">,
): string | null {
  return entryStateWord(entry, labels.lockedValue, labels.alreadyBuilt);
}

/**
 * The figure the result is ordered by, or null. `lot` prints the pair, since a
 * lone "6" reads as the whole lot; a lot of 0 × 0 or a figure the entry never
 * carried draws nothing, because the badge explains an order and a dash explains none.
 */
export function sortedBadgeText(
  entry: BuildingCatalogEntry,
  metric: AssetMenuMetric | null,
  separators: NumberSeparators,
): string | null {
  if (metric === null) {
    return null;
  }

  if (metric === "lot") {
    return hasFootprint(entry.lotWidth, entry.lotDepth) ? formatLotDimensions(entry.lotWidth, entry.lotDepth) : null;
  }

  const value = sortedMetricValue(entry, metric);

  return value === null ? null : formatBuildingMetric(value, metric, separators, entry.costIsPerDistance);
}

/** The markers on a row's root: the ground and the silhouette key off them. */
export interface EntryStateAttributes {
  readonly "data-locked": "true" | undefined;
  readonly "data-already-built": "true" | undefined;
  /** Written both ways: the silhouette rule keys off "false", as Cohtml rejects :not(). */
  readonly "data-vector-thumb": "true" | "false";
}

// Every combination, built once, so a row spreads one of these rather than a new object.
const STATE_ATTRIBUTES: readonly EntryStateAttributes[] = [0, 1, 2, 3, 4, 5, 6, 7].map((bits) => ({
  "data-locked": bits & 1 ? "true" : undefined,
  "data-already-built": bits & 2 ? "true" : undefined,
  "data-vector-thumb": bits & 4 ? "true" : "false",
}));

export function entryStateAttributes(
  entry: Pick<BuildingCatalogEntry, "isLocked" | "isAlreadyBuilt" | "thumbnail">,
): EntryStateAttributes {
  return STATE_ATTRIBUTES[
    (isEntryLocked(entry) ? 1 : 0) | (isEntryAlreadyBuilt(entry) ? 2 : 0) | (hasVectorThumbnail(entry.thumbnail) ? 4 : 0)
  ];
}
