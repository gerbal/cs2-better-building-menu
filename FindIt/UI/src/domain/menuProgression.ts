/** The tier value that narrows nothing. Mirrors BuildingCatalogQuery.AnyMilestone. */
export const ANY_MILESTONE = -1;

/** One tier's share of the menu, published beside the milestone names. */
export interface MenuBranchCount {
  id: string;
  count: number;
  icon: string;
}

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
  icon: string;
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
  counts: readonly MenuBranchCount[] | null | undefined,
  // Passed in rather than imported. The naming rule lives in buildingGroups,
  // beside the progression GROUP dimension that uses the same one, and the
  // domain modules here are deliberately import-free of each other: the test
  // runner strips types rather than resolving a bundler's paths, so a value
  // import between two of them resolves in webpack and nowhere else.
  label: (milestone: number) => string
): MilestoneTab[] {
  return (counts ?? [])
    .map((entry) => ({
      milestone: Number(entry.id),
      count: entry.count ?? 0,
      icon: entry.icon ?? "",
    }))
    .filter((entry) => Number.isFinite(entry.milestone) && entry.milestone >= 0)
    .sort((a, b) => a.milestone - b.milestone)
    .map((entry) => ({
      milestone: entry.milestone,
      label: label(entry.milestone),
      count: entry.count,
      icon: entry.icon,
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

/** One school-level tab, ready to draw. */
export interface SchoolTierTab {
  level: number;
  label: string;
  count: number;
  icon: string;
}

/**
 * The education menu's tier tabs, in career order.
 *
 * The backend keys these by the raw SchoolData.m_EducationLevel so the four
 * labels stay in one place — SCHOOL_TIERS in buildingGroups — rather than
 * being duplicated across the binding. Ordered by level, which is the career
 * order the alphabet gets wrong: College sorts before High School and before
 * University, and only one of those is right.
 */
export function schoolTierTabs(
  counts: readonly MenuBranchCount[] | null | undefined
): SchoolTierTab[] {
  return (counts ?? [])
    .map((entry) => ({ level: Number(entry.id), count: entry.count ?? 0, icon: entry.icon ?? "" }))
    .filter((entry) => Number.isFinite(entry.level) && entry.level >= 1)
    .sort((a, b) => a.level - b.level)
    .map((entry) => ({
      level: entry.level,
      label: schoolTierLabel(entry.level),
      count: entry.count,
      icon: entry.icon,
    }));
}

/**
 * The game's own word for a school level.
 *
 * Kept here rather than imported from buildingGroups: the domain modules do
 * not import each other by value, because the test runner strips types instead
 * of resolving the bundler's paths. The four rows are the game's SchoolLevel
 * enum and do not move; buildingGroups.SCHOOL_TIERS is the other copy, and
 * menuProgression.test.ts pins them to the same words.
 */
export function schoolTierLabel(level: number): string {
  switch (level) {
    case 1:
      return "Elementary School";
    case 2:
      return "High School";
    case 3:
      return "College";
    case 4:
      return "University";
    default:
      return `Level ${level}`;
  }
}
