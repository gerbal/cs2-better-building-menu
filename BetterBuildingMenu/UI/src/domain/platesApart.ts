/**
 * The list's plates told apart over the page, beside the tiles' look-alike tags: the planner cuts each
 * name alone, and two names cut alike ("NA… Aluminum…" for NA Low and NA Tall Aluminum Fence) read as
 * one building. Each plate drawn as another plate of a different name draws is planned again: keeping,
 * beside its distinguishing word, the word that tells its name from theirs ("…Tall Aluminum…"); else
 * with the mark leading, its first word dropped ("…Angled…" beside "Two… Angled…"); else both. The
 * first plan that keeps its distinguishing word as whole as before and draws it apart from every plate
 * stands. Pure. See docs/design-notes.md, "Names".
 */
import { CUT_MARK, planName, SEPARATORS, STOP_WORDS, type NameBox } from "./namePlan";

/** A plate's name as the body plans it. */
export interface PlateName {
  id: number;
  name: string;
  /** The row's distinguishing word; "" for none. */
  distinct: string;
  /** The room the name is planned in: the plate's estimate. */
  room: NameBox;
}

/** What a plate's name is planned with beyond its own distinguishing word and the typed words. */
export interface ApartHints {
  /** The words that tell its name from those it drew alike. */
  keep: readonly string[];
  /** Whether a cut around its distinguishing word opens with the mark. */
  leads: boolean;
}

/** Nothing beyond each plate's own distinguishing word. */
const NONE: ReadonlyMap<number, ApartHints> = new Map();

const wordsOf = (name: string): string[] => name.split(/\s+/).filter(Boolean);

/** Whether a word can tell two names apart: not one that only parts two others, nor one like "with", nor a lone letter. */
const tells = (word: string): boolean => !SEPARATORS.has(word) && !STOP_WORDS.has(word.toLowerCase()) && [...word].length > 1;

/** A plan's lines as one text, which two plates draw alike where it is the same. */
const drawnText = (lines: readonly string[]): string => lines.join("\n");

/** Whether a plan's lines hold a word whole: as a word of its own, a mark at most either side. */
function holdsWhole(lines: readonly string[], word: string): boolean {
  const wanted = word.toLowerCase();
  const strip = new RegExp(`^${CUT_MARK}|${CUT_MARK}$`, "gu");
  return lines.some((line) => line.split(" ").some((token) => token.replace(strip, "").toLowerCase() === wanted));
}

/** The first of a name's words that tells it from another name: one the other does not hold. */
function wordFrom(words: readonly string[], other: readonly string[]): string | null {
  const theirs = new Set(other.map((word) => word.toLowerCase()));
  return words.find((word) => tells(word) && !theirs.has(word.toLowerCase())) ?? null;
}

/**
 * What each plate is planned with beyond its distinguishing word, by its id, where a plan with it tells the
 * plate apart from those it drew alike: none for every other plate. A plate is planned again only where it
 * draws as another plate of a different name, so a page plans few names twice, and each plan is the
 * planner's, kept by its hints as every plan is.
 */
export function wordsApart(plates: readonly PlateName[], typed: readonly string[]): ReadonlyMap<number, ApartHints> {
  const drawn = plates.map((plate) => planName(plate.name, plate.room, { keep: [plate.distinct], typed }).lines);
  const byText = new Map<string, number[]>();
  drawn.forEach((lines, at) => {
    if (lines.length === 0) return;
    const text = drawnText(lines);
    byText.set(text, [...(byText.get(text) ?? []), at]);
  });

  // How many plates draw each text, as the pass leaves them.
  const counts = new Map([...byText].map(([text, ats]) => [text, ats.length]));
  const found = new Map<number, ApartHints>();

  for (const ats of byText.values()) {
    if (ats.length < 2) continue;

    for (const at of ats) {
      const plate = plates[at];
      const words = wordsOf(plate.name);
      const others = ats.filter((other) => plates[other].name.toLowerCase() !== plate.name.toLowerCase());
      if (others.length === 0) continue;
      const extra = [...new Set(others.map((other) => wordFrom(words, wordsOf(plates[other].name))).filter((word): word is string => word !== null))];
      const before = drawnText(drawn[at]);
      const tries: ApartHints[] = [
        ...(extra.length > 0 ? [{ keep: extra, leads: false }] : []),
        { keep: [], leads: true },
        ...(extra.length > 0 ? [{ keep: extra, leads: true }] : []),
      ];

      for (const hints of tries) {
        const lines = planName(plate.name, plate.room, { keep: [plate.distinct, ...hints.keep], typed, leads: hints.leads }).lines;
        const text = drawnText(lines);
        // Apart from every plate as drawn now, and as whole as before in its distinguishing word.
        if (lines.length === 0 || (counts.get(text) ?? 0) > 0) continue;
        if (plate.distinct !== "" && holdsWhole(drawn[at], plate.distinct) && !holdsWhole(lines, plate.distinct)) continue;

        found.set(plate.id, hints);
        counts.set(before, (counts.get(before) ?? 1) - 1);
        counts.set(text, 1);
        break;
      }
    }
  }

  return found.size === 0 ? NONE : found;
}
