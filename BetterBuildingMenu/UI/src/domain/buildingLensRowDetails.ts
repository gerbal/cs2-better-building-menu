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
 * The game's own sentence about an asset, or null when it has none.
 *
 * The prose vanilla shows when you select a building — "A place of basic
 * education for children. Provides the first level of education." — which the
 * lens dropped the moment a player browsed through us instead of the vanilla
 * grid. It costs no backend projection: the key is built from `prefabName`,
 * which every entry already carries, and the answer comes out of the dictionary
 * the game has already loaded.
 *
 * The absence test is the interesting part. `translate` — and `engine.translate`
 * under it — echoes the key back when it is missing rather than returning null,
 * measured live on 2026-08-09: `Assets.DESCRIPTION[NotARealPrefabName]` returns
 * itself. So an unlocalized asset would render `Assets.DESCRIPTION[Foo]` as
 * prose unless the echo is caught, which is what the prefix check is for.
 *
 * Lives here rather than at either call site because there are two of them —
 * the hover card and the expanded table row — and they must agree about what
 * counts as "no description". Two inline copies of this filter is how they
 * would come to disagree.
 */
export function resolveAssetDescription(
  prefabName: string | null | undefined,
  translate: (key: string, fallback: string) => string | null,
): string | null {
  for (const key of getBuildingDescriptionKeys(prefabName)) {
    const text = translate(key, "")?.trim();

    if (text && !text.startsWith("Assets.")) {
      // The game's own text carries a CRLF between its sentences — the school
      // reads "…the first level of education. \r\nCan be upgraded with…" — and
      // this engine cannot honour it: `white-space: pre-line` computes to
      // `normal` here, measured on the live card, so the break renders as a
      // space whatever we ask for. Collapsed deliberately rather than left to
      // arrive as one, so the string this function returns is the string that
      // gets drawn.
      return text.replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

/**
 * How much description a three-line hover card holds.
 *
 * Measured rather than derived: at 720p the vanilla tooltip container is 184px
 * wide and the card's font renders about 53 characters to the line, so three
 * lines is a little over 160. The budget sits just under that.
 *
 * A character count survives a resolution change because CS2 scales its whole
 * UI with the viewport — the container and the glyphs grow together, so the
 * characters per line stay put. If that ever stops being true the CSS
 * max-height still clips, and the only cost is an ellipsis arriving a few
 * characters early.
 */
export const ASSET_DESCRIPTION_CLAMP_CHARS = 150;

/**
 * Cut a description to the card's three lines, and say that it was cut.
 *
 * The CSS clamp alone leaves a sentence stopping mid-word with nothing to
 * explain it — the Medical University's card ended at "Can be upgraded with a"
 * and read as a rendering fault rather than as a summary. Neither of the ways
 * a browser would signal this exists in Cohtml: `-webkit-line-clamp` has no
 * precedent here and a `linear-gradient` mask computes to `none` (both checked
 * on the live card), so the ellipsis has to be in the text itself.
 *
 * Cuts on a word boundary. A budget that lands mid-word and appends an ellipsis
 * produces "upgraded wi…", which looks more like corruption than truncation.
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

  // Prefer a whole sentence. Cutting the Medical University at the word gave
  // "…healthcare service buildings. Can…", where the dangling "Can" reads as a
  // rendering fault rather than as a summary — and the sentence had ended four
  // characters earlier. Only worth taking in the back half of the budget:
  // further back than that, honouring the sentence throws away a line of text
  // to save a word.
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

  // Colossal.PSI.Common.DlcId's sentinels: BaseGame is -2009, Invalid -1,
  // Virtual -1111. None is a DLC, and the facet names the base game through
  // its own "vanilla" option rather than a "dlc:-2009" one, so resolving them
  // yields nothing and the row printed the number. The Source chip already
  // says where a base-game asset came from.
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
 * What a building gives the city, in the game's own words.
 *
 * The backend sends LeisureProviderData's enum name — "CityPark",
 * "CityIndoors" — and vanilla already ships the player-facing word for each as
 * Properties.LEISURE_TYPE[<name>]. Asking the game means a park reads the same
 * here as it does everywhere else in the UI, in every language, and that we do
 * not invent a second vocabulary for a property that already has one.
 *
 * The fallback splits the enum name rather than guessing a nicer word:
 * "CityIndoors" becomes "City Indoors", which is wrong-ish English and right
 * about which value it is — better than silently showing nothing.
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
