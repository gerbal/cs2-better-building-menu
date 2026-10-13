/**
 * The tiles' look-alike tags: each tile drawn that shares its first word or its family with another gets
 * a tag saying what tells it apart, from its family's word or its distinguishing word, unique on the
 * screen or not drawn. Pure. See docs/design-notes.md, "Names".
 */
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked } from "./buildingLockState";
import { CUT_MARK, SEPARATORS, STOP_WORDS } from "./namePlan";
import { cutToTag, tagFits } from "./tileTag";

/** A tag's word: a number a family counts by says "#02", never a bare digit. */
function tagWord(word: string): string {
  const number = /^(\d+)([a-z]?)$/i.exec(word);
  return number === null ? word : `#${number[1].padStart(2, "0")}${number[2]}`;
}

const wordsOf = (entry: BuildingCatalogEntry): string[] => (entry.name || entry.prefabName).split(/\s+/).filter(Boolean);

/**
 * The run a tile stands in: its family's first word, so "BeachRaft01" and "BeachRaft02" are one run as
 * "Boulder 01" and "Boulder Random" are; else its own first word. "" for a tile with no words.
 */
function runOf(entry: BuildingCatalogEntry, words: readonly string[]): string {
  const family = (entry.familyKey ?? "").split(/\s+/).find(Boolean);
  return (family ?? words[0] ?? "").toLowerCase();
}

/** Whether a word says something alone: not one that only parts two others, nor one like "with". */
const says = (word: string): boolean => !SEPARATORS.has(word) && !STOP_WORDS.has(word.toLowerCase());

/**
 * Where the word that tells a row apart sits: its distinguishing word, or past a separator or a word
 * like "with" the word after it; where nothing after it says more, the word itself unless it only parts
 * two others ("Flag A"); with none, its last word that says something. -1 where no word does.
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

/**
 * Whether a word cut inside it still reads as that word: two letters or more each side of the mark; a
 * hyphenated word only cut to its head, a part of two letters or more ("Mansard…" for Mansard-Roof), as
 * the name planner cuts one.
 */
const readableCut = (cut: string, word: string): boolean =>
  word.includes("-")
    ? /^[^…]{2,}…$/u.test(cut) && word.startsWith(`${cut.slice(0, -CUT_MARK.length)}-`)
    : /^[^…]{2,}…[^…]{2,}$/u.test(cut);

/** The room a tile's tag is measured in. */
interface TagBox {
  tileWidth: number;
  textScale: number;
  fits: typeof tagFits;
}

/**
 * A tile's tags as worked out once for its name, distinguishing word, family's word and lock at a tile
 * width and text scale: the forms in words that fit, and its cut once tried (null for none).
 */
interface Forms {
  forms: readonly string[];
  cut?: string | null;
}

/**
 * The tiles' forms worked out lately, by the measure that decided them, the latest last: a Load more
 * works out only the new tiles', and only the collision pass runs over every tile.
 */
const worked = new WeakMap<typeof tagFits, Map<string, Forms>>();

/** The most tiles' forms kept: the 2,000 tiles a list loads, at two widths. */
const MOST_WORKED = 4096;

interface Member {
  entry: BuildingCatalogEntry;
  locked: boolean;
  /** Its forms as worked out, which its cut is kept on. */
  own: Forms;
  /** Its tags that fit, in order; its cut joins them only once the others are spent. */
  forms: string[];
  level: number;
  /** Whether its cut has been tried. */
  cut: boolean;
}

/**
 * A member's tags in words, each that fits: its whole name, its family's word ("#02", "2x2"), the word
 * that tells it apart unless that is a word like "with", that word and the next, the run's word and that
 * word. A member none of them fits takes its cut at once; with no cut either it is null, and untagged.
 */
function memberOf(entry: BuildingCatalogEntry, box: TagBox): Member | null {
  const locked = isEntryLocked(entry);
  const own = formsOf(entry, locked, box);
  const member: Member = { entry, locked, own, forms: [...own.forms], level: 0, cut: false };

  return member.forms.length > 0 || addCut(member, box) ? member : null;
}

/** A tile's forms in words, worked out once for its name, distinguishing word, family's word, lock, tile width and text scale. */
function formsOf(entry: BuildingCatalogEntry, locked: boolean, box: TagBox): Forms {
  let byTile = worked.get(box.fits);
  if (byTile === undefined) worked.set(box.fits, (byTile = new Map()));
  const key = `${entry.name || entry.prefabName}\u0001${entry.distinctWord ?? ""}\u0001${entry.familyToken ?? ""}\u0001${locked ? 1 : 0}\u0001${box.tileWidth}\u0001${box.textScale}`;
  const known = byTile.get(key);
  if (known !== undefined) {
    byTile.delete(key);
    byTile.set(key, known);
    return known;
  }

  const words = wordsOf(entry);
  const own = ownWord(words, entry.distinctWord ?? "");
  const telling = own >= 0 && says(words[own]);
  const candidates = [
    words.join(" "),
    entry.familyToken ? tagWord(entry.familyToken) : "",
    telling ? tagWord(words[own]) : "",
    own >= 0 ? pairOf(words, own) : "",
    telling && own > 0 ? `${words[0]} ${tagWord(words[own])}` : "",
  ];
  const forms: Forms = { forms: candidates.filter((form, index) => form !== "" && candidates.indexOf(form) === index && box.fits(form, box.tileWidth, box.textScale, locked)) };
  byTile.set(key, forms);
  if (byTile.size > MOST_WORKED) byTile.delete(byTile.keys().next().value!);
  return forms;
}

