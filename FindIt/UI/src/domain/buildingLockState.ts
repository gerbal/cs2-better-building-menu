/**
 * Whether an asset is still behind a milestone, and what follows from that.
 *
 * Vanilla's answer, read off the shipped bundle: a locked asset is SHOWN, not
 * hidden. Its tile is disabled — the click plays the disabled sound instead of
 * selecting — and its thumbnail is drawn as a black silhouette. Hiding locked
 * assets instead would be a worse fit here than it is in vanilla, because the
 * whole point of this panel is "the thing exists and I can find it"; a search
 * that silently returns nothing for a building the player knows is in the game
 * is the failure mode the mod exists to remove. The Availability facet is the
 * place to hide them, deliberately and visibly.
 *
 * Note on what we cannot show: vanilla does NOT bind unlock requirements per
 * asset. BindAsset writes twelve properties — entity, name, priority, icon,
 * dlc, theme, locked, uiTag, highlight, unique, placed, constructionCost — and
 * requirements is not among them; it is bound on the toolbar MENU ITEM, and
 * per-asset requirements live only on PrefabDetails, keyed by an ECS entity our
 * catalog entry does not carry. So "unlocks at milestone N" is not available
 * without new indexing, and this module deliberately does not pretend otherwise.
 */

/** Just enough of an entry to answer the question. */
export interface LockableEntry {
  isLocked?: boolean;
}

/**
 * Strict `=== true`, because absent is not locked.
 *
 * Zones reach the catalog through zoneAsCatalogEntry, which builds an entry
 * without this field. "We were never told" has to read as placeable — a
 * placement guard that defaults to refusing would make every zone unbuildable.
 */
export function isEntryLocked(entry: LockableEntry | null | undefined): boolean {
  return entry?.isLocked === true;
}

/** The one rule Place has to obey. Vanilla refuses the same selection. */
export function canPlace(entry: LockableEntry | null | undefined): boolean {
  return !isEntryLocked(entry);
}

export interface UnlockableEntry extends LockableEntry {
  unlockMilestone?: number;
  unlockRequirements?: string[];
}

/**
 * Everything the player is waiting on, in the order it gates them.
 *
 * A list, not a sentence. A signature building can sit behind a milestone AND a
 * tech node AND a zone target, and three conditions run together on one line
 * read as one long condition — the reader has to find the separators before
 * they can count them. One per line is countable at a glance.
 *
 * Milestone leads because it is the coarsest gate and clears first.
 *
 * Falls back to the bare "Locked" word when we know it is locked but not why,
 * which is honest rather than lazy: some assets carry no UnlockRequirement
 * buffer at all, and inventing a reason for those is worse than admitting we
 * do not have one.
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
