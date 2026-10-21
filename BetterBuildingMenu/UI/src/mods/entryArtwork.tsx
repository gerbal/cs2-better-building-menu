/**
 * The picture and the unique badge every view draws on a building, each styled
 * with the calling view's own classes. Functions rather than components, so a
 * row draws them inline with nothing more to render.
 */

import classNames from "classnames";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { canPlace, isEntryAlreadyBuilt, lockedThumbnail } from "domain/buildingLockState";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";

/** The building's picture, silhouetted when it cannot be placed. Decoration: the control around it carries the name. */
export function entryThumbnail(entry: BuildingCatalogEntry, className: string): JSX.Element | null {
  return entry.thumbnail
    ? (
      <img
        className={className}
        src={lockedThumbnail(entry, !canPlace(entry))}
        onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
        alt=""
        aria-hidden="true"
      />
    )
    : null;
}

/** A view's classes for the unique badge: the badge's own, then one for each state. */
export interface UniqueBadgeClasses {
  badge: string;
  unique: string;
  alreadyBuilt: string;
}

/**
 * Vanilla's own icons and its own two-state rule: every unique is badged, with a
 * different symbol once the city has one. An <img> rather than a masked glyph,
 * because these are full-colour icons the game ships for exactly this.
 */
export function uniqueBadge(entry: BuildingCatalogEntry, classes: UniqueBadgeClasses): JSX.Element | null {
  if (entry.isUnique !== true) {
    return null;
  }

  const built = isEntryAlreadyBuilt(entry);

  return (
    <img
      className={classNames(classes.badge, built ? classes.alreadyBuilt : classes.unique)}
      src={built ? "Media/Game/Icons/AlreadyBuilt.svg" : "Media/Game/Icons/Unique.svg"}
      alt=""
      aria-hidden="true"
    />
  );
}
