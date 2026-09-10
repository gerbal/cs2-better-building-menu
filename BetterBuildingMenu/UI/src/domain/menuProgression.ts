/** The tier value that narrows nothing. Mirrors BuildingCatalogQuery.AnyMilestone. */
export const ANY_MILESTONE = -1;

/** One tier's share of the menu, published beside the milestone names. */
export interface MenuBranchCount {
  id: string;
  count: number;
  icon: string;
  /**
   * What the tab says, where that differs from what it matches on. A density
   * tier repeats across families, so its id carries the family too and only
   * this is shown; a development branch is unique and needs neither.
   */
  label?: string;
}

/** One category's sub-tabs, drawn in its place in the strip. */
export interface MenuCategoryTabs {
  categoryId: string;
  tabs: MenuBranchCount[];
}

/**
 * The sub-tabs that stand in for one category, or none. A lookup rather than a
 * single expanded id, because zone families need three expanded at once.
 */
export function expandedTabsFor(
  categories: readonly MenuCategoryTabs[] | null | undefined,
  categoryId: string
): MenuBranchCount[] {
  return categories?.find((entry) => entry.categoryId === categoryId)?.tabs ?? [];
}

/** What a tab draws. Falls back to its match key, as the C# record does. */
export function branchTabLabel(tab: MenuBranchCount | null | undefined): string {
  const label = (tab?.label ?? "").trim();

  return label !== "" ? label : tab?.id ?? "";
}

/**
 * What a tab's tooltip says, which is more than the tab carries: a density tab
 * is drawn IN ITS FAMILY'S PLACE, so nothing else on the row names the family.
 * `label` marks those; a self-naming development branch has none.
 */
export function branchTabTooltip(
  tab: MenuBranchCount | null | undefined,
  categoryLabel: string | null | undefined
): string {
  const tier = (tab?.label ?? "").trim();

  if (tier === "") {
    return tab?.id ?? "";
  }

  const family = (categoryLabel ?? "").trim();

  return family === "" ? tier : `${tier} ${family}`;
}

export interface MenuMilestoneCount {
  milestone: number;
  count: number;
}

/**
 * A tier tab, ready to draw. The name is joined on this side because the
 * milestone names are already published once by index, and a second copy
 * travelling with the counts is a second thing to keep in the player's language.
 */
export interface MilestoneTab {
  milestone: number;
  label: string;
  count: number;
  icon: string;
}

/**
 * The tier tabs for a menu, ordered by index because the index IS the
 * progression — unlike the category strip, where order is only for stability.
 * Sorted again here so an out-of-order binding cannot mislead the strip.
 */
export function milestoneTabs(
  counts: readonly MenuBranchCount[] | null | undefined,
  // Passed in, not imported: the naming rule lives in buildingGroups beside the
  // progression group dimension, and these domain modules stay import-free of
  // each other so the type-stripping test runner can load each on its own.
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
 * Whether the tier strip is worth drawing — the category strip's rule, that one
 * tab covering everything offers no choice. It matters more here: every menu
 * has a progression axis, and the small ones sit entirely in one tier.
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
 * The education menu's tier tabs, in career order. Keyed by the raw
 * SchoolData.m_EducationLevel so the labels stay in one place, and ordered by
 * level because the alphabet puts College before High School.
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
 * The game's own word for a school level. Kept here rather than imported,
 * because these domain modules do not import each other by value; the words are
 * the game's SchoolLevel enum, and a test pins them to buildingGroups' copy.
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


/**
 * The rank a school-level tab draws over its glyph. Roman, because an arabic
 * numeral would read as a COUNT — every other number on this row is one. Stops
 * at IV, the game's whole range, rather than pretend to be a converter.
 */
export function romanNumeral(level: number): string {
  switch (level) {
    case 1:
      return "I";
    case 2:
      return "II";
    case 3:
      return "III";
    case 4:
      return "IV";
    default:
      return String(level);
  }
}
