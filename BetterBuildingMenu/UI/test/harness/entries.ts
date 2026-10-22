import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import type { BuildingCatalogBindingPage } from "mods/bindings";

// Catalog data for unit and render tests alike: this module installs nothing on import.

/** A catalog entry the components accept, with every field a row reads. */
export function entry(id: number, over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry {
  return {
    id,
    prefabName: `Prefab${id}`,
    name: `Building ${id}`,
    category: "ServiceBuildings",
    subCategory: "ServiceBuildings_Health",
    categoryLabel: "Services",
    subCategoryLabel: "Health",
    thumbnail: "",
    lotWidth: 4,
    lotDepth: 4,
    buildingLevel: 1,
    zoneType: 0,
    hasParking: false,
    isVanilla: true,
    pdxModsId: "",
    constructionCost: 1000,
    upkeep: 10,
    workers: 5,
    capacity: 20,
    electricityConsumption: null,
    waterConsumption: null,
    garbageAccumulation: null,
    waterCapacity: null,
    sewageCapacity: null,
    groundPollution: null,
    airPollution: null,
    noisePollution: null,
    groupPath: [],
    groupLabelId: "",
    ...over,
  } as BuildingCatalogEntry;
}

/** The page binding's shape, ready for the BuildingCatalog binding. */
export function catalogPage(items: BuildingCatalogEntry[], over: Partial<BuildingCatalogBindingPage> = {}): BuildingCatalogBindingPage {
  return {
    items,
    totalCount: items.length,
    offset: 0,
    limit: 100,
    hasMore: false,
    status: "ready",
    reorderableSortColumns: [],
    ...over,
  };
}
