import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { installVanillaRegistry } from "./vanillaRegistry";

// Every render test imports this module, so the resolver is seeded once.
installVanillaRegistry();

/** What a component draws, as markup. Effects do not run; hooks do. */
export const renderHtml = (element: ReactElement): string => renderToStaticMarkup(element);

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

/** The page binding's shape, ready for setBinding("BetterBuildingMenu", "BuildingCatalog", …). */
export function catalogPage(items: BuildingCatalogEntry[], over: Record<string, unknown> = {}): Record<string, unknown> {
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

/** How many times a pattern occurs in the markup. */
export const count = (html: string, pattern: RegExp): number =>
  (html.match(new RegExp(pattern.source, "g")) ?? []).length;
