export interface BuildingCatalogEntry {
  id: number;
  prefabName: string;
  name: string;
  category: string;
  subCategory: string;
  categoryLabel?: string;
  subCategoryLabel?: string;
  thumbnail: string;
  /**
   * Drawn when `thumbnail` resolves to nothing. The game's thumbnail camera
   * hands back a URL for every prefab but only renders the ones vanilla shows
   * in a menu, so a spawnable zone building has a `thumbnail` that loads as an
   * empty box. Only the image's error tells us that, hence a second field
   * rather than a choice made server-side.
   */
  fallbackThumbnail?: string;
  /** A pre-blackened copy of a VECTOR thumbnail; see lockedThumbnail. */
  silhouetteThumbnail?: string;
  lotWidth: number;
  lotDepth: number;
  buildingLevel: number;
  zoneType: number;
  hasParking: boolean;
  isVanilla: boolean;
  /**
   * Milestone-gated, per the game's own enableable Locked component.
   *
   * Serialised since BuildingCatalogEntry.cs wrote it, but absent from this
   * interface until now — so the field crossed the binding and then had nowhere
   * to land. No component was ignoring it; the type made it unreachable.
   */
  isLocked: boolean;
  /** Only one may exist in a city. Vanilla badges these whether built or not. */
  isUnique: boolean;
  /** A unique the city already holds one of — unbuildable, but not locked. */
  isAlreadyBuilt: boolean;
  /**
   * Milestone index the asset waits on, 0 for none. Meaningful only while
   * isLocked. An index rather than a name because the ~20 names arrive once in
   * their own table — see BuildingLensMilestones.
   */
  unlockMilestone: number;
  devTreeBranch?: string | null;
  devTreeBranchDepth?: number | null;
  /**
   * Everything else it waits on, already localized. Signature buildings are the
   * reason this exists: they hang off requirement prefabs rather than
   * milestones, and those have no shared ordinal to look up.
   */
  unlockRequirements: string[];
  /**
   * What the building does for the city, already phrased. Signature buildings
   * cost nothing, so this is the whole basis for choosing between them.
   */
  bonuses: string[];
  /**
   * Cost and upkeep are per kilometre rather than per instance — true for
   * networks, which price by length. Without this the figures invite a
   * comparison they do not support: 12,500 for a road is a rate, 12,500 for a
   * hospital is a total.
   */
  costIsPerDistance: boolean;
  /** Approximate parking bays; 0 for none. See hasParking for the plain fact. */
  parkingSlots: number;
  pdxModsId: string;
  buildingType: string;
  /** SchoolData tier: 1 elementary, 2 high school, 3 college, 4 university. */
  educationLevel?: number | null;
  provenance: string;
  dlcId: string;
  theme: string;
  assetPacks: string[];
  placementFlags: string[];
  /**
   * Whether this asset IS an upgrade, tagged with its own name.
   *
   * Never a list of what can be attached TO it — see supportedUpgrades. The
   * backend reads a non-empty value the way vanilla's FilterOutUpgrades does
   * and drops the entry from every menu, so anything the player can see here
   * necessarily has this empty.
   */
  extensions?: string[];
  /** The upgrades that can be attached to this building later. */
  supportedUpgrades?: string[];
  constructionCost: number | null;
  upkeep: number | null;
  workers: number | null;
  /** Households the building holds; null when it is not residential. */
  households?: number | null;
  capacity: number | null;
  /** How far the building's service reaches, in metres. */
  serviceRange?: number | null;
  /** Service figures beyond the headline capacity — see serviceFacts.ts. */
  serviceFacts?: { key: string; value: number }[] | null;
  /** A network's speed limit in km/h; absent for anything else. */
  speedLimit?: number | null;
  /** How wide a network draws, in metres; absent for anything else. */
  networkWidth?: number | null;
  /** The game's own LeisureType name, or "" — see leisureLabel. */
  leisureType?: string;
  leisureEfficiency?: number | null;
  electricityConsumption: number | null;
  waterConsumption: number | null;
  garbageAccumulation: number | null;
  waterCapacity: number | null;
  sewageCapacity: number | null;
  groundPollution: number | null;
  airPollution: number | null;
  noisePollution: number | null;
  /**
   * The headings this entry falls under for the page's effective grouping,
   * outermost first. C# stamps it on every page item when the page is
   * grouped; empty when it is not. See groupTreeFromPaths.
   */
  groupPath?: string[];
  /** The game's own id behind the outer heading, where there is one; "" otherwise. */
  groupLabelId?: string;
}

export function formatBuildingCatalogLabels(
  entry: Pick<BuildingCatalogEntry, "category" | "subCategory" | "categoryLabel" | "subCategoryLabel">
): string {
  const category = entry.categoryLabel?.trim() || entry.category;
  const subCategory = entry.subCategoryLabel?.trim() || entry.subCategory;

  return [category, subCategory].filter((value) => value.length > 0).join(" · ");
}

export interface BuildingCatalogPage {
  items: BuildingCatalogEntry[];
  totalCount: number;
  offset: number;
  limit: number;
  /**
   * Whether the backend has more matches than this window holds.
   *
   * C#'s answer, not a client comparison of rendered against total: only the
   * backend knows both the match count and the window ceiling, so a client
   * computing `rendered < total` would keep offering rows the backend has
   * already refused to serve.
   */
  hasMore?: boolean;

  /**
   * The offered sort fields that could actually move a row of these results.
   *
   * cm-ddw3. The picker drops the rest — a control that responds while the
   * list does not is the signature of a broken one. C#'s answer, because only
   * the backend sees the whole matched set rather than the page.
   */
  reorderableSortColumns?: string[];
}
