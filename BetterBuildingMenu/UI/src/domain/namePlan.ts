/**
 * The name planner: how a name draws in a box of a width and a number of lines. Whole where it fits;
 * else cut once, between words, keeping every word that tells the name apart from a look-alike and the
 * words a search typed, its head never ending on a word like "of"; a hyphenated compound broken at its
 * hyphen only when every cut keeps too little; a word too long for a line cut inside it, the others
 * kept whole, so it never runs into the numbers beside it. Lines are laid out here, not by the engine,
 * from one advance table of the game's fonts: Cohtml never breaks at a hyphen, and Chromium does. Pure.
 * See docs/design-notes.md, "Names".
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

/** A run's width in a box's type, its tracking with it. */
const runWidth = (run: string, box: NameBox): number => textWidth(run, box.font) + (box.tracking ?? 0) * [...run].length;

/** The words a cut keeps: the row's distinguishing word, and the words a search typed. */
export interface NameHints {
  keep?: readonly string[];
}

export interface NamePlan {
  /** Each line the name draws, in order. */
  lines: string[];
  /** Whether the lines hold the whole name. */
  whole: boolean;
}

/** The mark a cut leaves where words were dropped: at most one, never leading. */
export const CUT_MARK = "…";

/** The share of its characters below which a cut keeps too little, and a hyphen may break instead. */
const HYPHEN_SHARE = 0.6;

/** Words a head never ends on: it would read as unfinished. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "at", "by", "de", "del", "der", "des", "die", "du", "for", "in", "la", "le", "of", "on", "the", "to", "und", "von", "with", "w/", "&", "+", "-", "–",
]);

/** A unit a line is laid out in: its text, and whether a space comes before it. */
interface Piece {
  text: string;
  space: boolean;
}

/** A name's pieces: its words, each ideograph a piece of its own, and with `hyphens` each compound split after its hyphens. */
function pieces(name: string, hyphens: boolean): Piece[] {
  const out: Piece[] = [];

  for (const word of name.split(/\s+/).filter(Boolean)) {
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

/** Whether a word is one a cut must keep: the distinguishing word, or one holding a typed word. */
const kept = (word: string, keep: readonly string[]): boolean =>
  keep.some((wanted) => wanted !== "" && word.toLowerCase().includes(wanted.toLowerCase()));

/**
 * The best cut of the words that fits: a head, the mark, and a tail, keeping every word a cut must
 * keep, the head never ending on a stop word; one keeping the last word first, then the most
 * characters kept, then the longest tail.
 */
function bestCut(words: readonly string[], box: NameBox, keep: readonly string[]): string[] | null {
  let best: { lines: string[]; kept: number; tail: number } | null = null;

  for (let head = words.length - 1; head >= 1; head -= 1) {
    if (STOP_WORDS.has(words[head - 1].toLowerCase())) continue;

    for (let tail = head + 1; tail <= words.length; tail += 1) {
      if (words.slice(head, tail).some((word) => kept(word, keep))) continue;

      const front = words.slice(0, head).join(" ");
      const back = words.slice(tail).join(" ");
      // The mark ends the head, so a line may break before the tail.
      const cut = back === "" ? `${front}${CUT_MARK}` : `${front}${CUT_MARK} ${back}`;
      const lines = layout(pieces(cut, false), box);
      if (lines === null) continue;

      // The last word first, where catalog names say which of a family a building is; then the most kept.
      const count = front.length + back.length;
      const better = best === null
        || ((back !== "") !== (best.tail > 0) ? back !== "" : count > best.kept || (count === best.kept && back.length > best.tail));
      if (better) best = { lines, kept: count, tail: back.length };
    }
  }

  return best?.lines ?? null;
}

/** A word too wide for a line, cut inside it to the longest form a line holds, its head and its tail kept. */
function shortenWord(word: string, box: NameBox): string {
  for (let budget = word.length - 1; budget > 1; budget -= 1) {
    const cut = shortenTileLabel(word, budget);
    if (runWidth(cut, box) <= box.width) return cut;
  }

  return shortenTileLabel(word, 2);
}

/** The name's words laid out, each too wide for a line cut inside it, the others whole; null where they need more lines. */
function wordCut(name: string, box: NameBox): string[] | null {
  return layout(pieces(name, false).map((part) => (runWidth(part.text, box) > box.width ? { ...part, text: shortenWord(part.text, box) } : part)), box);
}

/** A name cut inside its words, its head and its tail kept, short enough to lay out: the last resort. */
function charCut(name: string, box: NameBox): string[] {
  for (let budget = name.length - 1; budget > 1; budget -= 1) {
    const lines = layout(pieces(shortenTileLabel(name, budget), false), box);
    if (lines !== null) return lines;
  }

  return [shortenTileLabel(name, 2)];
}

/** How a name draws in a box: whole where it fits, else its best cut. See the module's comment. */
export function planName(name: string, room: NameBox, hints: NameHints = {}): NamePlan {
  const whole = name.trim();
  if (whole === "" || room.lines < 1) return { lines: [], whole: true };
  // A width that says nothing is no room: the name's shortest cut, never a line laid out against NaN.
  const box = Number.isFinite(room.width) ? room : { ...room, width: 0 };

  const fits = layout(pieces(whole, false), box);
  if (fits !== null) return { lines: fits, whole: true };

  const words = whole.split(/\s+/);
  const cut = bestCut(words, box, hints.keep ?? []);
  const keptShare = cut === null ? 0 : (cut.join(" ").length - CUT_MARK.length) / whole.length;

  // A hyphen breaks only when every cut keeps too little of the name.
  if (keptShare < HYPHEN_SHARE) {
    const broken = layout(pieces(whole, true), box);
    if (broken !== null) return { lines: broken, whole: true };
  }

  return { lines: cut ?? wordCut(whole, box) ?? charCut(whole, box), whole: false };
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
  const query = typed.trim().toLowerCase();
  if (query === "") return [{ text: line, typed: false }];

  const runs: NameRun[] = [];
  const lower = line.toLowerCase();
  let at = 0;

  for (let found = lower.indexOf(query); found >= 0; found = lower.indexOf(query, found + query.length)) {
    if (found > at) runs.push({ text: line.slice(at, found), typed: false });
    runs.push({ text: line.slice(found, found + query.length), typed: true });
    at = found + query.length;
  }

  if (at < line.length) runs.push({ text: line.slice(at), typed: false });

  return runs.map((run, index) => (!run.typed && index > 0 && run.text.startsWith(" ") ? { ...run, text: AFTER_SPAN + run.text } : run));
}
