/**
 * The list's plates told apart over the page, beside the tiles' look-alike tags: the planner cuts each
 * name alone, and two names cut alike ("NA… Aluminum…" for NA Low and NA Tall Aluminum Fence) read as
 * one building. Each plate drawn as another plate of a different name draws is planned again: keeping,
 * beside its distinguishing word, the word of its own the fewest of the others hold ("…Tall Aluminum…");
 * else with the mark leading, its first word dropped ("…Angled…" beside "Two… Angled…"); else both; and
 * where a plan lands on a third plate's text, with the word that tells it from that plate kept too. The
 * first plan that keeps its distinguishing word as whole as before and draws it apart from every plate
 * stands. Where every name drawn alike holds that word, which so tells none of them apart, a plan that
 * cuts it inside stands if none keeps it whole ("Four-Lane As…ric…"), and one with its own word and not
 * that one if none holds it at all ("Two-Lane Divided…"). Pure but for the last pass it keeps. See
 * docs/design-notes.md, "Names".
 */
import { CUT_MARK, planName, SEPARATORS, STOP_WORDS, type NameBox, type NamePlan } from "./namePlan";

/** A plate's name as the body plans it. */
export interface PlateName {
  id: number;
  name: string;
  /** The row's distinguishing word; "" for none. */
  distinct: string;
  /** The room the name is planned in: the plate's estimate. */
  room: NameBox;
}

/**
 * How a plan holds the plate's distinguishing word: whole wherever the plan without hints does; or, where
 * every name it drew alike holds that word, so it tells none of them apart, cut inside it, or not kept.
 */
export type HeldWord = "whole" | "cut" | "free";

/** What a plate's name is planned with beyond its own distinguishing word and the typed words. */
export interface ApartHints {
  /** The words that tell its name from those it drew alike. */
  keep: readonly string[];
  /** Whether a cut around its distinguishing word opens with the mark. */
  leads: boolean;
  /** How the plan holds its distinguishing word. */
  held: HeldWord;
}

/** Nothing beyond each plate's own distinguishing word. */
const NONE: ReadonlyMap<number, ApartHints> = new Map();

/** Each hint once, by what it says, so a plate handed the same hints by another pass draws nothing again. */
const SAID_HINTS = new Map<string, ApartHints>();

/** The most hints kept: each a word a page's look-alikes are told apart by, either way. */
const MOST_HINTS = 4096;

/** The one object for hints that say this. */
function hintsFor(keep: readonly string[], leads: boolean, held: HeldWord = "whole"): ApartHints {
  const key = `${leads ? 1 : 0}${held}\u0001${keep.join("\u0001")}`;
  let hints = SAID_HINTS.get(key);
  if (hints === undefined) {
    if (SAID_HINTS.size >= MOST_HINTS) SAID_HINTS.clear();
    SAID_HINTS.set(key, (hints = { keep, leads, held }));
  }
  return hints;
}

/** A name planned with hints: its distinguishing word kept beside them, but where the hints free it. */
const hintedPlan = (name: string, room: NameBox, distinct: string, typed: readonly string[], hints: ApartHints): NamePlan =>
  planName(name, room, { keep: hints.held === "free" ? hints.keep : [distinct, ...hints.keep], typed, leads: hints.leads });

const wordsOf = (name: string): string[] => name.split(/\s+/).filter(Boolean);

/** Whether a word can tell two names apart: not one that only parts two others, nor one like "with", nor a lone letter. */
const tells = (word: string): boolean => !SEPARATORS.has(word) && !STOP_WORDS.has(word.toLowerCase()) && [...word].length > 1;

/** A plan's lines as one text, which two plates draw alike where it is the same. */
const drawnText = (lines: readonly string[]): string => lines.join("\n");

/** A mark opening or closing a word. */
const MARKS = new RegExp(`^${CUT_MARK}|${CUT_MARK}$`, "gu");

