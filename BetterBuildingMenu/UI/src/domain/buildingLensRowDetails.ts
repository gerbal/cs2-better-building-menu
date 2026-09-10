/**
 * The context an expanded catalog row shows beyond its projected numbers. The
 * entry already carries all of it; without this the same data is reachable only
 * as filter facets, so a building never states its own flags.
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
 * The localization keys the game itself uses for a prefab's description, tried
 * in order. Built from `prefabName`, which every entry already carries, so the
 * description costs no backend projection.
 */
export function getBuildingDescriptionKeys(prefabName: string | null | undefined): string[] {
  const name = prefabName?.trim();
  if (!name) return [];

  return [`Assets.DESCRIPTION[${name}]`, `Assets.UPGRADE_DESCRIPTION[${name}]`];
}

/**
 * The game's own sentence about an asset, or null when it has none. `translate`
 * echoes a missing key back rather than returning null, so the prefix check is
 * what stops a raw key rendering as prose. Two callers have to agree on this.
 */
export function resolveAssetDescription(
  prefabName: string | null | undefined,
  translate: (key: string, fallback: string) => string | null,
): string | null {
  for (const key of getBuildingDescriptionKeys(prefabName)) {
    const text = translate(key, "")?.trim();

    if (text && !text.startsWith("Assets.")) {
      // The game's text carries a CRLF between its sentences and this engine
      // cannot honour it — `white-space: pre-line` computes to `normal` — so
      // the break is collapsed here and what is returned is what is drawn.
      return text.replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

/**
 * How much description a three-line hover card holds. A character count rather
 * than a width, because the game scales container and glyphs together, so the
 * characters per line hold across resolutions; the CSS max-height still clips.
 */
export const ASSET_DESCRIPTION_CLAMP_CHARS = 150;

/**
 * Cut a description to the card's three lines, and say so in the TEXT: Cohtml
 * has no `-webkit-line-clamp` and computes a gradient mask to `none`, so a CSS
 * clip alone reads as a fault. On a word boundary, or it reads as corruption.
 */
export function clampAssetDescription(
  text: string | null | undefined,
  maxChars: number = ASSET_DESCRIPTION_CLAMP_CHARS,
): string | null {
  const full = text?.trim();

  if (!full) {
    return null;
  }

  const budget = Number.isFinite(maxChars) ? Math.max(1, Math.floor(maxChars)) : ASSET_DESCRIPTION_CLAMP_CHARS;

  if (full.length <= budget) {
    return full;
  }

  const cut = full.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  // A single word longer than the whole budget has no boundary to cut on, and
  // half of it is still better than none of it.
  const word = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;

  // Prefer a whole sentence, since a dangling first word of the next one reads
  // as a fault. Only in the back half of the budget: further back, honouring
  // the sentence throws away a line of text to save a word.
  const sentence = lastSentenceEnd(word);
  const head = sentence >= budget / 2 ? word.slice(0, sentence) : word;

  return `${head.replace(/[\s,.;:]+$/, "")}…`;
}

/** Index of the last sentence terminator, or -1. */
function lastSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];

    // Followed by a space or nothing, so a decimal point or an abbreviation
    // mid-word is not mistaken for the end of a thought.
    if ((char === "." || char === "!" || char === "?") && (i === text.length - 1 || text[i + 1] === " ")) {
      return i;
    }
  }

  return -1;
}

/**
 * Every value of `Game.Prefabs.BuildingFlags`, in the game's own words. Nothing
 * is hidden — the lot and wiring internals are what a modder wants exposed — so
 * they are grouped instead, placement first and internals last.
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
    // vanishing: the game adds flags between patches, and a silent drop would
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
 * Resolves a raw entry value to the label the matching filter facet shows, or
 * null when the facet has no such option and the raw value is used unchanged.
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
  // The entry stores raw ids while the facet groups carry display names, so
  // resolving through the facets keeps row and filter naming things alike.
  const display = (groupId: string, value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    return resolveLabel?.(groupId, trimmed)?.trim() || trimmed;
  };

  const packs = (entry.assetPacks ?? [])
    .map((pack) => display("assetPack", pack))
    .filter((pack) => pack.length > 0);

  // Colossal.PSI.Common.DlcId's sentinels. None is a DLC, the facet has no
  // option for them, and the Source chip already says where a base-game asset
  // came from — so they resolve to nothing and must not print as numbers.
  const dlcId = (entry.dlcId ?? "").trim();
  const isDlcSentinel = dlcId === "-2009" || dlcId === "-1" || dlcId === "-1111";

  const chips: BuildingProvenanceChip[] = [
    { label: "DLC", value: isDlcSentinel ? "" : display("dlc", dlcId) },
    { label: "Theme", value: display("theme", entry.theme ?? "") },
    { label: "Pack", value: packs.join(", ") },
    { label: "Source", value: display("provenance", entry.provenance ?? "") },
  ];

  return chips.filter((chip) => chip.value.length > 0);
}

/**
 * What a building gives the city, in the game's own words: vanilla ships one for
 * every LeisureProviderData enum name, so there is no second vocabulary to
 * invent. The fallback splits the enum name rather than guess a nicer word.
 */
export function leisureLabel(
  leisureType: string | null | undefined,
  translate: (key: string, fallback: string | null) => string | null,
): string {
  const name = (leisureType ?? "").trim();

  if (name === "") {
    return "";
  }

  const spelled = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

  return translate(`Properties.LEISURE_TYPE[${name}]`, null) ?? spelled;
}
