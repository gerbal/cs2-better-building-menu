/**
 * The tiles' look-alike tags: on the tiles drawn, those sharing a first word, whatever its case, are a
 * run of look-alikes, whose pictures alone do not tell them apart, and every member gets a tag at its top
 * left saying what does: the whole name where it fits; else the word that tells the row apart (C#'s
 * DistinctWord); else that word and the next; else the run's word and that word, which tells two runs
 * apart; else the name cut once by the name planner, that word and every number whole, or that word
 * alone cut inside it where it is wider than the tag. A number is never bare ("#02"); no tag opens or
 * ends on a separator, nor is a word like "with" alone. Each tag is unique on the screen where a form can
 * make it so, and never says another tile's name. Pure. See docs/design-notes.md, "Names".
 */
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { CUT_MARK, SEPARATORS, STOP_WORDS } from "./namePlan";
import { cutToFit } from "./tileTag";

/** A tag's word: a number a family counts by says "#02", never a bare digit. */
function tagWord(word: string): string {
  const number = /^(\d+)([a-z]?)$/i.exec(word);
  return number === null ? word : `#${number[1].padStart(2, "0")}${number[2]}`;
}

const wordsOf = (entry: BuildingCatalogEntry): string[] => (entry.name || entry.prefabName).split(/\s+/).filter(Boolean);

/** Whether a word says something alone: not one that only parts two others, nor one like "with". */
const says = (word: string): boolean => !SEPARATORS.has(word) && !STOP_WORDS.has(word.toLowerCase());

/**
 * Where the word that tells a row apart sits: its distinguishing word, or past a separator or a word
 * like "with" the word after it ("Road with Median": Median); where nothing after it says more, the word
 * itself unless it only parts two others ("Flag A"); with none, its last word that says something. -1
 * where no word does.
 */
function ownWord(words: readonly string[], distinct: string): number {
  const wanted = distinct.toLowerCase();
  const at = wanted === "" ? -1 : words.findIndex((word) => word.toLowerCase() === wanted);
  if (at >= 0) {
    for (let next = at; next < words.length; next += 1) {
      if (says(words[next])) return next;
    }
    if (!SEPARATORS.has(words[at])) return at;
  }

  for (let last = words.length - 1; last >= 0; last -= 1) {
    if (says(words[last])) return last;
  }
  for (let last = words.length - 1; last >= 0; last -= 1) {
    if (!SEPARATORS.has(words[last])) return last;
  }

  return -1;
}

/** The own word and the next that says something, with what parts them; at the name's end, the one before and the own word. */
function pairOf(words: readonly string[], own: number): string {
  let next = own + 1;
  while (next < words.length && !says(words[next])) next += 1;
  if (next < words.length) return words.slice(own, next + 1).map(tagWord).join(" ");

  let before = own - 1;
  while (before >= 0 && !says(words[before])) before -= 1;
  return before >= 0 ? words.slice(before, own + 1).map(tagWord).join(" ") : "";
}

interface Member {
  entry: BuildingCatalogEntry;
  fits: (text: string) => boolean;
  /** Its tags that fit, in order; its cut joins them only once the others are spent. */
  forms: string[];
  level: number;
  /** The word that tells it apart, alone, where that is one of its forms; else null. */
  word: string | null;
  /** Whether its cut has been tried. */
  cut: boolean;
}

/**
 * A member's tags in words, each that fits: its whole name, the word that tells it apart unless that is
 * a word like "with", that word and the next, the run's word and that word. A member none of them fits
 * takes its cut at once; with no cut either it is null, and untagged.
 */
function memberOf(entry: BuildingCatalogEntry, fits: (text: string) => boolean): Member | null {
  const words = wordsOf(entry);
  const own = ownWord(words, entry.distinctWord ?? "");
  const word = own >= 0 && says(words[own]) ? tagWord(words[own]) : "";
  const candidates = [words.join(" "), word, own >= 0 ? pairOf(words, own) : "", own > 0 ? `${words[0]} ${tagWord(words[own])}` : ""];
  const forms = candidates.filter((form, index) => form !== "" && candidates.indexOf(form) === index && fits(form));
  const member: Member = { entry, fits, forms, level: 0, word: forms.includes(word) ? word : null, cut: false };

  return forms.length > 0 || addCut(member) ? member : null;
}