/** Whether a plan's lines hold a word whole: as a word of its own, a mark at most either side. */
function holdsWhole(lines: readonly string[], word: string): boolean {
  const wanted = word.toLowerCase();
  return lines.some((line) => line.split(" ").some((token) => token.replace(MARKS, "").toLowerCase() === wanted));
}

/**
 * Whether a plan's lines hold a word whole, or cut inside it: to its head and its tail ("As…ric"), or to a
 * head of two letters or more before the mark ("Single…"). Never where the word is dropped.
 */
function holdsCut(lines: readonly string[], word: string): boolean {
  const wanted = word.toLowerCase();
  return lines.some((line) => line.split(" ").some((token) => {
    const bare = token.replace(MARKS, "").toLowerCase();
    if (bare === wanted) return true;
    const [head, tail, ...more] = bare.split(CUT_MARK);
    if (more.length > 0) return false;
    if (tail === undefined) return token.endsWith(CUT_MARK) && bare.length >= 2 && wanted.startsWith(bare);
    return head !== "" && wanted.startsWith(head) && wanted.endsWith(tail);
  }));
}

/** The first word of a name's own that tells it from another name: one that name does not hold, a number among them. */
function wordApart(words: readonly string[], lower: readonly string[], other: string): string | null {
  const theirs = new Set(wordsOf(other));
  weighed += words.length + theirs.size;
  const at = lower.findIndex((word, index) => !theirs.has(word) && (tells(words[index]) || /\d/u.test(word)));
  return at < 0 ? null : words[at];
}

/** The most plans a pass asks for with hints: a page of thousands drawn alike tells its first plates apart, never costing a plan each. */
const MOST_TRIES = 600;

/**
 * The names in a row a group tries and fails to tell apart before the pass leaves it, no try parting its
 * names; but a group's first names are each tried, as a family of look-alikes is that small and a cut its
 * first names find can be one another family draws.
 */
const GROUP_GIVES_UP = 3;
const GROUP_TRIED_WHOLE = 6;

/** How many words the passes have weighed, each counted into its group's holders or read back out. */
let weighed = 0;

/** How many words the passes have weighed: a test seam, which holds a pass to its groups' words, never their square. */
export function wordsWeighed(): number {
  return weighed;
}

/** The last pass, by what it was worked out from: the plates' names, kept words, line counts, fonts and texts drawn alone. */
let last: { key: string; found: ReadonlyMap<number, ApartHints> } | null = null;

/**
 * The word of a name's own that the fewest of its group's other names hold, the first of those tied; null
 * where each of its words that tells is held by every name. `holders` counts, for each lower-cased word,
 * the group's names that hold it: one pass over the group, then one over this name's words.
 */
function rarestWord(words: readonly string[], lower: readonly string[], holders: ReadonlyMap<string, number>, names: number): string | null {
  let best: string | null = null;
  let fewest = names;
  weighed += words.length;
  words.forEach((word, at) => {
    const held = holders.get(lower[at]) ?? names;
    if (held < fewest && tells(word)) {
      best = word;
      fewest = held;
    }
  });
  return best;
}

/**
 * What each plate is planned with beyond its distinguishing word, by its id, where a plan with it tells the
 * plate apart from those it drew alike: none for every other plate. A plate is planned again only where it
 * draws as another plate of a different name, each with at most five hints (three, one more where a plan
 * lands on a third plate's text, and one freed of a shared word) and the pass with at most `MOST_TRIES`,
 * so a page plans few names twice, and each plan is the planner's, kept by its hints as every plan is.
 * Each group has its own budget: the smallest groups go first, and a group is left once `GROUP_GIVES_UP`
 * of its names in a row are told apart by no try, past its first `GROUP_TRIED_WHOLE`, so a large group no
 * try parts never spends what a later pair needs. A name the group holds twice is tried once:
 * each plate of it takes the hints its first took, drawn as its twins are. A pass over plates that draw
 * alone as the last pass's did (an Up or Down step moves Enter's mark, which narrows two rooms) answers as
 * that pass did.
 */
