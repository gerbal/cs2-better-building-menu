/**
 * Zones: their shape, their display order, and the hand-off that places them.
 *
 * The tree this module used to build is gone. Family → density → zones is
 * group-by-family with a density sub-level, which the shared grouped renderer
 * already does, so what remains here is the ordering those headings should read
 * in and the mapping onto a catalog entry.
 *
 * The lens owns the browsing structure but never the placement — selecting a
 * zone hands off to the game's own `toolbar.selectAsset`, keeping the
 * tool-first design's rule that native tools remain the placement authority.
 */

export interface ZoneEntry {
  id: number;
  version: number;
  prefabName: string;
  name: string;
  family: string;
  density: string;
  thumbnail: string;
}



/** Family order as the vanilla Zones menu presents its category tabs. */
export const ZONING_FAMILY_ORDER = [
  "ZoneResidential",
  "ZoneCommercial",
  "ZoneIndustrial",
  "ZoneOffice",
  "ZoneExtractors",
] as const;

/**
 * Density order low to high.
 *
 * Alphabetical would read High, Low, Medium, Row, which is meaningless for what
 * is a scale. "Row" sits between Low and Medium as it does in the game, and
 * "Any" — industrial and extractor zones, which have no tier — goes last so the
 * real tiers still read as a progression.
 */
const DENSITY_ORDER = ["Low", "Row", "Medium", "High", "Signature", "Any"];

function densityRank(density: string): number {
  const index = DENSITY_ORDER.indexOf(density);

  return index < 0 ? DENSITY_ORDER.length : index;
}

/**
 * Orders zones the way their headings should read: family, then density tier,
 * then name.
 *
 * This ordering used to live inside buildZoningHierarchy, which built the tree
 * itself. The shared grouped renderer builds the tree now and deliberately
 * preserves input order — it trusts the query to have ordered things — so the
 * ordering has to happen before it, or the density headings come out in
 * whatever order the zone catalog was published in.
 */
export function sortZonesForDisplay(zones: readonly ZoneEntry[] | null | undefined): ZoneEntry[] {
  return [...(zones ?? [])].sort((left, right) => {
    const family = familyRank(left.family) - familyRank(right.family);
    if (family !== 0) return family;

    const density = densityRank(left.density) - densityRank(right.density);
    if (density !== 0) return density;

    // Theme and pack variants of the same tier read together when sorted by
    // name.
    return left.name.localeCompare(right.name);
  });
}

function familyRank(family: string): number {
  const index = ZONING_FAMILY_ORDER.indexOf(family as (typeof ZONING_FAMILY_ORDER)[number]);

  return index < 0 ? ZONING_FAMILY_ORDER.length : index;
}

/**
 * A zone, shaped as a catalog entry so the shared grouped renderer can draw it.
 *
 * The zoning view used to hand-write family → density → tiles, which is
 * group-by-family with a density sub-level rendered as a list — the same thing
 * the catalog does, with its own markup, its own spacing, no view modes and no
 * sort. Mapping the entry rather than duplicating the renderer is what lets
 * that divergence be deleted.
 *
 * Family becomes the category and density the subcategory, so grouping by
 * "category" reproduces the old two-level hierarchy exactly.
 *
 * The metric fields are deliberately null. A zone has no construction cost, no
 * capacity and no lot — it is painted, not placed — and inventing zeroes would
 * put "0" on every card where the honest answer is that the question does not
 * apply.
 */
export function zoneAsCatalogEntry(zone: ZoneEntry): Record<string, unknown> {
  return {
    id: zone.id,
    version: zone.version,
    prefabName: zone.prefabName,
    name: zone.name,
    category: zone.family,
    categoryLabel: zone.family,
    subCategory: zone.density,
    subCategoryLabel: zone.density,
    thumbnail: zone.thumbnail,
    constructionCost: null,
    upkeep: null,
    workers: null,
    capacity: null,
    lotWidth: null,
    lotDepth: null,
    buildingType: null,
    theme: null,
    provenance: null,
    dlcId: null,
    assetPacks: [],
    placementFlags: [],
  };
}

export function selectZoneCommand(zone: { id: number; version: number }) {
  return {
    group: "toolbar",
    method: "selectAsset",
    args: [{ index: zone.id, version: zone.version }, true],
  } as const;
}
