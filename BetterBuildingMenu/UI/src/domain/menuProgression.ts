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

/** The shape of the game's `translate`, which answers null for a missing key. */
type Translate = (key: string, fallback: string | null) => string | null;

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
  counts: readonly MenuBranchCount[] | null | undefined,
  translate: Translate = () => null
): SchoolTierTab[] {
  return (counts ?? [])
    .map((entry) => ({ level: Number(entry.id), count: entry.count ?? 0, icon: entry.icon ?? "" }))
    .filter((entry) => Number.isFinite(entry.level) && entry.level >= 1)
    .sort((a, b) => a.level - b.level)
    .map((entry) => ({
      level: entry.level,
      label: schoolTierLabel(entry.level, translate),
      count: entry.count,
      icon: entry.icon,
    }));
}

/**
 * The name of each of the game's SchoolLevel values, under our keys: no key of
 * the game's for a school's level has turned up. C#'s
 * BuildingCatalogLabels.SchoolLevel asks for the same ones, so a tab and its
 * group heading read alike.
 */
const SCHOOL_LEVELS: Readonly<Record<number, { key: string; english: string }>> = {
  1: { key: "Tooltip.LABEL[BetterBuildingMenu.SchoolElementary]", english: "Elementary School" },
  2: { key: "Tooltip.LABEL[BetterBuildingMenu.SchoolHigh]", english: "High School" },
  3: { key: "Tooltip.LABEL[BetterBuildingMenu.SchoolCollege]", english: "College" },
  4: { key: "Tooltip.LABEL[BetterBuildingMenu.SchoolUniversity]", english: "University" },
};

/** A school level's name, in the player's language where the mod ships one. */
export function schoolTierLabel(level: number, translate: Translate = () => null): string {
  const named = SCHOOL_LEVELS[level];

  if (named) {
    return translate(named.key, named.english) ?? named.english;
  }

  return `${translate("Tooltip.LABEL[BetterBuildingMenu.Level]", "Level") ?? "Level"} ${level}`;
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
