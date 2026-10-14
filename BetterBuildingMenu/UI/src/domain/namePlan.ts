/**
 * The name planner: how a name draws in a box of a width and a number of lines, never a line wider than
 * the box. Whole where it fits; else cut once, between words, keeping every word that tells the name
 * apart from a look-alike and the words a search typed, its head never ending on a word like "of"; a
 * hyphenated compound broken at its hyphen only when every cut keeps too little; else words cut inside
 * them, the plain words first, the typed next, the distinguishing word and the numbers last; only where
 * nothing else fits, the mark leads. Lines are laid out here, not by the engine, from one advance table
 * of the game's fonts: Cohtml never breaks at a hyphen, and Chromium does. Pure. See
 * docs/design-notes.md, "Names".
 */
import { textWidth, WIDE } from "./textWidth";
import { shortenTileLabel } from "./tileLabel";

/** The room a name draws in: its width and its line count, at a font this many rem high. */
export interface NameBox {
  width: number;
  lines: number;
  font: number;
  /** Room the stylesheet adds after each character, in rem: a label's caps are tracked. */
  tracking?: number;
}

/** Each box's runs measured so far: a plan lays the same words out many times. */
const measured = new WeakMap<NameBox, Map<string, number>>();

/** A run's width in a box's type, its tracking with it. */
function runWidth(run: string, box: NameBox): number {
  let widths = measured.get(box);
  if (widths === undefined) measured.set(box, (widths = new Map()));
  let width = widths.get(run);
  if (width === undefined) widths.set(run, (width = textWidth(run, box.font) + (box.tracking ?? 0) * [...run].length));
  return width;
}

/** What a cut keeps, and how far it may go. */
export interface NameHints {
  /** Whole words a cut keeps: the row's distinguishing word. */
  keep?: readonly string[];
  /** The words a search typed: a cut keeps each name word one of them begins, two characters or more. */
  typed?: readonly string[];
  /**
   * Whether a cut may go past the plain words where they alone cannot make the name fit: the typed words,
   * the distinguishing word and the numbers cut inside them, then the whole name. True by default; a tag
   * says nothing rather than such a cut, and draws no line.
   */
  lastResort?: boolean;
  /**
   * Whether a cut around the distinguishing word opens with the mark, the name's head dropped ("…Angled…"),
   * rather than keeping its first word ("Two… Angled…"): the list's pass over the page asks it of a plate
   * whose first word leaves it drawn as another. False by default.
   */
  leads?: boolean;
}

export interface NamePlan {
  /** Each line the name draws, in order. */
  lines: string[];
  /** Whether the lines hold the whole name. */
  whole: boolean;
}

/** The mark a cut leaves where words were dropped, or inside a word: never leading but as the last resort. */
export const CUT_MARK = "…";

/** The share of its characters below which a cut keeps too little, and a hyphen may break instead. */
const HYPHEN_SHARE = 0.6;

/** The most marks a line carries: more reads as noise, not as a name. */
const MOST_MARKS = 2;

/** Words a head never ends on, nor a tag says alone: it would read as unfinished. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "at", "by", "de", "del", "der", "des", "die", "du", "for", "in", "la", "le", "of", "on", "the", "to", "und", "von", "with", "w/", "&", "+", "-", "–", "—", ",",
]);

/** A word that only parts two others: it never opens a line, nor a cut's tail, nor a tag. */
export const SEPARATORS: ReadonlySet<string> = new Set(["-", "–", "—", ","]);

/** A unit a line is laid out in: its text, and whether a space comes before it. */
interface Piece {
  text: string;
  space: boolean;
}

