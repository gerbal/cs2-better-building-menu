/**
 * The context an expanded catalog row shows beyond its eight projected numbers.
 *
 * The adapter already carries all of this on every entry, but until now it was
 * only reachable as filter facets — you could narrow the catalog by placement
 * or DLC without ever seeing which flags the building in front of you had.
 */

export type BuildingFlagGroupId = "placement" | "access" | "connections" | "lot";

export interface BuildingFlagGroup {
  id: BuildingFlagGroupId;
  label: string;
  values: string[];
}

export interface BuildingProvenanceChip {
  label: string;
  value: string;
}

/**
 * The localization keys the game itself uses for a prefab's description.
 *
 * `PrefabUISystem.GetTitleAndDescription` keys ordinary assets as
 * `Assets.DESCRIPTION[<prefab.name>]` and service upgrades as
 * `Assets.UPGRADE_DESCRIPTION[<prefab.name>]`. The catalog entry already
 * carries `prefabName`, so the description costs no backend projection at all —
 * the caller tries these in order and takes the first that resolves.
 */
export function getBuildingDescriptionKeys(prefabName: string | null | undefined): string[] {
  const name = prefabName?.trim();
  if (!name) return [];

  return [`Assets.DESCRIPTION[${name}]`, `Assets.UPGRADE_DESCRIPTION[${name}]`];
}

/**
 * Every value of `Game.Prefabs.BuildingFlags`, in the game's own words.
 *
 * Nothing is hidden: the lot and wiring internals are exactly what a modder
 * wants exposed. They are grouped and ordered instead, so the flags that decide
 * where a building can go read first and the internals read last, rather than
 * arriving as one flat nineteen-chip wall.
 */
const FLAG_DEFINITIONS: Record<string, { group: BuildingFlagGroupId; label: string }> = {
  RequireRoad: { group: "placement", label: "Requires a road connection" },
  NoRoadConnection: { group: "placement", label: "No road connection" },
  RequireAccess: { group: "placement", label: "Requires access" },
  CanBeOnRoad: { group: "placement", label: "Can be placed on a road" },
  CanBeOnRoadArea: { group: "placement", label: "Can be placed on a road area" },
  CanBeRoadSide: { group: "placement", label: "Can be placed roadside" },

  LeftAccess: { group: "access", label: "Left" },
  RightAccess: { group: "access", label: "Right" },
  BackAccess: { group: "access", label: "Back" },
  RestrictedPedestrian: { group: "access", label: "No pedestrian access" },
  RestrictedCar: { group: "access", label: "No car access" },
  RestrictedParking: { group: "access", label: "Parking restricted" },
  RestrictedTrack: { group: "access", label: "No track access" },

  HasWaterNode: { group: "connections", label: "Water" },
  HasSewageNode: { group: "connections", label: "Sewage" },
  HasLowVoltageNode: { group: "connections", label: "Power" },
  HasResourceNode: { group: "connections", label: "Resources" },

  ColorizeLot: { group: "lot", label: "Lot is colorized" },
  HasInsideRoom: { group: "lot", label: "Has inside room" },
};

const GROUP_ORDER: Array<{ id: BuildingFlagGroupId; label: string }> = [
  { id: "placement", label: "Placement" },
  { id: "access", label: "Access" },
  { id: "connections", label: "Connections" },
  { id: "lot", label: "Lot" },
];

/** `SomeFutureFlag` -> `Some future flag`. */
function humanizeFlag(flag: string): string {
  const spaced = flag.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function getBuildingFlagGroups(flags: readonly string[] | null | undefined): BuildingFlagGroup[] {
  if (!flags?.length) return [];

  const collected = new Map<BuildingFlagGroupId, string[]>();

  for (const flag of flags) {
    const known = FLAG_DEFINITIONS[flag?.trim()];
    // An unrecognised flag lands in the lot group readably rather than
    // vanishing: the game adds flags between patches and a silent drop would
    // make the mod quietly blind to them.
    const group = known?.group ?? "lot";
    const label = known?.label ?? humanizeFlag(flag);

    const bucket = collected.get(group);
    if (bucket) {
      bucket.push(label);
    } else {
      collected.set(group, [label]);
    }
  }

  return GROUP_ORDER.filter((group) => collected.has(group.id)).map((group) => ({
    id: group.id,
    label: group.label,
    values: collected.get(group.id) as string[],
  }));
}

export function getBuildingExtensionLabels(extensions: readonly string[] | null | undefined): string[] {
  if (!extensions?.length) return [];

  return extensions.map((extension) => extension.trim()).filter((extension) => extension.length > 0);
}

/**
 * Resolves a raw entry value to the label the matching filter facet shows.
 *
 * Returns null when the facet has no such option, in which case the raw value
 * is used unchanged.
 */
export type FacetLabelResolver = (groupId: string, value: string) => string | null;

export function getBuildingProvenanceChips(
  entry: {
    dlcId?: string | null;
    theme?: string | null;
    assetPacks?: readonly string[] | null;
    provenance?: string | null;
  },
  resolveLabel?: FacetLabelResolver
): BuildingProvenanceChip[] {
  // The adapter stores raw ids (DlcId is the numeric platform id, e.g. "-2009")
  // while the facet groups carry display names. Resolving through the facets
  // keeps the row and the filter naming the same thing the same way.
  const display = (groupId: string, value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    return resolveLabel?.(groupId, trimmed)?.trim() || trimmed;
  };

  const packs = (entry.assetPacks ?? [])
    .map((pack) => display("assetPack", pack))
    .filter((pack) => pack.length > 0);

  const chips: BuildingProvenanceChip[] = [
    { label: "DLC", value: display("dlc", entry.dlcId ?? "") },
    { label: "Theme", value: display("theme", entry.theme ?? "") },
    { label: "Pack", value: packs.join(", ") },
    { label: "Source", value: display("provenance", entry.provenance ?? "") },
  ];

  return chips.filter((chip) => chip.value.length > 0);
}
