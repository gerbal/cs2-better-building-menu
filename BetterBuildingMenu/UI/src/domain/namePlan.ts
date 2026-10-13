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

/** The word as typed words begin it: lower case, any opening bracket or quote left off. */
const opening = (word: string): string => word.toLowerCase().replace(/^[^\p{L}\p{N}]+/u, "");

/**
 * How hard a cut holds a word: 2 for a number or the distinguishing word, whole; 1 for a word a typed
 * word of two characters or more begins, as a search matches it (a hyphenated word's parts each begin
 * one); 0 for any other, which a cut drops or cuts first.
 */
function holdOf(word: string, keep: readonly string[], typed: readonly string[]): number {
  if (holdsNumber(word)) return 2;
  if (saysNothing(word)) return 0;
  const lower = word.toLowerCase();
  if (keep.some((wanted) => wanted.toLowerCase() === lower)) return 2;
  const starts = lower.split("-").map(opening);
  return typed.some((wanted) => !saysNothing(wanted) && starts.some((start) => start.startsWith(wanted.toLowerCase()))) ? 1 : 0;
}

/** Which words a cut keeps, `head` words and the words from `from` on; none is dropped where they meet. */
interface Shape {
  head: number;
  from: number;
}

/**
 * The shapes a cut of the words may take, the whole first: a head and a tail with the dropped words
 * between, dropping no word `guarded` holds, the head never ending on a stop word nor the tail opening
 * on a separator. With `leading` only the shapes that drop the head, the mark opening the name.
 */
function shapes(words: readonly string[], guarded: (index: number) => boolean, leading: boolean): Shape[] {
  const out: Shape[] = leading ? [] : [{ head: words.length, from: words.length }];
  const seen = new Set<number>();

  for (let head = leading ? 0 : words.length - 1; head >= (leading ? 0 : 1); head -= 1) {
    if (head > 0 && STOP_WORDS.has(words[head - 1].toLowerCase())) continue;

    for (let tail = head + 1; tail <= words.length; tail += 1) {
      // A separator the dropped words leave at the tail's front goes with them.
      let from = tail;
      while (from < words.length && SEPARATORS.has(words[from])) from += 1;
      if (words.slice(head, from).some((_, at) => guarded(head + at))) continue;
      if (head === 0 && from === words.length) continue;
      if (seen.has(head * 1000 + from)) continue;
      seen.add(head * 1000 + from);
      out.push({ head, from });
    }
  }

  return out;
}

/**
 * The words a shape keeps, in its form: the mark ends the head, so a line may break before the tail.
 * Where the head ends on a word cut to its head ("Four…") its mark says the words dropped after it
 * too; without `merges`, where one mark would say two cuts, null.
 */
function shaped(forms: readonly string[], { head, from }: Shape, merges: boolean): string | null {
  if (head === from) return forms.join(" ");
  const front = forms.slice(0, head).join(" ");
  const back = forms.slice(from).join(" ");
  if (front === "") return `${CUT_MARK}${back}`;
  const marked = !front.endsWith(CUT_MARK) ? `${front}${CUT_MARK}` : merges ? front : null;
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
  const keptWords = forms.map((_, index) => index).filter((index) => index < shape.head || index >= shape.from);
  const keptAt = (hold: number) => keptWords.filter((index) => holds[index] === hold).reduce((sum, index) => sum + keptOf(forms[index]), 0);
  const tail = shape.head === shape.from ? 0 : forms.slice(shape.from).join(" ").length;
  const last = keptWords.includes(forms.length - 1) ? 1 : 0;
  const total = keptWords.reduce((sum, index) => sum + keptOf(forms[index]), 0);

  return { lines, score: [keptAt(2), keptAt(1), -lines.reduce((sum, line) => sum + marks(line), 0), last, total, tail] };
}

/**
 * The best cut of the whole words that fits: a head, the mark, and a tail, dropping no word `guarded`
 * holds; one keeping the last word first, then the most characters kept, then the longest tail.
 */
