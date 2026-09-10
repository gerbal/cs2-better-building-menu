/**
 * Zones: their shape, their display order, and the hand-off that places them.
 * The lens owns the browsing structure but never the placement — selecting a
 * zone hands off to `toolbar.selectAsset`, still the placement authority.
 */

export interface ZoneEntry {
  id: number;
  version: number;
  prefabName: string;
  name: string;
  family: string;
  density: string;
  thumbnail: string;
  /** Tallest spawnable building in metres, measured by the game. 0 = unknown. */
  maxHeight?: number;
  supportsNarrow?: boolean;
  supportsCorners?: boolean;
  allowedSold?: string;
  allowedManufactured?: string;
  allowedStored?: string;
  /** Per cell, from the zone's own consumption and pollution components. */
  households?: number | null;
  upkeep?: number | null;
  electricityConsumption?: number | null;
  waterConsumption?: number | null;
  garbageAccumulation?: number | null;
  groundPollution?: number | null;
  airPollution?: number | null;
  noisePollution?: number | null;
  /** Lot sizes the zone's spawnable buildings occupy. 0 when none are known. */
  minLotWidth?: number;
  maxLotWidth?: number;
  minLotDepth?: number;
  maxLotDepth?: number;
  /** Distinct lot shapes, narrowest first. */
  footprints?: ZoneFootprint[];
  /** Shapes beyond the display cap, counted rather than dropped. */
  footprintOverflow?: number;
  /** Still behind a milestone — high-density residential starts locked. */
  isLocked?: boolean;
  /** Milestone index it unlocks at; 0 when not locked. */
  unlockMilestone?: number;
  /** Everything standing between the player and this zone. */
  unlockRequirements?: string[];
  /**
   * The natural resource an extractor area works; absent for a zone. Non-empty
   * marks the entry as an AREA — a LotPrefab carrying ExtractorArea — and is
   * the only thing separating grain from cotton in the game's data.
   */
  mapFeature?: string;
}

export interface ZoneFootprint {
  width: number;
  depth: number;
}

/**
 * The shapes a zone grows, ready to draw as little grids. Sorted and capped on
 * the C# side, because the order is a property of the answer; the guard here is
 * because these arrive over a binding and must not draw negative rows.
 */
export function getZoneFootprints(zone: ZoneEntry | null | undefined): ZoneFootprint[] {
  return (zone?.footprints ?? []).filter(
    (footprint) =>
      typeof footprint?.width === "number"
      && typeof footprint?.depth === "number"
      && footprint.width > 0
      && footprint.depth > 0
  );
}

/**
 * The footprints a zone actually grows, as "2×2" or "2–4 wide". The density
 * tier does not imply the width, and width is what decides how a block gets
 * drawn; depth is stated only when fixed, since the block usually constrains it.
 */
export function formatZoneLots(zone: ZoneEntry | null | undefined): string | null {
  const minWidth = zone?.minLotWidth ?? 0;
  const maxWidth = zone?.maxLotWidth ?? 0;
  const minDepth = zone?.minLotDepth ?? 0;
  const maxDepth = zone?.maxLotDepth ?? 0;

  if (minWidth <= 0 || maxWidth <= 0) return null;

  const width = minWidth === maxWidth ? `${minWidth}` : `${minWidth}\u2013${maxWidth}`;

  return minDepth > 0 && minDepth === maxDepth
    ? `${width}\u00a0×\u00a0${minDepth}`
    : `${width} wide`;
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
 * Density order low to high, because alphabetical is meaningless for a scale.
 * "Row" sits between Low and Medium as it does in the game, and "Any" — the
 * tierless zones — goes last so the real tiers read as a progression.
 */
const DENSITY_ORDER = ["Low", "Row", "Medium", "High", "Signature", "Any"];

function densityRank(density: string): number {
  const index = DENSITY_ORDER.indexOf(density);

  return index < 0 ? DENSITY_ORDER.length : index;
}

/**
 * Orders zones the way their headings should read: family, then density tier,
 * then name. The shared grouped renderer preserves input order — it trusts the
 * query — so this has to happen before it or the headings come out arbitrary.
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
 * A zone, shaped as a catalog entry so the shared grouped renderer draws it:
 * family becomes the category and density the subcategory. The metric fields
 * are null because a zone is painted, not placed, and a "0" would be a lie.
 */
export function zoneAsCatalogEntry(zone: ZoneEntry): Record<string, unknown> {
  return {
    id: zone.id,
    version: zone.version,
    prefabName: zone.prefabName,
    name: zone.name,
    // Carried through so the shared tile, list row and hover card give a locked
    // zone the same treatment they give a locked building, instead of each
    // surface needing its own idea of what locked looks like.
    isLocked: zone.isLocked === true,
    mapFeature: zone.mapFeature ?? "",
    unlockMilestone: zone.unlockMilestone ?? 0,
    unlockRequirements: zone.unlockRequirements ?? [],
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

