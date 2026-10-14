/** One tier's share of the menu, published beside the milestone names. */
export interface MenuBranchCount {
  id: string;
  count: number;
  icon: string;
  /**
   * What the tab says, where that differs from what it matches on. A density
   * tier repeats across families, so its id carries the family too and only
   * this is shown; a school tier's id is its level, and this is the game's
   * name for it; a development branch is unique and needs neither.
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

/** One school-level tab, ready to draw. */
export interface SchoolTierTab {
  level: number;
  label: string;
  count: number;
  icon: string;
}

/**
 * The education menu's tier tabs, in career order. Keyed by the raw
 * SchoolData.m_EducationLevel, and ordered by level because the alphabet puts
 * College before High School. Each says what C# named it: the game's name for
 * the level's base-game school, or the English word. A tab C# sent no label
 * for arrives with its id as the label (MenuBranchCount.DisplayLabel), and
 * the English word stands in for that too.
 */
export function schoolTierTabs(
  counts: readonly MenuBranchCount[] | null | undefined
): SchoolTierTab[] {
  return (counts ?? [])
    .map((entry) => {
      const label = (entry.label ?? "").trim();

      return {
        level: Number(entry.id),
        name: label === entry.id ? "" : label,
        count: entry.count ?? 0,
        icon: entry.icon ?? "",
      };
    })
    .filter((entry) => Number.isFinite(entry.level) && entry.level >= 1)
    .sort((a, b) => a.level - b.level)
    .map((entry) => ({
      level: entry.level,
      label: entry.name === "" ? schoolTierLabel(entry.level) : entry.name,
      count: entry.count,
      icon: entry.icon,
    }));
}

/**
 * The English word for a school level, for a tab C# sent no name for. The
 * same words as BuildingCatalogGrouping.SchoolTierLabel's fallback.
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
