import { fontSizeRatio } from "./textScale";

/**
 * Shortening for grid tile names. Catalog names are longest at the front and
 * distinguished at the back, so clipping from the right makes many tiles read
 * alike: the tail is kept, the head is spent, and the tooltip has the whole.
 */

/**
 * Characters that fit on one line of a tile, taken from the running game at the
 * name line's own font and size. A typical-text figure, so an all-caps name
 * overruns it and .tileName's text-overflow catches that rare case.
 */
const CHARS_PER_LINE_AT_DEFAULT_TILE = 12;
const DEFAULT_TILE_SIZE = 100;

/**
 * Two lines, because one cannot hold names three and four words long — on one
 * line head and tail both name the family and nothing names the building. The
 * second line is bought from the tile, not from the thumbnail.
 */
const TILE_LABEL_LINES = 2;

/**
 * Characters on a single line of a tile of this width.
 */
export const tileLabelLineBudget = (tileSize: number, textScale = 1): number => {
  const size = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE;
  // The name line is fontSizeM; at a larger text scale fewer characters fit the
  // same box — see domain/textScale.ts. The unscaled budget is rounded as it was
  // measured; a scaled one is floored, since the base already fills the line.
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
 * The table's own characters-per-100rem figure. Erring short is the safe
 * direction for a cell that clips.
 */
const CHARS_PER_100REM_TABLE = 12;

/**
 * Characters on the table's single-line name, from the width actually DRAWABLE:
 * the caller knows what the row spends on thumbnails, buttons and gutters, and
 * a budget taken from the column width instead never shortens anything.
 */
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
 * Drop leading words that only repeat what the tile's own context already says,
 * because they cost half the drawable characters and carry nothing. Stops at
 * the first word that is not redundant, so most names are left alone.
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
 * What the ellipsis costs, in characters of the budget. More than one: the mark
 * is nearly two average characters wide, and what survives an elision keeps the
 * capitals and drops the spaces. Undercharged, the stylesheet elides again.
 */
const ELLIPSIS_CHARS = 3;

/**
 * The tail of a name, preferring a whole word: a boundary within reach of the
 * cut wins over the exact character count, because half a word costs the same
 * and distinguishes nothing.
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
 * Keep the end of the name, and as much of the start as still fits. A real
 * ellipsis character rather than CSS's, because CSS can only elide at an edge
 * and the information is at both: the head says what kind, the tail says which.
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
 * Fit the last line, dropping whole words before it cuts one: a word fragment
 * reads as noise where a dropped word reads as a gap. The last word is always
 * kept, being where the game puts what distinguishes one building from another.
 */
const fitLastLine = (rest: string, perLine: number): string => {
  if (rest.length <= perLine) return rest;

  const words = rest.split(/\s+/);
  const tail = words[words.length - 1];

  // Largest head that still fits, so as much of the name survives as can. The
  // mark costs what shortenTileLabel charges for it, not one character, or the
  // line overflows and is clipped a second time.
  const markCost = ELLIPSIS_CHARS - 1;
  for (let head = words.length - 2; head >= 1; head -= 1) {
    const candidate = `${words.slice(0, head).join(" ")}…${tail}`;
    if (candidate.length + markCost <= perLine) return candidate;
  }

  return shortenTileLabel(rest, perLine);
};

/**
 * Lay the name out over the tile's lines by greedy word packing, so only the
 * last line is ever elided and a name distinguished by its suffix keeps it.
 * Returns one entry per DRAWN line; the caller reserves the height either way.
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
    // here keeps the remaining words a line of their own.
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
