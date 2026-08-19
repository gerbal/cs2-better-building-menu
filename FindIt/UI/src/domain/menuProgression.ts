/** The tier value that narrows nothing. Mirrors BuildingCatalogQuery.AnyMilestone. */
export const ANY_MILESTONE = -1;

/** One tier's share of the menu, published beside the milestone names. */
export interface MenuMilestoneCount {
  milestone: number;
  count: number;
}

/**
 * A tier tab, ready to draw.
 *
 * The name is joined on this side rather than shipped by the backend: the
 * milestone names are already published once, densely by index, and a second
 * copy travelling with the counts would be a second thing to keep in the
 * current language.
 */
export interface MilestoneTab {
  milestone: number;
  label: string;
  count: number;
}

/**
 * The tier tabs for a menu, in progression order.
 *
 * Ordered by index because the index IS the progression — unlike the category
 * strip, where the order is only for stability. The backend already sorts them;
 * sorting again here means the strip is right even when a binding arrives out
 * of order, which is cheap at ~20 entries.
 */
export function milestoneTabs(
  counts: readonly MenuMilestoneCount[] | null | undefined,
  // Passed in rather than imported. The naming rule lives in buildingGroups,
  // beside the progression GROUP dimension that uses the same one, and the
  // domain modules here are deliberately import-free of each other: the test
  // runner strips types rather than resolving a bundler's paths, so a value
  // import between two of them resolves in webpack and nowhere else.
  label: (milestone: number) => string
): MilestoneTab[] {
  return (counts ?? [])
    .filter((entry) => typeof entry?.milestone === "number" && entry.milestone >= 0)
    .slice()
    .sort((a, b) => a.milestone - b.milestone)
    .map((entry) => ({
      milestone: entry.milestone,
      label: label(entry.milestone),
      count: entry.count ?? 0,
    }));
}

/**
 * Whether the tier strip is worth drawing.
 *
 * The same rule the category strip follows: one tab covering everything is a
 * control that offers no choice. It matters more here, because EVERY menu has
 * a progression axis and most of the small ones sit entirely in one tier.
 */
export function shouldShowMilestoneTabs(tabs: readonly MilestoneTab[] | null | undefined): boolean {
  return (tabs ?? []).length > 1;
}

export function isMilestoneSelected(
  milestone: number,
  selected: number | null | undefined
): boolean {
  return (selected ?? ANY_MILESTONE) === milestone;
}
