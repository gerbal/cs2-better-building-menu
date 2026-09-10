/**
 * Whether an asset is still behind a milestone, and what follows. Locked assets
 * are shown and disabled, never hidden: a search that finds nothing for a
 * building the player knows exists is the failure this mod removes.
 */

/** Just enough of an entry to answer the question. */
export interface LockableEntry {
  isLocked?: boolean;
  isAlreadyBuilt?: boolean;
}

/**
 * Strict `=== true`, because absent is not locked: a placement guard that
 * defaults to refusing would make every asset that omits the field
 * unbuildable.
 */
export function isEntryLocked(entry: LockableEntry | null | undefined): boolean {
  return entry?.isLocked === true;
}

/**
 * A unique the city already holds one of. Not locked — the padlock would say
 * the wrong thing — but not placeable either, which the menu has to show.
 */
export function isEntryAlreadyBuilt(entry: LockableEntry | null | undefined): boolean {
  return entry?.isAlreadyBuilt === true;
}

/**
 * The rules Place has to obey. Vanilla refuses the same selections, and a tile
 * that arms a placement the game then refuses reads as a broken menu.
 */
export function canPlace(entry: LockableEntry | null | undefined): boolean {
  return !isEntryLocked(entry) && !isEntryAlreadyBuilt(entry);
}

/**
 * The word for why an asset cannot be placed, or null when it can — one
 * function for every view mode, so they cannot drift apart. Locked wins over
 * already-built, matching AvailabilityOf: if both read true the data is wrong.
 */
export function entryStateWord(
  entry: LockableEntry | null | undefined,
  lockedWord: string,
  builtWord: string
): string | null {
  if (isEntryLocked(entry)) {
    return lockedWord;
  }

  return isEntryAlreadyBuilt(entry) ? builtWord : null;
}

export interface UnlockableEntry extends LockableEntry {
  unlockMilestone?: number;
  unlockRequirements?: string[];
}

/**
 * Everything the player is waiting on, one condition per entry so they are
 * countable at a glance; milestone leads because it is the coarsest gate.
 * Falls back to the bare locked word rather than invent a reason we lack.
 */
export function listLockConditions(
  entry: UnlockableEntry | null | undefined,
  milestoneNames: readonly string[] | null | undefined,
  lockedWord: string
): string[] {
  if (!isEntryLocked(entry)) {
    return [];
  }

  const conditions: string[] = [];
  const milestone = entry?.unlockMilestone ?? 0;
  const milestoneName = milestone > 0 ? milestoneNames?.[milestone] : undefined;

  if (milestoneName) {
    conditions.push(milestoneName);
  }

  for (const requirement of entry?.unlockRequirements ?? []) {
    // The backend can emit the same requirement twice when two branches of the
    // walk reach it; the player should not read it twice.
    if (requirement && !conditions.includes(requirement)) {
      conditions.push(requirement);
    }
  }

  return conditions.length > 0 ? conditions : [lockedWord];
}

/**
 * Whether this entry's thumbnail is a VECTOR, which decides how locked is
 * drawn: Cohtml cannot composite an effect over an SVG. See
 * docs/design-notes.md, "Locked artwork for vector thumbnails".
 */
export function hasVectorThumbnail(thumbnail: string | null | undefined): boolean {
  return /\.svg(\?|#|$)/i.test((thumbnail ?? "").trim());
}

/**
 * The artwork a row draws, given whether it can be placed. An unplaceable entry
 * swaps to the backend's pre-blackened icon rather than take vanilla's filter,
 * which Cohtml cannot apply over a vector (see hasVectorThumbnail).
 */
export function lockedThumbnail(
  entry: { thumbnail?: string | null; silhouetteThumbnail?: string | null } | null | undefined,
  unplaceable: boolean
): string {
  const thumbnail = entry?.thumbnail ?? "";

  if (!unplaceable) {
    return thumbnail;
  }

  const silhouette = (entry?.silhouetteThumbnail ?? "").trim();

  return silhouette !== "" ? silhouette : thumbnail;
}
