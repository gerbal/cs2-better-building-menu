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
  /** Tallest spawnable building in metres, measured by the game. 0 = unknown. */
  maxHeight?: number;
  supportsNarrow?: boolean;
  supportsCorners?: boolean;
  allowedSold?: string;
  allowedManufactured?: string;
  allowedStored?: string;
  /** Lot sizes the zone's spawnable buildings occupy. 0 when none are known. */
  minLotWidth?: number;
  maxLotWidth?: number;
  minLotDepth?: number;
  maxLotDepth?: number;
  /** Distinct lot shapes, narrowest first. */
  footprints?: ZoneFootprint[];
  /** Shapes beyond the display cap, counted rather than dropped. */
  footprintOverflow?: number;
  /**
   * Still behind a milestone.
   *
   * Zones carried no lock state at all until the indexer started reading it:
   * high-density residential is locked at the start of a city, and the surface
   * drew it exactly like an unlocked zone, so the only way to find out was to
   * try to paint with it.
   */
  isLocked?: boolean;
  /** Milestone index it unlocks at; 0 when not locked. */
  unlockMilestone?: number;
  /** Everything standing between the player and this zone. */
  unlockRequirements?: string[];
}

export interface ZoneFootprint {
  width: number;
  depth: number;
}

/**
 * The shapes a zone grows, ready to draw as little grids.
 *
 * A range says roughly what fits; the shapes say exactly which, and a shape is
 * what the player is matching against the block in front of them. Ordering is
 * narrowest first, which is how you scan for the one that fits a gap.
 *
 * Already sorted and capped on the C# side, because the order is a property of
 * the answer rather than of how it is drawn. This guards the shape anyway:
 * these arrive over a binding, and a malformed one should draw nothing rather
 * than a grid with negative rows.
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
 * What a zone is worth telling the player, in reading order.
 *
 * These are all measured or authored by the game and shown by none of its own
 * UI. Height is the one that changes a decision — "how tall does this grow" is
 * the question a density tier only gestures at — so it leads. The resource a
 * zone trades in matters for commercial and industrial and is absent for
 * residential, so it simply does not appear there.
 *
 * Returned as data rather than as a sentence: the component formats and
 * translates, and these strings are registered in localizableStrings.
 */
export interface ZoneFact {
  kind: "lots" | "height" | "narrow" | "corners" | "sold" | "manufactured" | "stored";
  value: string | number;
}

/**
 * The footprints a zone actually grows, as "2×2" or "2–4 wide".
 *
 * A zone whose buildings are all 2×2 fills a two-cell strip and nothing wider,
 * which decides how the block gets drawn — and the density tier does not imply
 * it, since a low-density zone and a row-housing zone can both be narrow for
 * different reasons.
 *
 * Depth is only stated when it is fixed. Block depth is usually the constraint
 * in practice, so a depth range is noise next to the width, which is the number
 * that changes what the player draws.
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

export function getZoneFacts(zone: ZoneEntry | null | undefined): ZoneFact[] {
  if (!zone) return [];

  const facts: ZoneFact[] = [];

  // What will grow here, before how tall it gets: a zone that only fills 2x2
  // is ruled in or out before its height matters.
  const lots = formatZoneLots(zone);
  if (lots !== null) {
    facts.push({ kind: "lots", value: lots });
  }

  if (typeof zone.maxHeight === "number" && zone.maxHeight > 0) {
    facts.push({ kind: "height", value: zone.maxHeight });
  }

  // Only worth stating when true. "Does not support corners" is noise on the
  // majority of zones that do not.
  if (zone.supportsNarrow) facts.push({ kind: "narrow", value: "" });
  if (zone.supportsCorners) facts.push({ kind: "corners", value: "" });

  for (const [kind, value] of [
    ["sold", zone.allowedSold],
    ["manufactured", zone.allowedManufactured],
    ["stored", zone.allowedStored],
  ] as const) {
    if (typeof value === "string" && value.trim() !== "") {
      facts.push({ kind, value: value.trim() });
    }
  }

  return facts;
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
    // Carried through so the shared tile, list row and hover card give a locked
    // zone the same treatment they give a locked building — a disabled tile, a
    // silhouetted thumbnail, a Requires line — instead of each surface needing
    // its own idea of what locked looks like.
    isLocked: zone.isLocked === true,
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
