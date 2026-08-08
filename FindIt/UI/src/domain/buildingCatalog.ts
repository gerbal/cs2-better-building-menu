export interface BuildingCatalogEntry {
  id: number;
  prefabName: string;
  name: string;
  category: string;
  subCategory: string;
  categoryLabel?: string;
  subCategoryLabel?: string;
  vanillaSection?: string;
  vanillaSubCategory?: string;
  thumbnail: string;
  /**
   * Drawn when `thumbnail` resolves to nothing. The game's thumbnail camera
   * hands back a URL for every prefab but only renders the ones vanilla shows
   * in a menu, so a spawnable zone building has a `thumbnail` that loads as an
   * empty box. Only the image's error tells us that, hence a second field
   * rather than a choice made server-side.
   */
  fallbackThumbnail?: string;
  lotWidth: number;
  lotDepth: number;
  buildingLevel: number;
  zoneType: number;
  hasParking: boolean;
  isUniqueMesh: boolean;
  isVanilla: boolean;
  /**
   * Milestone-gated, per the game's own enableable Locked component.
   *
   * Serialised since BuildingCatalogEntry.cs wrote it, but absent from this
   * interface until now — so the field crossed the binding and then had nowhere
   * to land. No component was ignoring it; the type made it unreachable.
   */
  isLocked: boolean;
  isFavorited: boolean;
  pdxModsId: string;
  buildingType: string;
  /** SchoolData tier: 1 elementary, 2 high school, 3 college, 4 university. */
  educationLevel?: number | null;
  provenance: string;
  dlcId: string;
  theme: string;
  assetPacks: string[];
  placementFlags: string[];
  extensions?: string[];
  constructionCost: number | null;
  upkeep: number | null;
  workers: number | null;
  capacity: number | null;
  electricityConsumption: number | null;
  waterConsumption: number | null;
  garbageAccumulation: number | null;
  waterCapacity: number | null;
  sewageCapacity: number | null;
  groundPollution: number | null;
  airPollution: number | null;
  noisePollution: number | null;
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
}