/** A name's pieces: its words, each ideograph a piece of its own, and with `hyphens` each compound split after its hyphens. */
function pieces(name: string, hyphens: boolean): Piece[] {
  const out: Piece[] = [];

  for (const word of name.split(/\s+/).filter(Boolean)) {
    // A separator stays with the word before it, so no line opens with it.
    const previous = out[out.length - 1];
    if (SEPARATORS.has(word) && previous !== undefined) {
      out[out.length - 1] = { ...previous, text: `${previous.text} ${word}` };
      continue;
    }

    // A space comes before a word's first piece, never inside it.
    let opens = out.length > 0;
    let run = "";
    const flush = () => {
      if (run === "") return;
      out.push({ text: run, space: opens });
      opens = false;
      run = "";
    };

    for (const character of word) {
      if (WIDE.test(character)) {
        flush();
        out.push({ text: character, space: opens });
        opens = false;
        continue;
      }

      run += character;
      if (hyphens && character === "-" && run.length > 1) flush();
    }

    flush();
  }

  return out;
}

/**
 * The pieces laid out greedily over at most `box.lines` lines of `box.width`; null where they need more,
 * or a piece is wider than a line. A last line of one ideograph takes the one before it down with it.
 */
function layout(parts: readonly Piece[], box: NameBox): string[] | null {
  const lines: Piece[][] = [];
  let width = 0;

  for (const part of parts) {
    const own = runWidth(part.text, box);
    if (own > box.width) return null;

    const line = lines[lines.length - 1];
    const joined = width + (part.space ? runWidth(" ", box) : 0) + own;

    if (line !== undefined && joined <= box.width) {
      line.push(part);
      width = joined;
      continue;
    }

    lines.push([part]);
    width = own;
  }

  const last = lines[lines.length - 1];
  const before = lines[lines.length - 2];
  if (last?.length === 1 && WIDE.test(last[0].text) && before !== undefined && before.length > 1) {
    last.unshift(before.pop()!);
    if (runWidth(text(last), box) > box.width) return null;
  }

  return lines.length <= box.lines ? lines.map(text) : null;
}

const text = (line: readonly Piece[]): string => line.map((part, index) => (index > 0 && part.space ? ` ${part.text}` : part.text)).join("");

/**
 * Whether a word says a number, a level or a size ("01", "L1", "2x2", "123456789"): mostly digits, or
 * short with one. Cut inside, it reads as another number, and the name as another building.
 */
function holdsNumber(word: string): boolean {
  const digits = word.match(/\d/gu)?.length ?? 0;
  return digits > 0 && (word.length <= 4 || digits * 2 >= word.length);
}

/** Whether a word says nothing alone: a single letter, a word like "of", or a separator. A cut never keeps one for itself. */
const saysNothing = (word: string): boolean => [...word].length < 2 || STOP_WORDS.has(word.toLowerCase());

/**
 * The scripts whose letters have no case, as code point ranges, approximately: Hebrew, Arabic, the Indic scripts,
 * Thai, Hangul, Hiragana, Katakana and CJK, a block's few marks and signs among them, and the Indic scripts' digits.
 */
const UNCASED_LETTERS: readonly (readonly [number, number])[] = [
  [0x05d0, 0x05ea], [0x0620, 0x064a], [0x066e, 0x06d3], [0x0904, 0x0dff], [0x0e01, 0x0e3a], [0x0e40, 0x0e4e], [0x1100, 0x11ff], [0x3041, 0x3096], [0x309d, 0x309f], [0x30a1, 0x30fa], [0x30fc, 0x30ff],
  [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa960, 0xa97c], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xff66, 0xff9f], [0x20000, 0x3134f],
];

/** Other scripts' digits beyond 0-9, as code point ranges: Arabic-Indic, Persian, Thai, Lao, Myanmar, Khmer and fullwidth. */
const OTHER_DIGITS: readonly (readonly [number, number])[] = [
  [0x0660, 0x0669], [0x06f0, 0x06f9], [0x0e50, 0x0e59], [0x0ed0, 0x0ed9], [0x1040, 0x1049], [0x17e0, 0x17e9], [0xff10, 0xff19],
];

