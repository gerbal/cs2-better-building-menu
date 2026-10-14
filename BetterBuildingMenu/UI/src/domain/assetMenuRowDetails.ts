/**
 * What the hover card says of a building beyond its projected numbers: the game's
 * own description, its extensions and its leisure. The entry already carries all
 * of it, so none of it costs a backend projection.
 */

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

export function getBuildingExtensionLabels(extensions: readonly string[] | null | undefined): string[] {
  if (!extensions?.length) return [];

  return extensions.map((extension) => extension.trim()).filter((extension) => extension.length > 0);
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