/**
 * Adds a member's last tag and moves to it: its name cut once by the name planner, the word that tells
 * it apart and every number whole; else, where that word alone is wider than the tag, the word cut
 * inside it ("Gam…Roof"). False where neither fits or says what a form already does: the mark alone says
 * nothing, and a name cut inside a word as well as between words is cut twice.
 */
function addCut(member: Member): boolean {
  member.cut = true;
  const words = wordsOf(member.entry);
  const own = ownWord(words, member.entry.distinctWord ?? "");
  const named = cutToFit(words.join(" "), member.fits, own >= 0 ? [words[own]] : []);
  const word = own >= 0 ? cutToFit(words[own], member.fits) : CUT_MARK;
  // One mark, and more than the mark: a word that fits whole is a form already.
  const cut = [named, word].find((form) => form !== CUT_MARK && form.split(CUT_MARK).length === 2 && !member.forms.includes(form));
  if (cut === undefined) return false;

  member.forms.push(cut);
  member.level = member.forms.length - 1;
  return true;
}

/**
 * The tag of each look-alike among the tiles drawn, by entry id: runs of two or more sharing a first
 * word, whatever its case. `fits` measures a tag in its tile's own room, a locked tile's beside its lock
 * glyph. A member whose tag reads as another's, or as another tile's name, takes its next form, each
 * pass at once, until none does or none has a form left. A member out of forms whose tag another still
 * says goes back to the word that tells it apart, rather than a longer form that tells no more; a tag
 * never says another tile's name, which leaves its member untagged.
 */
export function lookAlikeTags(entries: readonly BuildingCatalogEntry[], fits: (text: string, entry: BuildingCatalogEntry) => boolean): ReadonlyMap<number, string> {
  const runs = new Map<string, BuildingCatalogEntry[]>();
  // How many tiles drawn bear each name: a tag saying one reads as that tile.
  const names = new Map<string, number>();
  for (const entry of entries) {
    const words = wordsOf(entry);
    if (words.length === 0) continue;
    const first = words[0].toLowerCase();
    const run = runs.get(first);
    if (run === undefined) runs.set(first, [entry]);
    else run.push(entry);
    const name = words.join(" ").toLowerCase();
    names.set(name, (names.get(name) ?? 0) + 1);
  }

  const members = [...runs.values()].filter((run) => run.length > 1).flat()
    .map((entry) => memberOf(entry, (text) => fits(text, entry)))
    .filter((member): member is Member => member !== null);
  const said = (member: Member): string => member.forms[member.level].toLowerCase();
  const namesAnother = (member: Member): boolean => (names.get(said(member)) ?? 0) > (wordsOf(member.entry).join(" ").toLowerCase() === said(member) ? 1 : 0);
  const counted = (): Map<string, number> => {
    const tags = new Map<string, number>();
    for (const member of members) tags.set(said(member), (tags.get(said(member)) ?? 0) + 1);
    return tags;
  };

  for (;;) {
    // Every member of a collision moves on together, read from the pass's tags, not from one another's moves.
    const tags = counted();
    const clashing = members.filter((member) => (tags.get(said(member)) ?? 0) > 1 || namesAnother(member));

    let moved = false;
    for (const member of clashing) {
      if (member.level + 1 < member.forms.length) {
        member.level += 1;
        moved = true;
      } else if (!member.cut && addCut(member)) {
        moved = true;
      }
    }

    if (!moved) break;
  }

  const tags = counted();
  for (const member of members) {
    if ((tags.get(said(member)) ?? 0) > 1 && member.word !== null) member.level = member.forms.indexOf(member.word);
  }

  // A tag left saying another tile's name would read as that tile: its member goes untagged.
  return new Map(members.filter((member) => !namesAnother(member)).map((member) => [member.entry.id, member.forms[member.level]]));
}
