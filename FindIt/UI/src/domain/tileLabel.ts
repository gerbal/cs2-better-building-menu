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
 * Characters that fit on one line of a tile.
 *
 * Measured, not estimated. Every earlier value here was a chars-per-rem guess
 * carried forward from the previous guess. Against the running game at 720p, a
 * 100rem tile draws a 64px label box at 10.67px Overpass, and the game's own
 * names measure ~4.9px per character there ("Wastewater Treatment Plant" 127px
 * / 26, "Elementary School" 84px / 17, "Bus Stop Shelter" 75px / 16). 64 / 4.9
 * is thirteen characters — not the eleven this constant claimed.
 *
 * Thirteen is a typical-text figure, so an all-caps or all-M name overruns it.
 * That is what .tileName's text-overflow: ellipsis is for; the cost of being
 * conservative instead is a shorter name on every tile in the catalog.
 */
const CHARS_PER_LINE_AT_DEFAULT_TILE = 13;
const DEFAULT_TILE_SIZE = 100;

/**
 * Two lines, because one could not hold the names.
 *
 * At one line the whole of Transportation read "Bus…Sign", "Bus…lter",
 * "Tax…tand", "Tax…lter", "One…Lane", "Dou…Lane" — the head said which family
 * and the tail said which family, and nothing said which building. The names
 * are three and four words long ("Bus Stop Shelter with Bicycle Stands") and no
 * single 67px line was ever going to hold one.
 *
 * The second line costs 17rem of tile height. It is bought from the tile rather
 * than from the thumbnail: the thumbnail is what the grid is for.
 */
const TILE_LABEL_LINES = 2;

/**
 * Characters on a single line of a tile of this width.
 */
export const tileLabelLineBudget = (tileSize: number): number => {
  const size = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE;
  return Math.max(4, Math.round((size / DEFAULT_TILE_SIZE) * CHARS_PER_LINE_AT_DEFAULT_TILE));
};

/**
 * Characters on the whole label — every line of it.
 */
export const tileLabelCharBudget = (tileSize: number): number =>
  tileLabelLineBudget(tileSize) * TILE_LABEL_LINES;

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

  // trimStart on both tails: a slice that lands mid-gap spends a character of a
  // budget this tight on a space that reads as nothing.
  if (headLength <= 0) return `…${name.slice(name.length - (budget - 1)).trimStart()}`;

  return `${name.slice(0, headLength).trimEnd()}…${name.slice(name.length - tailLength).trimStart()}`;
};

/**
 * Fit the last line, dropping whole words before it cuts one.
 *
 * "Public Transport Lane" over thirteen characters cut to "Public…t Lane" —
 * "t Lane" is a fragment of a word, and a fragment reads as noise where a
 * dropped word reads as a gap. Dropping the middle instead gives
 * "Public…Lane", which is shorter, whole, and says the same thing. The last
 * word is always the one kept: it is where the game puts what distinguishes a
 * building from its neighbours ("… Lane", "… Stands", "… 2x2").
 *
 * Falls back to a character cut when even the first and last word will not fit
 * together, because at that point there is no whole-word answer left.
 */
const fitLastLine = (rest: string, perLine: number): string => {
  if (rest.length <= perLine) return rest;

  const words = rest.split(/\s+/);
  const tail = words[words.length - 1];

  // Largest head that still fits, so as much of the name survives as can.
  for (let head = words.length - 2; head >= 1; head -= 1) {
    const candidate = `${words.slice(0, head).join(" ")}…${tail}`;
    if (candidate.length <= perLine) return candidate;
  }

  return shortenTileLabel(rest, perLine);
};

/**
 * Lay the name out over the tile's lines.
 *
 * Greedy word packing, which is what makes two lines worth having: "Bus Stop
 * Shelter" becomes "Bus Stop" / "Shelter" rather than a mid-word cut. Only the
 * last line can be elided, and it is elided by <see cref="shortenTileLabel"/>
 * so a name whose distinguishing part is its suffix still keeps that suffix.
 *
 * Returns one entry per drawn line, and fewer than `lines` when the name did
 * not need them all — the caller reserves the height either way so the grid
 * stays aligned.
 */
export const wrapTileLabel = (
  label: string,
  perLine: number,
  lines: number = TILE_LABEL_LINES
): string[] => {
  const name = (label ?? "").trim();
  if (!name) return [];
  if (lines <= 1 || perLine <= 1) return [shortenTileLabel(name, perLine)];

  const words = name.split(/\s+/);
  const drawn: string[] = [];
  let index = 0;

  // Every line but the last takes whole words only.
  while (index < words.length && drawn.length < lines - 1) {
    // A single word longer than the line has to be cut somewhere; cutting it
    // here rather than bailing out keeps the remaining words a line of their
    // own.
    if (words[index].length > perLine) {
      drawn.push(shortenTileLabel(words[index], perLine));
      index += 1;
      continue;
    }

    let line = words[index];
    index += 1;

    while (index < words.length && line.length + 1 + words[index].length <= perLine) {
      line += ` ${words[index]}`;
      index += 1;
    }

    drawn.push(line);
  }

  const rest = words.slice(index).join(" ");
  if (rest) drawn.push(fitLastLine(rest, perLine));

  return drawn;
};
