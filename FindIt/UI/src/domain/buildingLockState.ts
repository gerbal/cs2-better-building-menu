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
 * What to tell the player they are waiting on.
 *
 * Falls back to the bare "Locked" word when we know it is locked but not why,
 * which is honest rather than lazy: some assets carry no UnlockRequirement
 * buffer at all, and inventing a reason for those is worse than admitting we
 * do not have one.
 *
 * Milestone wins when both are present. It is the coarser gate, so it has to
 * clear first, and naming a tech node behind a milestone the player has not
 * reached would send them somewhere they cannot act on.
 */
export function describeLockReason(
  entry: UnlockableEntry | null | undefined,
  milestoneNames: readonly string[] | null | undefined,
  lockedWord: string
): string {
  if (!isEntryLocked(entry)) {
    return "";
  }

  const milestone = entry?.unlockMilestone ?? 0;
  const milestoneName = milestone > 0 ? milestoneNames?.[milestone] : undefined;

  if (milestoneName) {
    return milestoneName;
  }

  const requirements = entry?.unlockRequirements ?? [];

  if (requirements.length > 0) {
    // One line's worth. A signature building can list several and the card is
    // about 184px wide, so naming the first and counting the rest beats
    // truncating a sentence mid-word.
    return requirements.length === 1
      ? requirements[0]
      : `${requirements[0]} +${requirements.length - 1}`;
  }

  return lockedWord;
}
