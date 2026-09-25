/** One lot shape, in cells. */
export interface LotFootprint {
  width: number;
  depth: number;
}

/**
 * One effect, as vanilla's modifier binders bind it: the delta, unrounded, and
 * the game's unit for it ("percentage" or "floatSingleFraction"). The label is
 * the indexer's, the effect's type in words.
 */
export interface EffectLine {
  label: string;
  delta: number;
  unit: string;
}

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
   * Drawn when `thumbnail` resolves to nothing. The game hands back a URL for
   * every prefab but only renders the ones vanilla shows in a menu, and only
   * the image's error says which — hence a second field, not a server choice.
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
  /** Milestone-gated, per the game's own enableable Locked component. */
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
   * What the building does for the city, one entry per effect, its number left
   * for the card to format. Signature buildings cost nothing, so this is the
   * whole basis for choosing between them.
   */
  bonuses: EffectLine[];
  /**
   * Cost and upkeep are per kilometre rather than per instance, as a network's
   * are. Without it the figures invite a comparison they do not support: a
   * road's number is a rate and a hospital's is the whole bill.
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
   * Whether this asset IS an upgrade, tagged with its own name — never a list
   * of what attaches TO it, which is supportedUpgrades. A non-empty value drops
   * the entry from every menu, as vanilla's own filter does.
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
  /**
   * Lot shapes a zone grows, drawn as little grids by FootprintGlyph. DECLARED
   * rather than cast-read at each surface, because a cast compiles whether or
   * not anything produces the field and hides the gap.
   */
  footprints?: LotFootprint[] | null;
  footprintOverflow?: number | null;
  /** Figures that are words rather than numbers — see serviceFacts.ts. */
  serviceTextFacts?: { key: string; value: string }[] | null;
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
  telecomNeed?: number | null;
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
   * Whether the backend has more matches than this window holds. C#'s answer,
   * because only it knows both the match count and the window ceiling; a client
   * comparison would offer rows the backend has already refused to serve.
   */
  hasMore?: boolean;

  /**
   * The row Enter arms while a search is active; null without a search or a
   * result. C#'s answer, because only it scores, and a grouped page is ordered
   * by group before relevance.
   */
  bestMatchId?: number | null;

  /** The search this page answers; it trails the box by the search debounce. */
  searchText?: string;

  /**
   * The offered sort fields that could actually move a row of these results;
   * the picker drops the rest, a control that responds while the list does not
   * reading as broken. C#'s answer, since only it sees the whole matched set.
   */
  reorderableSortColumns?: string[];
}