/** Every range a word's character may fall in beyond a cased letter and 0-9. */
const WORD_RANGES = [...UNCASED_LETTERS, ...OTHER_DIGITS];

/**
 * Whether a character is a letter or a digit, approximately as the Unicode letter and number classes have it.
 * Cohtml builds no Unicode property escape, so a cased letter is one whose upper and lower case differ, a digit
 * is 0-9 or one of `OTHER_DIGITS`, and a letter of a script without case is one of `UNCASED_LETTERS`.
 */
const isWordChar = (char: string): boolean => {
  if (char.toLowerCase() !== char.toUpperCase() || (char >= "0" && char <= "9")) return true;
  const point = char.codePointAt(0) ?? 0;
  return WORD_RANGES.some(([from, to]) => point >= from && point <= to);
};

/** The word as typed words begin it: lower case, any opening bracket, quote or other mark left off. */
export function opening(word: string): string {
  const lower = word.toLowerCase();
  let from = 0;
  for (const char of lower) {
    if (isWordChar(char)) break;
    from += char.length;
  }
  return lower.slice(from);
}

/** How hard a cut holds a word, the least first: a cut drops or cuts the words it holds least. */
const PLAIN = 0;
/** A name word a typed word of two characters or more begins, as a search matches it. */
const TYPED = 1;
/** A number, a level or a size the row is not told apart by: its look-alikes share it. */
const NUMBER = 2;
/** The word that tells the row apart from its look-alikes, a number or not: cut inside last, never dropped. */
const DISTINCT = 3;

/**
 * How hard a cut holds a word: the distinguishing word, matched whole; else a number; else a word a
 * typed word begins (a hyphenated word whole, and each of its parts); else none. A single letter or a
 * word like "of" is held only as a number.
 */
function holdOf(word: string, keep: readonly string[], typed: readonly string[]): number {
  const lower = word.toLowerCase();
  const number = holdsNumber(word);
  if ((number || !saysNothing(word)) && keep.some((wanted) => wanted.toLowerCase() === lower)) return DISTINCT;
  if (number) return NUMBER;
  if (saysNothing(word)) return PLAIN;
  const starts = [opening(lower), ...lower.split("-").map(opening)];
  return typed.some((wanted) => !saysNothing(wanted) && starts.some((start) => start.startsWith(wanted.toLowerCase()))) ? TYPED : PLAIN;
}

/**
 * Which words a cut keeps: `head` words, and the words from `from` up to `end`; none is dropped where the
 * head meets the rest. Only a cut that keeps a few words in the middle drops words after `end` too, with
 * a mark of its own.
 */
interface Shape {
  head: number;
  from: number;
  end: number;
}

/** Whether a shape keeps the word at `index`. */
const keeps = (shape: Shape, index: number): boolean => index < shape.head || (index >= shape.from && index < shape.end);

/**
 * Where a cut's words sit: a head and a tail ("head"); a head and some words in the middle, a mark after
 * each ("middle", "One… Perpendicular…"); or the head dropped, the mark opening the name ("lead").
 */
type Opening = "head" | "middle" | "lead";

/** A head and a tail; a middle cut or a leading one, weighed together, the first word kept counting for a cut; a leading one. */
const HEAD: readonly Opening[] = ["head"];
const AROUND: readonly Opening[] = ["middle", "lead"];
const LEAD: readonly Opening[] = ["lead"];

/**
 * The shapes a cut of the words may take, the whole first: a head and a tail with the dropped words
 * between, dropping no word `guarded` holds, the head never ending on a stop word nor the tail opening
 * on a separator. A middle or a leading cut's words run on to the end, or stop with a mark of their own,
 * never on a stop word.
 */
