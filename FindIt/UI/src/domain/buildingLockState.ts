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
  isAlreadyBuilt?: boolean;
}

/**
 * Strict `=== true`, because absent is not locked.
 *
 * Zones now carry the field — zoneAsCatalogEntry passes it through from the
 * indexer, which reads the same enableable Locked component the building index
 * does. Before that they never did, and a locked zone drew exactly like an
 * unlocked one. The strictness still matters: "we were never told" has to read
 * as placeable, because a placement guard that defaults to refusing would make
 * every asset that skips the field unbuildable.
 */
export function isEntryLocked(entry: LockableEntry | null | undefined): boolean {
  return entry?.isLocked === true;
}

/**
 * A unique the city already holds one of.
 *
 * Not locked — the progression allows it and the padlock would say the wrong
 * thing — but not placeable either, which is the part the menu has to show.
 */
export function isEntryAlreadyBuilt(entry: LockableEntry | null | undefined): boolean {
  return entry?.isAlreadyBuilt === true;
}

/**
 * The rules Place has to obey. Vanilla refuses the same selections.
 *
 * Already-built joined locked here: the tile looked ordinary and clicking it
 * armed a placement the game would then refuse, which reads as the menu being
 * broken rather than as the city already having one.
 */
export function canPlace(entry: LockableEntry | null | undefined): boolean {
  return !isEntryLocked(entry) && !isEntryAlreadyBuilt(entry);
}

/**
 * The word for why an asset cannot be placed, or null when it can.
 *
 * One function for all four view modes. The grid, list, cards and table each
 * wrote their own version of this test, and the GroupedResults header already
 * records what that costs: they had drifted into three different answers about
 * the same asset once before. Locked wins over already-built for the same
 * reason AvailabilityOf orders them that way — a locked unique cannot have been
 * built, so if both ever read true the data is wrong and Locked is the safer
 * thing to say.
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
