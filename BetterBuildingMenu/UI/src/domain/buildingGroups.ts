/**
 * Grouping: the dimensions a menu's result can be grouped by. It is a primary
 * SORT KEY, not a separate axis — under paging an independent grouping splits a
 * group across a page and the heading lies. C# owns the key, the labels and the
 * sections the bodies draw them from (see CatalogSection).
 */

import { GROUP_DIMENSION_IDS, type GroupDimensionId } from "./sharedContracts.generated";

// C# owns the ids and their order; see sharedContracts.generated.ts.
export type { GroupDimensionId };

export interface GroupDimension {
  id: GroupDimensionId;
  label: string;
  /** How many heading levels this dimension yields. */
  depth: number;
}

/** What the picker calls each dimension, and how many heading levels it yields. */
const GROUP_DIMENSION_PRESENTATION: Readonly<Record<GroupDimensionId, Omit<GroupDimension, "id">>> = {
  // Depth 2: the menu's tab, then the tier within it — see C#'s CategoryTierLabel. Named for the
  // tab the player sees, as the top row's Group says it.
  menuCategory: { label: "By tab", depth: 2 },
  // Ours, not the game's: Buildings, Networks, Service Buildings. Named "Asset
  // type" so it does not compete with the game's own word for a different idea.
  category: { label: "Asset type", depth: 2 },
  subCategory: { label: "Type", depth: 1 },
  role: { label: "Role", depth: 1 },
  // Narrow on purpose, but so is Role outside a service menu, and the picker
  // is opened deliberately.
  schoolTier: { label: "School tier", depth: 1 },
  // The one tier every asset has: when the game lets you build it, which is
  // the axis the player is moving along.
  progression: { label: "Progression", depth: 1 },
  // On the big menus it chunks the set where the milestone split yields only
  // a bucket or two.
  development: { label: "Development", depth: 1 },
  theme: { label: "Theme", depth: 1 },
  source: { label: "Source", depth: 1 },
  density: { label: "Density", depth: 1 },
  footprint: { label: "Footprint", depth: 1 },
  cost: { label: "Cost", depth: 1 },
  // "No groups": beside Sort's and Filter's values, a bare "None" reads as no grouping chosen.
  none: { label: "No groups", depth: 0 },
};

/**
 * Offered in the picker, in C#'s order. Array-valued dimensions — asset packs,
 * placement flags, extensions — are absent: an entry belongs to several of
 * each, so the group counts would no longer sum to the result total.
 */
export const GROUP_DIMENSIONS: readonly GroupDimension[] = GROUP_DIMENSION_IDS.map((id) => ({
  id,
  ...GROUP_DIMENSION_PRESENTATION[id],
}));

/**
 * The menu whose assets carry a school tier. Matched loosely on the menu's own
 * prefab name — UIAssetMenuPrefab.name, never display text — so a rename or a
 * variant still resolves. C# makes the same test in VanillaMenus.IsEducation.
 */
export function isEducationMenu(menu: string | null | undefined): boolean {
  return /education/i.test(menu ?? "");
}

/**
 * The grouping choices worth offering, in picker order. C# decides which can
 * act on the current menu, since one that puts everything in a single bucket is
 * a control that cannot act; an empty list means it has not said yet.
 */
export function groupDimensionsFor(
  offeredIds: readonly string[] | null | undefined
): readonly GroupDimension[] {
  const offered = offeredIds ?? [];

  if (offered.length === 0) {
    return GROUP_DIMENSIONS;
  }

  return GROUP_DIMENSIONS.filter((dimension) => offered.includes(dimension.id));
}

/** What C# files an entry under when the dimension has no value for it. */
export const UNGROUPED_LABEL = "Other";

export function groupDimensionLabel(id: GroupDimensionId): string {
  return GROUP_DIMENSIONS.find((dimension) => dimension.id === id)?.label ?? id;
}