function shapes(words: readonly string[], guarded: (index: number) => boolean, opening: Opening): Shape[] {
  const count = words.length;
  const leading = opening === "lead";
  const out: Shape[] = opening === "head" ? [{ head: count, from: count, end: count }] : [];
  const seen = new Set<string>();
  const add = (shape: Shape) => {
    const key = `${shape.head} ${shape.from} ${shape.end}`;
    if (seen.has(key) || words.some((_, index) => !keeps(shape, index) && guarded(index))) return;
    seen.add(key);
    out.push(shape);
  };

  for (let head = leading ? 0 : count - 1; head >= (leading ? 0 : 1); head -= 1) {
    if (head > 0 && STOP_WORDS.has(words[head - 1].toLowerCase())) continue;

    for (let tail = head + 1; tail <= count; tail += 1) {
      // A separator the dropped words leave at the tail's front goes with them.
      let from = tail;
      while (from < count && SEPARATORS.has(words[from])) from += 1;
      if (head === 0 && from === count) continue;
      if (opening === "head") {
        add({ head, from, end: count });
        continue;
      }
      for (let end = leading ? count : count - 1; end > from; end -= 1) {
        if (end === count || !STOP_WORDS.has(words[end - 1].toLowerCase())) add({ head, from, end });
      }
    }
  }

  return out;
}

/**
 * The words a shape keeps, in its form: the mark ends the head, so a line may break before the tail.
 * Where the head ends on a word cut to its head ("Four…") its mark says the words dropped after it
 * too; without `merges`, where one mark would say two cuts, null.
 */
function shaped(forms: readonly string[], { head, from, end }: Shape, merges: boolean): string | null {
  if (head === from && end === forms.length) return forms.join(" ");
  const ended = (text: string): string | null => (!text.endsWith(CUT_MARK) ? `${text}${CUT_MARK}` : merges ? text : null);
  const front = forms.slice(0, head).join(" ");
  const kept = forms.slice(from, end).join(" ");
  const back = end === forms.length ? kept : ended(kept);
  if (back === null) return null;
  if (front === "") return `${CUT_MARK}${back}`;
  const marked = ended(front);
  return marked === null ? null : back === "" ? marked : `${marked} ${back}`;
}

/** A shape's words laid out; null where they need more lines or the shape says nothing. */
function laidOut(forms: readonly string[], shape: Shape, box: NameBox, merges = false): string[] | null {
  const line = shaped(forms, shape, merges);
  return line === null ? null : layout(pieces(line, false), box);
}

/** The fewest characters a word is cut to, its mark counted as `shortenTileLabel` counts it: a letter each side of it. */
const SHORTEST = 5;

/**
 * A word's forms cut inside it, the longest first, down to a letter each side of the mark. A hyphenated
 * word keeps a readable head, a part of two letters or more, and drops the rest ("Four…"), or stays
 * whole: "F…e" could be Five-Lane or Four-Lane.
 */
function cutsOf(word: string): string[] {
  const parts = word.split("-");
  if (parts.length > 1 && parts.every((part) => part !== "")) {
    if (parts[0].length < 2) return [];
    return parts.slice(1).map((_, at) => `${parts.slice(0, parts.length - 1 - at).join("-")}${CUT_MARK}`);
  }

  const out: string[] = [];
  for (let budget = word.length - 1; budget >= SHORTEST; budget -= 1) {
    const cut = shortenTileLabel(word, budget);
    if (cut !== word && cut !== out[out.length - 1]) out.push(cut);
  }
  return out;
}

/** The marks in a line. */
const marks = (line: string): number => line.split(CUT_MARK).length - 1;

/** A cut's worth, the better first: the most kept of the words held hardest, the fewest marks, the last word, the most kept. */
interface Scored {
  lines: string[];
  score: number[];
}

const better = (one: Scored, other: Scored | null): boolean => {
  if (other === null) return true;
  for (let at = 0; at < one.score.length; at += 1) {
    if (one.score[at] !== other.score[at]) return one.score[at] > other.score[at];
  }
  return false;
};

/** The characters a word's form keeps of it. */
const keptOf = (form: string): number => form.length - marks(form) * CUT_MARK.length;

