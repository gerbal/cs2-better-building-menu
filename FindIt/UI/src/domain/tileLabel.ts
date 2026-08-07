/**
 * Shortening for grid tile names.
 *
 * A tile is two lines of a small font in a ~59px box at 720p, the project's
 * minimum supported resolution. The catalog's names are far longer than that
 * and, worse, they are longest at the front: "EU Commercial Gas Station 01 -
 * L1 2x2" and "... - L1 3x2" differ only in their last four characters. Clipping
 * from the right therefore turns sixty distinct buildings into sixty tiles all
 * reading "EU Commercia" — which is what the grid did.
 *
 * So the tail is the part worth keeping, and the head is what gets spent. The
 * full name stays on the tooltip and the aria-label; this is only what is drawn.
 */

/**
 * Characters that fit on a tile, derived from the live measurement at the
 * default tile size: an 88rem tile renders a 52px label box in a 10.67px font
 * over two 17rem lines, which lands at about ten characters a line.
 *
 * Approximate on purpose. Glyph widths vary, and the cost of being one
 * character out is a slightly short label, while the cost of measuring text
 * properly is a layout pass per tile per render.
 */
const CHARS_PER_LINE_AT_DEFAULT_TILE = 10;
const DEFAULT_TILE_SIZE = 88;
const TILE_LABEL_LINES = 2;

export const tileLabelCharBudget = (tileSize: number): number => {
  const size = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE;
  const perLine = Math.max(4, Math.round((size / DEFAULT_TILE_SIZE) * CHARS_PER_LINE_AT_DEFAULT_TILE));
  return perLine * TILE_LABEL_LINES;
};

/**
 * Theme prefixes the catalog puts in front of a name. These say which art set a
 * building belongs to, which the tile is not sorted or grouped by and which
 * every neighbouring tile repeats.
 */
const THEME_PREFIXES = ["eu", "na", "uk", "jp", "european", "northamerican", "british", "japanese"];

const normalise = (word: string): string => word.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Drop leading words that only repeat what the tile's own context already says.
 *
 * "EU Commercial Gas Station 01 - L1 2x2" sits under a "Commercial" heading, in
 * a European-themed city, next to forty other names starting the same way. The
 * first two words cost thirteen of about twenty-six drawable characters and
 * carry nothing — and eliding the middle instead removes "Gas Station", which is
 * the only part that distinguishes it from "EU Commercial High 01 - L1 2x2".
 *
 * Stops at the first word that is not redundant, so a name that does not start
 * with its own category is left alone.
 */
export const stripRedundantNamePrefix = (
  label: string,
  context: { category?: string; subCategory?: string; theme?: string } = {}
): string => {
  const redundant = new Set(
    [context.category, context.subCategory, context.theme]
      .filter((value): value is string => Boolean(value))
      .map(normalise)
      .concat(THEME_PREFIXES)
  );

  const words = (label ?? "").trim().split(/\s+/);
  let start = 0;
  while (start < words.length - 1 && redundant.has(normalise(words[start]))) start += 1;

  const stripped = words.slice(start).join(" ");
  // Never strip down to nothing, and never to a bare number: if what is left
  // cannot name the building, the original is the more useful thing to show.
  return /[a-z]/i.test(stripped) ? stripped : (label ?? "").trim();
};

/**
 * Keep the end of the name, and as much of the start as still fits.
 *
 * The ellipsis is a real character rather than CSS's, because CSS can only
 * elide at an edge and the information here is at both ends: the head says what
 * kind of thing it is, the tail says which one.
 */
export const shortenTileLabel = (label: string, budget: number): string => {
  const name = (label ?? "").trim();
  if (budget <= 1 || name.length <= budget) return name;

  // Enough tail to carry the distinguishing suffix (levels, lot sizes, indices),
  // enough head to still recognise the family.
  const tailLength = Math.max(1, Math.min(name.length - 1, Math.ceil((budget - 1) * 0.45)));
  const headLength = budget - 1 - tailLength;

  if (headLength <= 0) return `…${name.slice(name.length - (budget - 1))}`;

  return `${name.slice(0, headLength).trimEnd()}…${name.slice(name.length - tailLength)}`;
};