/**
 * Adds a member's last tag and moves to it: its name cut once by the name planner, the word that tells
 * it apart and every number whole; else, where that word alone is wider than the tag, the word cut
 * inside it ("Wat…ont", "Mansard…"). False where neither fits or says what a form already does. A
 * tile's cut is worked out once, with its forms.
 */
function addCut(member: Member, box: TagBox): boolean {
  member.cut = true;
  if (member.own.cut === undefined) member.own.cut = cutOf(member, box);
  if (member.own.cut === null) return false;

  member.forms.push(member.own.cut);
  member.level = member.forms.length - 1;
  return true;
}

/** A member's cut, its forms in words not yet joined by it; null where none fits or it says what a form does. */
function cutOf(member: Member, box: TagBox): string | null {
  const words = wordsOf(member.entry);
  const own = ownWord(words, member.entry.distinctWord ?? "");
  if (own < 0) return null;

  const word = words[own];
  const cut = (text: string, keep: readonly string[]) => cutToTag(text, box.tileWidth, box.textScale, { besideLock: member.locked, keep, fits: box.fits });
  // A name cut keeps the word whole, so it cannot fit where the word alone does not; and one cut inside
  // a word as well as between words is cut twice. Its numbers keep the name's own form: "#02" would
  // cost the room that lets the cut fit at all.
  const named = box.fits(word, box.tileWidth, box.textScale, member.locked) ? cut(words.join(" "), [word]) : CUT_MARK;
  const inside = cut(word, []);
  return [named, inside].find((text, index) => text !== CUT_MARK && (index === 0 ? text.split(CUT_MARK).length === 2 : readableCut(text, word)) && !member.own.forms.includes(text)) ?? null;
}

/**
 * What the tags read from a page: each tile's id, name, distinguishing word, family and lock, so a page
 * pushed again with the same tiles keeps its tags.
 */
export function lookAlikeKey(entries: readonly BuildingCatalogEntry[]): string {
  return entries
    .map((entry) => [entry.id, entry.name || entry.prefabName, entry.distinctWord ?? "", entry.familyKey ?? "", entry.familyToken ?? "", isEntryLocked(entry) ? 1 : 0].join("\u0001"))
    .join("\u0002");
}

/**
 * The tag of each look-alike among the tiles drawn, by entry id, each measured in its tile's room, a
 * locked tile's beside its lock glyph. Members whose tags read alike, or as another tile's name, take
 * their next forms together; a tag still said twice, or saying a name, is drawn on no tile.
 */
export function lookAlikeTags(entries: readonly BuildingCatalogEntry[], tileWidth: number, textScale: number, fits: typeof tagFits = tagFits): ReadonlyMap<number, string> {
  const box: TagBox = { tileWidth, textScale, fits };
  const runs = new Map<string, BuildingCatalogEntry[]>();
  // How many tiles drawn bear each name: a tag saying one reads as that tile.
  const names = new Map<string, number>();
  for (const entry of entries) {
    const words = wordsOf(entry);
    if (words.length === 0) continue;
    const key = runOf(entry, words);
    const run = runs.get(key);
    if (run === undefined) runs.set(key, [entry]);
    else run.push(entry);
    const name = words.join(" ").toLowerCase();
    names.set(name, (names.get(name) ?? 0) + 1);
  }

  const members = [...runs.values()].filter((run) => run.length > 1).flat()
    .map((entry) => memberOf(entry, box))
    .filter((member): member is Member => member !== null);
  const said = (member: Member): string => member.forms[member.level].toLowerCase();
  const namesAnother = (member: Member): boolean => (names.get(said(member)) ?? 0) > (wordsOf(member.entry).join(" ").toLowerCase() === said(member) ? 1 : 0);
  const counted = (): Map<string, number> => {
    const tags = new Map<string, number>();
    for (const member of members) tags.set(said(member), (tags.get(said(member)) ?? 0) + 1);
    return tags;
  };
  const clashes = (tags: Map<string, number>, member: Member): boolean => (tags.get(said(member)) ?? 0) > 1 || namesAnother(member);

  for (;;) {
    // Every member of a collision moves on together, read from the pass's tags, not from one another's moves.
    const tags = counted();
    let moved = false;
    for (const member of members.filter((each) => clashes(tags, each))) {
      if (member.level + 1 < member.forms.length) {
        member.level += 1;
        moved = true;
      } else if (!member.cut && addCut(member, box)) {
        moved = true;
      }
    }

    if (!moved) break;
  }

  // A tag two tiles share tells them apart by nothing, and one saying a name reads as that tile.
  const tags = counted();
  return new Map(members.filter((member) => !clashes(tags, member)).map((member) => [member.entry.id, member.forms[member.level]]));
}
