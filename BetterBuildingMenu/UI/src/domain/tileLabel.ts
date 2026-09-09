import { fontSizeRatio } from "./textScale";

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
 * 100rem tile draws a 64px label box. Thirteen was measured there at
 * fontSizeXS (10.67px Overpass, ~4.9px a character: "Wastewater Treatment
 * Plant" 127px / 26, "Elementary School" 84px / 17). The name line has since
 * moved up to fontSizeM, and at 1280x720 the game's own names now measure
 * ~5.3px a character: "Two-Lane Road", thirteen characters, wanted 69px of 64
 * and the belt-and-braces CSS ellipsis drew "Two-Lane Ro…" on every small
 * road, while an already-elided "Wooden…Bridge" ran 9px over. 64 / 5.3 is
 * twelve.
 *
 * Twelve is a typical-text figure, so an all-caps or all-M name still overruns
 * it. That is what .tileName's text-overflow: ellipsis is for; the cost of
 * being conservative instead is a shorter name on every tile in the catalog.
 */
const CHARS_PER_LINE_AT_DEFAULT_TILE = 12;
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
export const tileLabelLineBudget = (tileSize: number, textScale = 1): number => {
  const size = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE;
  // The name line is fontSizeM; at a larger text scale fewer characters fit
  // the same box — see domain/textScale.ts. The unscaled budget is rounded,
  // as it was measured; a scaled one is floored, because the base already
  // fills the line and there is no margin to round up into ("One-Way Road"
  // on one 99px line in a 93px box at 125 %).
  const ratio = fontSizeRatio("m", textScale);
  const unscaled = (size / DEFAULT_TILE_SIZE) * CHARS_PER_LINE_AT_DEFAULT_TILE;
  return Math.max(4, ratio === 1 ? Math.round(unscaled) : Math.floor(unscaled / ratio));
};

/**
 * Characters on the whole label — every line of it.
 */
export const tileLabelCharBudget = (tileSize: number, textScale = 1): number =>
  tileLabelLineBudget(tileSize, textScale) * TILE_LABEL_LINES;

/**
 * Characters on the table's single-line name, from the width actually drawable.
 *
 * Takes the DRAWABLE width, not the column width: the caller knows what the row
 * spends on thumbnails, buttons and scrollbar gutters, and putting that
 * arithmetic here once cost the change its whole effect — the budget came out
 * ~58 characters against a real 35, so nothing was ever shortened and CSS went
 * on cutting the tail.
 *
 * The table shows one line, not two, so it cannot borrow the tile's budget, and
 * it truncates at the END — which loses exactly the part that distinguishes one
 * name from its neighbours. Same characters-per-rem as the tiles: same font,
 * same size.
 */
/**
 * The table's own figure. Thirteen was measured for it once; at both
 * 1280x720 and 1920x1080 the widest names still ran 1 % over their cell
 * ("Medium Roundabout with a…" 333px in 327), so twelve — erring short,
 * which is the safe direction for a cell that clips.
 */
const CHARS_PER_100REM_TABLE = 12;

export const tableLabelCharBudget = (drawableWidth: number, textScale = 1): number => {
  const width = Number.isFinite(drawableWidth) && drawableWidth > 0 ? drawableWidth : DEFAULT_TILE_SIZE;

  // The table's name cell is fontSizeS.
  return Math.max(8, Math.round((width / DEFAULT_TILE_SIZE) * CHARS_PER_100REM_TABLE / fontSizeRatio("s", textScale)));
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
 * What the ellipsis costs, counted in characters of the budget.
 *
 * Three, and both characters past the first are earned. Measured in the
 * running game at the tile's own font and size:
 *
 *   • "…" draws 9.4px where the average lowercase letter draws 5.0, so the
 *     mark alone is worth 1.9 characters. It was charged one.
 *   • What is left after eliding is not average text. It keeps the capitals
 *     and drops the spaces, and spaces are the narrowest thing in a name — the
 *     elided results measure 5.03px per character against the 4.88 that
 *     CHARS_PER_LINE_AT_DEFAULT_TILE is derived from.
 *
 * Undercharged, "Firefighting Helicopter Depot" came out as "Helico…Depot":
 * 12 characters inside a 13-character budget, and 64.7px inside a 64px box. The
 * stylesheet elided the overflow a second time and drew "Helico…De…", two marks
 * on one line, which reads as corruption rather than as a shortened name.
 * Charged three it gives "Helic…Depot" at 59.1px, which fits with room over.
 */
const ELLIPSIS_CHARS = 3;

/**
 * The tail of a name, preferring a whole word.
 *
 * A tail cut mid-word reads as noise: "Control Center" shortened to
 * "Contro…enter" says less than "Contr…Center" does, and costs the same. So a
 * word boundary within reach of the cut wins over the exact character count —
 * the tail is where the game puts what distinguishes a building from its
 * neighbours, and half a word distinguishes nothing.
 */
const tailOf = (name: string, tailLength: number): string => {
  const cut = name.length - tailLength;
  const boundary = name.lastIndexOf(" ", cut);

  if (boundary >= 0) {
    const word = name.slice(boundary + 1);

    // One character of slack, so a boundary just past the cut still wins.
    if (word.length > 0 && word.length <= tailLength + 1) {
      return word;
    }
  }

  return name.slice(cut).trimStart();
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

  // What the text may occupy once the ellipsis has been paid for.
  const usable = Math.max(1, budget - ELLIPSIS_CHARS);

  // Enough tail to carry the distinguishing suffix (levels, lot sizes, indices),
  // enough head to still recognise the family.
  const tailLength = Math.max(1, Math.min(name.length - 1, Math.ceil(usable * 0.45)));
  const tail = tailOf(name, tailLength);
  const headLength = usable - tail.length;

  // trimStart on the tail: a slice that lands mid-gap spends a character of a
  // budget this tight on a space that reads as nothing.
  if (headLength <= 0) return `…${tail}`;

  return `${name.slice(0, headLength).trimEnd()}…${tail}`;
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
  // The mark costs what shortenTileLabel charges for it, not one character:
  // "One-Way…Road" is twelve by count and drew 59px in a 51px line, and the
  // clip that follows an elided line then cut it to "One-Way…Roa".
  const markCost = ELLIPSIS_CHARS - 1;
  for (let head = words.length - 2; head >= 1; head -= 1) {
    const candidate = `${words.slice(0, head).join(" ")}…${tail}`;
    if (candidate.length + markCost <= perLine) return candidate;
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