export function wordsApart(plates: readonly PlateName[], typed: readonly string[]): ReadonlyMap<number, ApartHints> {
  const drawn = plates.map((plate) => planName(plate.name, plate.room, { keep: [plate.distinct], typed }).lines);
  const texts = drawn.map(drawnText);
  const key = `${typed.join("\u0002")}\u0003${plates.map((plate, at) => `${plate.id}\u0001${plate.name}\u0001${plate.distinct}\u0001${plate.room.lines}\u0001${plate.room.font}\u0001${texts[at]}`).join("\u0002")}`;
  if (last !== null && last.key === key) return last.found;

  const byText = new Map<string, number[]>();
  texts.forEach((text, at) => {
    if (drawn[at].length === 0) return;
    const ats = byText.get(text);
    if (ats === undefined) byText.set(text, [at]);
    else ats.push(at);
  });

  // How many plates draw each text, as the pass leaves them, and the name of one that draws it, lower-cased.
  const counts = new Map([...byText].map(([text, ats]) => [text, ats.length]));
  const drawer = new Map([...byText].map(([text, ats]) => [text, plates[ats[0]].name.toLowerCase()]));
  const found = new Map<number, ApartHints>();
  let tries = 0;

  // The smallest groups first, each in page order: a pair is told apart before a group of thousands.
  const groups = [...byText.values()].filter((ats) => ats.length > 1).sort((one, other) => one.length - other.length);
  groups: for (const ats of groups) {

    // Each of the group's names once, its words once, as written and lower-cased; how many of those names
    // hold each word.
    const names = new Map<string, { words: string[]; lower: string[] }>();
    const nameOf = ats.map((at) => plates[at].name.toLowerCase());
    nameOf.forEach((lower, index) => {
      if (names.has(lower)) return;
      const words = wordsOf(plates[ats[index]].name);
      names.set(lower, { words, lower: words.map((word) => word.toLowerCase()) });
    });
    if (names.size < 2) continue;
    const holders = new Map<string, number>();
    for (const { lower } of names.values()) {
      const own = new Set(lower);
      weighed += own.size;
      for (const word of own) holders.set(word, (holders.get(word) ?? 0) + 1);
    }

    let failed = 0;
    // Each name tried, with the hints that drew it apart and what it drew, or null where none did.
    const tried = new Map<string, { hints: ApartHints; text: string } | null>();
    for (const [index, at] of ats.entries()) {
      const plate = plates[at];
      const before = texts[at];
      if (tried.has(nameOf[index])) {
        // A twin draws as its first plate does, where its room lets it; it costs no try and fails nothing.
        const first = tried.get(nameOf[index]);
        if (!first) continue;
        const text = drawnText(hintedPlan(plate.name, plate.room, plate.distinct, typed, first.hints).lines);
        if (text !== first.text && (counts.get(text) ?? 0) > 0) continue;
        found.set(plate.id, first.hints);
        counts.set(before, (counts.get(before) ?? 1) - 1);
        counts.set(text, (counts.get(text) ?? 0) + 1);
        drawer.set(text, nameOf[index]);
        continue;
      }
      if (failed >= GROUP_GIVES_UP && tried.size >= GROUP_TRIED_WHOLE) break;
      tried.set(nameOf[index], null);
      const { words, lower } = names.get(nameOf[index])!;
      const own = rarestWord(words, lower, holders, names.size);
      const hinted: ApartHints[] = [
        ...(own !== null ? [hintsFor([own], false)] : []),
        hintsFor([], true),
        ...(own !== null ? [hintsFor([own], true)] : []),
      ];

      failed += 1;
      // Whether every name drawn alike holds its distinguishing word, which so tells none of them apart.
      const shared = plate.distinct !== "" && holders.get(plate.distinct.toLowerCase()) === names.size;
      const whole = plate.distinct !== "" && holdsWhole(drawn[at], plate.distinct);
      // The first plan apart that cuts that shared word inside, which stands only where none keeps it whole.
      let cut: { hints: ApartHints; text: string } | null = null;
      let apart: { hints: ApartHints; text: string } | null = null;
      // Whether a plan has landed on a third plate's text, whose telling word is then tried once.
      let met = false;
      let spent = false;
      for (let next = 0; next < hinted.length && apart === null; next += 1) {
        if (tries >= MOST_TRIES) {
          spent = true;
          break;
        }
        tries += 1;
        const hints = hinted[next];
        const lines = hintedPlan(plate.name, plate.room, plate.distinct, typed, hints).lines;
        const text = drawnText(lines);
        if (lines.length === 0) continue;
        // Apart from every plate as drawn now. Drawn as a plate of another name, the word that tells it
        // from that name is kept too, once: "Corner" alone draws Garden Bed 01 Corner Low as 02 does.
        if ((counts.get(text) ?? 0) > 0) {
          const other = text === before ? undefined : drawer.get(text);
          if (!met && other !== undefined && other !== nameOf[index]) {
            met = true;
            const word = wordApart(words, lower, other);
            if (word !== null && !hints.keep.includes(word)) hinted.push(hintsFor([...hints.keep, word], hints.leads));
          }
          continue;
        }
        // As whole as before in its distinguishing word, or cut inside where the word is shared.
        if (whole && !holdsWhole(lines, plate.distinct)) {
          if (shared && cut === null && holdsCut(lines, plate.distinct)) cut = { hints: hintsFor(hints.keep, hints.leads, "cut"), text };
          continue;
        }
        apart = { hints, text };
      }

      // The shared word given up, cut or not kept, only where the plate still draws as another, and as at
      // most a family's few: a pair's second plate draws apart once its first is told apart, as it was, and
      // one plate of a large group drawn apart leaves the rest alike.
      const drawers = counts.get(before) ?? 0;
      const alike = drawers > 1 && drawers <= GROUP_TRIED_WHOLE;
      if (alike) apart ??= cut;
      // Where no plan holds the shared word and draws it apart, one with its own word, not that one.
      if (apart === null && alike && !spent && shared && own !== null) {
        if (tries >= MOST_TRIES) {
          spent = true;
        } else {
          tries += 1;
          const hints = hintsFor([own], false, "free");
          const lines = hintedPlan(plate.name, plate.room, plate.distinct, typed, hints).lines;
          const text = drawnText(lines);
          if (lines.length > 0 && (counts.get(text) ?? 0) === 0) apart = { hints, text };
        }
      }
      if (apart !== null) {
        found.set(plate.id, apart.hints);
        tried.set(nameOf[index], apart);
        counts.set(before, (counts.get(before) ?? 1) - 1);
        counts.set(apart.text, 1);
        drawer.set(apart.text, nameOf[index]);
        failed = 0;
      }
      if (spent) break groups;
    }
  }

  const answer = found.size === 0 ? NONE : found;
  last = { key, found: answer };
  return answer;
}

/**
 * A plate's name as it draws in its room: with what the pass hands it, where that plan holds the
 * distinguishing word as the hints say wherever the plan without them holds it whole: whole, or cut
 * inside it; else without them. The pass judged its hints in the plate's estimate, and the room as drawn
 * can be narrower, where the words they add can crowd out the one that tells the row apart.
 */
export function planApart(name: string, room: NameBox, distinct: string, typed: readonly string[], apart?: ApartHints): NamePlan {
  const alone = planName(name, room, { keep: [distinct], typed });
  if (apart === undefined) return alone;
  const hinted = hintedPlan(name, room, distinct, typed, apart);
  if (distinct === "" || apart.held === "free" || !holdsWhole(alone.lines, distinct)) return hinted;
  return (apart.held === "cut" ? holdsCut : holdsWhole)(hinted.lines, distinct) ? hinted : alone;
}
