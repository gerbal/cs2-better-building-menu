/**
 * The zoning hierarchy: family, then density tier, then the zones themselves.
 *
 * The lens owns this browsing structure, but never the placement — selecting a
 * zone hands off to the game's own `toolbar.selectAsset`, keeping the tool-first
 * design's rule that native tools remain the placement authority.
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

export interface ZoneDensityGroup {
  density: string;
  zones: ZoneEntry[];
}

export interface ZoneFamilyGroup {
  id: string;
  densities: ZoneDensityGroup[];
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

export function buildZoningHierarchy(
  zones: readonly ZoneEntry[] | null | undefined
): ZoneFamilyGroup[] {
  if (!zones?.length) return [];

  const families = new Map<string, Map<string, ZoneEntry[]>>();

  for (const zone of zones) {
    const byDensity = families.get(zone.family) ?? new Map<string, ZoneEntry[]>();
    const bucket = byDensity.get(zone.density) ?? [];

    bucket.push(zone);
    byDensity.set(zone.density, bucket);
    families.set(zone.family, byDensity);
  }

  // A family with no zones is omitted rather than shown as an empty tab: which
  // zones exist depends on the player's DLC and packs.
  return ZONING_FAMILY_ORDER.filter((family) => families.has(family)).map((family) => {
    const byDensity = families.get(family) as Map<string, ZoneEntry[]>;

    return {
      id: family,
      densities: [...byDensity.entries()]
        .sort(([a], [b]) => densityRank(a) - densityRank(b))
        .map(([density, entries]) => ({
          density,
          // Theme and pack variants of the same tier read together when sorted
          // by name.
          zones: [...entries].sort((a, b) => a.name.localeCompare(b.name)),
        })),
    };
  });
}

/** Hands a zone to the game's Zone tool; the lens never places anything. */
export function selectZoneCommand(zone: { id: number; version: number }) {
  return {
    group: "toolbar",
    method: "selectAsset",
    args: [{ index: zone.id, version: zone.version }, true],
  } as const;
}