function bestCut(words: readonly string[], box: NameBox, guarded: (index: number) => boolean): string[] | null {
  let best: { lines: string[]; kept: number; tail: number } | null = null;

  for (const shape of shapes(words, guarded, false)) {
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
 * The best cut that fits with words cut inside them, the least held first: for each hold, the cuts that
 * cut no word held harder, of which the best; null where none fits. In each shape each word alone is cut
 * to the longest form that fits, and the words in turn, the least held and the widest first, each as
 * far as it must. A shape whose words cannot fit its lines even at their shortest is passed over.
 */
function cutInside(words: readonly string[], box: NameBox, holds: readonly number[], most: number, leading: boolean, mostMarks: number): string[] | null {
  const best: (Scored | null)[] = [null, null, null];
  const cuts = words.map(cutsOf);
  // One mark saying two cuts only where a line may carry two.
  const merges = mostMarks > 1;
  const consider = (forms: readonly string[], shape: Shape, level: number) => {
    const lines = laidOut(forms, shape, box, merges);
    const candidate = lines === null ? null : scored(lines, forms, shape, holds, mostMarks);
    if (candidate !== null && better(candidate, best[level])) best[level] = candidate;
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

  for (const shape of shapes(words, (index) => holds[index] > 0, leading)) {
    const kept = words.map((_, index) => index).filter((index) => index < shape.head || index >= shape.from);
    const room = box.lines * box.width - Math.max(0, kept.length - box.lines) * space;

    for (let level = 0; level <= most; level += 1) {
      // Not even every word at its shortest fits the lines: no cut of this shape does. An ideograph is a
      // piece of its own, so a word holding one may break across lines.
      if (kept.some((index) => !WIDE.test(words[index]) && shortest(index, level) > box.width) || kept.reduce((sum, index) => sum + shortest(index, level), 0) > room) continue;

      for (const index of kept) {
        if (holds[index] !== level) continue;
        const forms = [...words];
        if (longest(forms, index, shape) >= 0) consider(forms, shape, level);
      }

      const order = kept.filter((index) => holds[index] <= level && cuts[index].length > 0)
        .sort((one, other) => holds[one] - holds[other] || runWidth(words[other], box) - runWidth(words[one], box));
      const forms = [...words];
      for (const index of order) {
        if (longest(forms, index, shape) >= 0) {
          consider(forms, shape, level);
          break;
        }
        forms[index] = cuts[index][cuts[index].length - 1];
      }
    }
  }

  return best.find((scoredCut) => scoredCut !== null)?.lines ?? null;
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
 * distinguishing word and the numbers. Then the whole name cut inside its words, then the mark leading,
 * the head dropped, then the whole name cut to its tail; and where not even the mark fits, no line.
 * Without `further`, only the plain words are cut, and once: no line where that does not fit and a word
 * is held.
 */
function lastResort(name: string, words: readonly string[], box: NameBox, holds: readonly number[], further: boolean): string[] {
  const inside = cutInside(words, box, holds, further ? 2 : 0, false, further ? MOST_MARKS : 1);
  if (inside !== null) return inside;
  if (!further && holds.some((hold) => hold > 0)) return [];

  return charCut(name, box, false)
    ?? (further ? cutInside(words, box, holds, 2, true, MOST_MARKS) : null)
    ?? charCut(name, box, true)
    ?? (runWidth(CUT_MARK, box) <= box.width ? [CUT_MARK] : []);
}

/** How a name draws in a box: whole where it fits, else its best cut, never a line wider than the box. See the module's comment. */
export function planName(name: string, room: NameBox, hints: NameHints = {}): NamePlan {
  const whole = name.trim();
  if (whole === "" || room.lines < 1) return { lines: [], whole: true };
  // A width that says nothing is no room, never a line laid out against NaN.
  const box = Number.isFinite(room.width) ? room : { ...room, width: 0 };

  const fits = layout(pieces(whole, false), box);
  if (fits !== null) return { lines: fits, whole: true };

  const words = whole.split(/\s+/);
  const holds = words.map((word) => holdOf(word, hints.keep ?? [], hints.typed ?? []));
  // A number goes only where no word could go in its place.
  const cut = bestCut(words, box, (index) => holds[index] > 0) ?? bestCut(words, box, (index) => holds[index] > 0 && !holdsNumber(words[index]));
  const keptShare = cut === null ? 0 : (cut.join(" ").length - CUT_MARK.length) / whole.length;

  // A hyphen breaks only when every cut keeps too little of the name.
  if (keptShare < HYPHEN_SHARE) {
    const broken = layout(pieces(whole, true), box);
    if (broken !== null) return { lines: broken, whole: true };
  }

  return { lines: cut ?? lastResort(whole, words, box, holds, hints.lastResort ?? true), whole: false };
}

/** Whether a plan's lines each fit its box by the estimate: a line that does not is no evidence about the box it drew in. */
export function planFits(lines: readonly string[], box: NameBox): boolean {
  return lines.every((line) => runWidth(line, box) <= box.width);
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