/** A cut that fits, scored; null where a line carries more marks than `most`. */
function scored(lines: string[], forms: readonly string[], shape: Shape, holds: readonly number[], most: number): Scored | null {
  if (lines.some((line) => marks(line) > most)) return null;
  const keptWords = forms.map((_, index) => index).filter((index) => keeps(shape, index));
  const keptAt = (hold: number) => keptWords.filter((index) => holds[index] === hold).reduce((sum, index) => sum + keptOf(forms[index]), 0);
  const tail = shape.head === shape.from ? 0 : forms.slice(shape.from, shape.end).join(" ").length;
  const last = keptWords.includes(forms.length - 1) ? 1 : 0;
  const total = keptWords.reduce((sum, index) => sum + keptOf(forms[index]), 0);

  // The first word kept says the family, which a leading mark drops.
  const first = shape.head > 0 ? 1 : 0;
  return { lines, score: [keptAt(DISTINCT), keptAt(NUMBER), keptAt(TYPED), first, -lines.reduce((sum, line) => sum + marks(line), 0), last, total, tail] };
}

/**
 * The best cut of the whole words that fits: a head, the mark, and a tail, dropping no word `guarded`
 * holds; one keeping the last word first, then the most characters kept, then the longest tail.
 */
function bestCut(words: readonly string[], box: NameBox, guarded: (index: number) => boolean): string[] | null {
  let best: { lines: string[]; kept: number; tail: number } | null = null;

  for (const shape of shapes(words, guarded, "head")) {
    if (shape.head === shape.from) continue;
    const lines = laidOut(words, shape, box);
    if (lines === null) continue;

    // The last word first, where catalog names say which of a family a building is; then the most kept.
    const front = words.slice(0, shape.head).join(" ");
    const back = words.slice(shape.from).join(" ");
    const count = front.length + back.length;
    const wins = best === null
      || ((back !== "") !== (best.tail > 0) ? back !== "" : count > best.kept || (count === best.kept && back.length > best.tail));
    if (wins) best = { lines, kept: count, tail: back.length };
  }

  return best?.lines ?? null;
}

/**
 * The best cut that fits with words cut inside them, the least held first: for each hold from `least` to
 * `most`, the cuts that cut no word held harder, of which the best; null where none fits. From the
 * numbers' hold on, a number the row is not told apart by may be dropped too; with `dropsTyped`, a typed
 * word may be dropped at any hold, the distinguishing word kept over it. In each shape each word alone is
 * cut to the longest form that fits, and the words in turn, the least held and the widest first, each as
 * far as it must. A shape whose words cannot fit its lines even at their shortest is passed over.
 */
