import { fontSizeRatio } from "./textScale";

/**
 * Shortening for a name drawn in a box it may not fit: the tiles' name line and
 * the cards' rows. Catalog names are longest at the front and distinguished at
 * the back, so clipping from the right makes many buildings read alike: the
 * tail is kept, the head is spent, and the hover card has the whole.
 */

/**
 * Characters that fit on one line of a box MEASURED_WIDTH wide at fontSizeM,
 * taken from the running game. A typical-text figure, so an all-caps name
 * overruns it and the line's text-overflow catches that rare case.
 */
const CHARS_AT_MEASURED_WIDTH = 12;
/** The width that figure was taken at; a budget for another width scales from it. */
const MEASURED_WIDTH = 100;
/** The font that figure was taken in: the game's fontSizeM at 100% text, in rem. */
const MEASURED_FONT = 16;

/**
 * Two lines unless the caller says otherwise, because one cannot hold names
 * three and four words long — on one line head and tail both name the family
 * and nothing names the building.
 */
const TILE_LABEL_LINES = 2;

/**
 * Characters on a single line of a box this wide, in fontSizeM unless the
 * caller draws a font of its own size (rem at 100% text, grown by the scale).
 */
export const tileLabelLineBudget = (width: number, textScale = 1, font = MEASURED_FONT): number => {
  const size = Number.isFinite(width) && width > 0 ? width : MEASURED_WIDTH;
  // fontSizeM grows by vanilla's own calc() — see domain/textScale.ts; any other
  // font grows with the scale. The budget at the measured font is rounded as it
  // was measured; any other is floored, since the base already fills the line.
  const ratio = font === MEASURED_FONT ? fontSizeRatio("m", textScale) : (font * textScale) / MEASURED_FONT;
  const unscaled = (size / MEASURED_WIDTH) * CHARS_AT_MEASURED_WIDTH;
  return Math.max(4, ratio === 1 ? Math.round(unscaled) : Math.floor(unscaled / ratio));
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
 * Lay the name out over its lines by greedy word packing, so only the
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

/**
 * The longest name the list and card rows draw whole. Those rows grow to fit
 * their name, which is the point of them, but an asset that ships its name
 * repeated (one does, six times over) would stretch its row across the asset menu.
 * Set well above real names ("Fishing And Open Water Fish Farming Area Hub" is
 * 44), so it only catches names like that one; the hover card has the whole.
 */
export const LIST_NAME_MAX_CHARS = 56;

/**
 * A list or card row's name: whole, unless it runs past LIST_NAME_MAX_CHARS.
 */
export const listLabel = (label: string): string => shortenTileLabel(label, LIST_NAME_MAX_CHARS);