function cutInside(words: readonly string[], box: NameBox, holds: readonly number[], least: number, most: number, openings: readonly Opening[], mostMarks: number, dropsTyped = false): string[] | null {
  const cuts = words.map(cutsOf);
  // One mark saying two cuts only where a line may carry two.
  const merges = mostMarks > 1;
  let best: Scored | null = null;
  const consider = (forms: readonly string[], shape: Shape) => {
    const lines = laidOut(forms, shape, box, merges);
    const candidate = lines === null ? null : scored(lines, forms, shape, holds, mostMarks);
    if (candidate !== null && better(candidate, best)) best = candidate;
  };
  const fits = (forms: readonly string[], shape: Shape) => laidOut(forms, shape, box, merges) !== null;
  // The longest of a word's forms that fits, by halves: a shorter form never fits where a longer does not.
  const longest = (forms: string[], index: number, shape: Shape): number => {
    const own = cuts[index];
    let low = 0;
    let high = own.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      forms[index] = own[middle];
      if (fits(forms, shape)) {
        found = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    forms[index] = found >= 0 ? own[found] : words[index];
    return found;
  };
  const space = runWidth(" ", box);
  const shortest = (index: number, level: number) => runWidth(holds[index] <= level && cuts[index].length > 0 ? cuts[index][cuts[index].length - 1] : words[index], box);

  // The words no shape drops: every held word, or with `dropsTyped` every one held harder than a typed word.
  const guarded = (index: number) => holds[index] > (dropsTyped ? TYPED : PLAIN);
  const held = openings.flatMap((opening) => shapes(words, guarded, opening));
  const numbersFree = openings.flatMap((opening) => shapes(words, (index) => guarded(index) && holds[index] !== NUMBER, opening));

  for (let level = least; level <= most; level += 1) {
    for (const shape of level >= NUMBER ? numbersFree : held) {
      const kept = words.map((_, index) => index).filter((index) => keeps(shape, index));
      const room = box.lines * box.width - Math.max(0, kept.length - box.lines) * space;
      // Not even every word at its shortest fits the lines: no cut of this shape does. An ideograph is a
      // piece of its own, so a word holding one may break across lines.
      if (kept.some((index) => !WIDE.test(words[index]) && shortest(index, level) > box.width) || kept.reduce((sum, index) => sum + shortest(index, level), 0) > room) continue;

      for (const index of kept) {
        if (holds[index] > level) continue;
        const forms = [...words];
        if (longest(forms, index, shape) >= 0) consider(forms, shape);
      }
      // Whole words alone: a number dropped may be all the shape needs.
      if (laidOut(words, shape, box, merges) !== null) consider(words, shape);

      const order = kept.filter((index) => holds[index] <= level && cuts[index].length > 0)
        .sort((one, other) => holds[one] - holds[other] || runWidth(words[other], box) - runWidth(words[one], box));
      const forms = [...words];
      for (const index of order) {
        if (longest(forms, index, shape) >= 0) {
          consider(forms, shape);
          break;
        }
        forms[index] = cuts[index][cuts[index].length - 1];
      }
    }

    if (best !== null) return (best as Scored).lines;
  }

  return null;
}

/**
 * The whole name cut inside its words to the longest form that lays out, its head and its tail kept;
 * with `leads` a form whose mark opens it too. A hyphenated first word keeps its head part whole, as a
 * word cut inside does.
 */
function charCut(name: string, box: NameBox, leads: boolean): string[] | null {
  const [first = ""] = name.split(/\s+/);
  const part = first.includes("-") ? first.split("-")[0] : "";
  for (let budget = name.length - 1; budget > 1; budget -= 1) {
    const cut = shortenTileLabel(name, budget);
    if (!leads && cut.startsWith(CUT_MARK)) continue;
    const head = cut.split(CUT_MARK)[0];
    if (head !== "" && head.length < part.length) continue;
    const lines = layout(pieces(cut, false), box);
    if (lines !== null) return lines;
  }

  return null;
}

/**
 * Where no cut of whole words fits: the plain words cut inside them; then the typed words too; then the
 * numbers, cut or dropped. Then, where the row has a distinguishing word, that word whole with the first
 * word and a mark after each ("One… Perpendicular…"), so look-alikes of two families still read apart,
 * or with the mark leading where that keeps more of what is held, a typed word dropped where it must be;
 * with `leads`, only with the mark leading. Both before the word is cut inside, as two look-alikes that
 * lose it read alike. Then the whole name cut inside its words, then the mark leading, then the whole
 * name cut to its tail; and where not even the mark fits, no line. Without `further`, only the plain
 * words are cut, and once: no line where that does not fit and a word is held.
 */
function lastResort(name: string, words: readonly string[], box: NameBox, holds: readonly number[], further: boolean, leads: boolean): string[] {
  if (!further) {
    const inside = cutInside(words, box, holds, PLAIN, PLAIN, HEAD, 1);
    if (inside !== null) return inside;
    if (holds.some((hold) => hold > PLAIN)) return [];
    return charCut(name, box, false) ?? charCut(name, box, true) ?? (runWidth(CUT_MARK, box) <= box.width ? [CUT_MARK] : []);
  }

  // Around the distinguishing word a typed word may go: two look-alikes that lose that word read alike.
  const told = holds.includes(DISTINCT);
  const around = leads ? LEAD : AROUND;
  return cutInside(words, box, holds, PLAIN, NUMBER, HEAD, MOST_MARKS)
    ?? (told ? cutInside(words, box, holds, PLAIN, NUMBER, around, MOST_MARKS, true) : null)
    ?? cutInside(words, box, holds, DISTINCT, DISTINCT, HEAD, MOST_MARKS)
    ?? (told ? cutInside(words, box, holds, DISTINCT, DISTINCT, around, MOST_MARKS, true) : null)
    ?? charCut(name, box, false)
    ?? (told ? null : cutInside(words, box, holds, PLAIN, DISTINCT, LEAD, MOST_MARKS))
    ?? charCut(name, box, true)
    ?? (runWidth(CUT_MARK, box) <= box.width ? [CUT_MARK] : []);
}

/** The plans made lately, the latest last: a page plans the same names again at each render and keystroke. */
const plans = new Map<string, NamePlan>();

/** The most plans kept: a window's 2,000 names in the list, and its tiles' tags cut at a few rooms each. */
const MOST_PLANS = 8192;

/** How many plans were worked out rather than found kept. */
let worked = 0;

/** How many plans were worked out rather than found kept: a test seam, which counts what a view switch plans. */
export function plansWorkedOut(): number {
  return worked;
}

/**
 * How a name draws in a box: whole where it fits, else its best cut, never a line wider than the box.
 * The same name, room to a hundredth of a rem, type and hints plan once, while the plan fits the room
 * asked for; the plan is shared, and nobody changes it. See the module's comment.
 */
export function planName(name: string, room: NameBox, hints: NameHints = {}): NamePlan {
  // A width that says nothing is no room, never a line laid out against NaN.
  const width = Number.isFinite(room.width) ? Math.round(room.width * 100) / 100 : 0;
  const key = [name, width, room.lines, room.font, room.tracking ?? 0, (hints.keep ?? []).join("\u0002"), (hints.typed ?? []).join("\u0002"), hints.lastResort ?? true, hints.leads ?? false].join("\u0001");
  const known = plans.get(key);
  const box = Number.isFinite(room.width) ? room : { ...room, width: 0 };
  if (known !== undefined && planFits(known.lines, box)) {
    plans.delete(key);
    plans.set(key, known);
    return known;
  }

  worked += 1;
  const plan = planOnce(name, box, hints);
  Object.freeze(plan.lines);
  plans.set(key, Object.freeze(plan));
  if (plans.size > MOST_PLANS) plans.delete(plans.keys().next().value!);
  return plan;
}

/** The sketches made lately, the latest last, apart from the plans: a keystroke draws every far plate again. */
const sketches = new Map<string, NamePlan>();

/**
 * A name sketched rather than planned, for a plate away from the screen: whole where it fits, else the
 * whole name cut inside, its head and its tail kept, to the longest form found by halves that lays out;
 * else the mark alone, or no line. Never a line wider than the box, nor a plan worked out or counted: the
 * plate is planned once it comes near the screen. Kept as a plan is, by name and room, apart from the
 * plans. See docs/design-notes.md, "Names".
 */
export function sketchName(name: string, room: NameBox): NamePlan {
  const box = Number.isFinite(room.width) ? room : { ...room, width: 0 };
  const key = [name, Math.round(box.width * 100) / 100, box.lines, box.font, box.tracking ?? 0].join("\u0001");
  const known = sketches.get(key);
  if (known !== undefined && planFits(known.lines, box)) {
    sketches.delete(key);
    sketches.set(key, known);
    return known;
  }

  const sketch = sketchOnce(name, box);
  Object.freeze(sketch.lines);
  sketches.set(key, Object.freeze(sketch));
  if (sketches.size > MOST_PLANS) sketches.delete(sketches.keys().next().value!);
  return sketch;
}

/** A name's sketch, worked out. */
function sketchOnce(name: string, box: NameBox): NamePlan {
  const whole = name.trim();
  if (whole === "" || box.lines < 1) return { lines: [], whole: true };
  const fits = layout(pieces(whole, false), box);
  if (fits !== null) return { lines: fits, whole: true };

  let best: string[] | null = null;
  for (let low = 2, high = whole.length - 1; low <= high;) {
    const budget = (low + high) >> 1;
    const lines = layout(pieces(shortenTileLabel(whole, budget), false), box);
    if (lines !== null) {
      best = lines;
      low = budget + 1;
    } else {
      high = budget - 1;
    }
  }
  return { lines: best ?? (runWidth(CUT_MARK, box) <= box.width ? [CUT_MARK] : []), whole: false };
}

/** A name's plan, worked out. */
function planOnce(name: string, room: NameBox, hints: NameHints): NamePlan {
  const whole = name.trim();
  if (whole === "" || room.lines < 1) return { lines: [], whole: true };
  const box = room;

  const fits = layout(pieces(whole, false), box);
  if (fits !== null) return { lines: fits, whole: true };

  const words = whole.split(/\s+/);
  const holds = words.map((word) => holdOf(word, hints.keep ?? [], hints.typed ?? []));
  // A number goes only where no word could go in its place.
  const cut = bestCut(words, box, (index) => holds[index] > PLAIN) ?? bestCut(words, box, (index) => holds[index] > PLAIN && holds[index] !== NUMBER);
  const keptShare = cut === null ? 0 : (cut.join(" ").length - CUT_MARK.length) / whole.length;

  // A hyphen breaks only when every cut keeps too little of the name.
  if (keptShare < HYPHEN_SHARE) {
    const broken = layout(pieces(whole, true), box);
    if (broken !== null) return { lines: broken, whole: true };
  }

  return { lines: cut ?? lastResort(whole, words, box, holds, hints.lastResort ?? true, hints.leads ?? false), whole: false };
}

/** Whether a plan's lines each fit its box by the estimate: a line that does not is no evidence about the box it drew in. */
export function planFits(lines: readonly string[], box: NameBox): boolean {
  return lines.every((line) => runWidth(line, box) <= box.width);
}

/** A drawn line's width by the estimate, in the box's type and tracking. */
export function lineWidth(line: string, box: NameBox): number {
  return runWidth(line, box);
}

/** A run of a drawn line: plain, or a typed word, which is drawn in a span of its own. */
export interface NameRun {
  text: string;
  typed: boolean;
}

/** The zero-width space put after a span before a space: Cohtml drops a space that opens a text node after an inline element. */
export const AFTER_SPAN = "\u200B";

/**
 * A drawn line in runs, each typed word's every occurrence its own run; a plain run after a typed one
 * that opens with a space opens with U+200B before it, so the engine keeps the space.
 */
export function nameRuns(line: string, typed: string): NameRun[] {
  // Each word typed, as a cut keeps each: a phrase broken over two lines still dims on both.
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ text: line, typed: false }];

  const runs: NameRun[] = [];
  const lower = line.toLowerCase();
  let at = 0;

  for (;;) {
    // The nearest typed word from here, the longer where two start together.
    let found = -1;
    let length = 0;
    for (const word of words) {
      const index = lower.indexOf(word, at);
      if (index >= 0 && (found < 0 || index < found || (index === found && word.length > length))) {
        found = index;
        length = word.length;
      }
    }
    if (found < 0) break;

    if (found > at) runs.push({ text: line.slice(at, found), typed: false });
    runs.push({ text: line.slice(found, found + length), typed: true });
    at = found + length;
  }

  if (at < line.length) runs.push({ text: line.slice(at), typed: false });

  return runs.map((run, index) => (!run.typed && index > 0 && run.text.startsWith(" ") ? { ...run, text: AFTER_SPAN + run.text } : run));
}
