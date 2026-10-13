/**
 * The tiles' look-alike tags: each tile drawn that shares its first word or its family with another gets
 * a tag saying what tells it apart, from its family's word or its distinguishing word, unique on the
 * screen or not drawn; and Plates' name bands, which say a look-alike's name where it fits and its tag
 * where not. Pure. See docs/design-notes.md, "Names" and "The looks".
 */
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked } from "./buildingLockState";
import { CUT_MARK, SEPARATORS, STOP_WORDS } from "./namePlan";
import { cutToTag, tagFits, tagRoom } from "./tileTag";

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

/**
 * A band's width on a tile this wide: the tag's room, which its text is measured in, from the picture's
 * inset to the tile's edge, and on a locked tile to its lock glyph.
 */
export function bandWidth(tileWidth: number, locked: boolean): number {
  return tagRoom(tileWidth, locked);
}

/** Whether a band's text is its name whole or cut once between whole words: the head's words open it and the tail's close it. */
function cutBetweenWords(text: string, words: readonly string[]): boolean {
  const parts = text.split(CUT_MARK);
  if (parts.length === 1) return parts[0] === words.join(" ");
  if (parts.length !== 2) return false;

  const [head, tail] = parts.map((part) => part.split(/\s+/).filter(Boolean));
  return head.length + tail.length > 0 && head.length + tail.length < words.length
    && head.every((word, at) => word === words[at]) && tail.every((word, at) => word === words[words.length - tail.length + at]);
}

/**
 * A band of a tile's own: its text, and in lower case the words before its mark and after it, a whole
 * name all head, with the first word a name it could be opens with and the last it closes with.
 */
interface Band {
  text: string;
  cut: boolean;
  head: string;
  tail: string;
  opens: string;
  closes: string;
}

/** A tile's band as worked out for its distinguishing word and lock: null where none fits. */
interface CutBand {
  distinct: string;
  locked: boolean;
  band: Band | null;
}

/**
 * Each tile's band of its own as worked out lately, by tile width and text scale, then by name: a push of
 * the same tiles cuts no name again. The rooms kept are the latest few, each the names of a large page.
 */
const cutBands = new Map<string, Map<string, CutBand>>();

/** The most rooms whose bands are kept: two tile sizes at two text scales. */
const MOST_ROOMS = 4;

/** The bands worked out in a room, the room now the latest. */
function bandsIn(tileWidth: number, textScale: number): Map<string, CutBand> {
  const room = `${tileWidth}\u0001${textScale}`;
  const byName = cutBands.get(room) ?? new Map<string, CutBand>();
  cutBands.delete(room);
  cutBands.set(room, byName);
  if (cutBands.size > MOST_ROOMS) cutBands.delete(cutBands.keys().next().value!);
  return byName;
}

/** A tile's name on its band, whole or cut once between whole words to fit it as a tag fits; null where none does. */
function bandOf(entry: BuildingCatalogEntry, byName: Map<string, CutBand>, tileWidth: number, textScale: number): Band | null {
  const name = entry.name || entry.prefabName;
  const distinct = entry.distinctWord ?? "";
  const locked = isEntryLocked(entry);
  const known = byName.get(name);
  if (known !== undefined && known.distinct === distinct && known.locked === locked) return known.band;

  const words = wordsOf(entry);
  const text = cutToTag(words.join(" "), tileWidth, textScale, { besideLock: locked, keep: distinct ? [distinct] : [] });
  const [head, tail = ""] = text.toLowerCase().split(CUT_MARK).map((part) => part.trim());
  const opens = head.split(" ", 1)[0];
  const closes = tail.slice(tail.lastIndexOf(" ") + 1);
  const band = cutBetweenWords(text, words) ? { text, cut: text.includes(CUT_MARK), head, tail, opens, closes } : null;
  byName.set(name, { distinct, locked, band });
  if (byName.size > MOST_WORKED) byName.delete(byName.keys().next().value!);
  return band;
}

/** A name in lower case, its words one space apart, with its first and last word. */
interface Lowered {
  name: string;
  first: string;
  last: string;
}

/** Each name lowered once: a page lowers the same names at each push. */
const lowered = new Map<string, Lowered>();

function lowerName(entry: BuildingCatalogEntry): Lowered {
  const name = entry.name || entry.prefabName;
  let lower = lowered.get(name);
  if (lower === undefined) {
    const words = wordsOf(entry).map((word) => word.toLowerCase());
    lowered.set(name, (lower = { name: words.join(" "), first: words[0] ?? "", last: words[words.length - 1] ?? "" }));
    if (lowered.size > MOST_WORKED) lowered.delete(lowered.keys().next().value!);
  }
  return lower;
}

/**
 * The loaded tiles' names in lower case by id, with the ids whose name opens and whose name closes with
 * each word: a band's text is checked against the few names it could be, not every tile's.
 */
interface NameIndex {
  names: Map<number, string>;
  /** How many tiles bear each whole name. */
  whole: Map<string, number>;
  byFirst: Map<string, number[]>;
  byLast: Map<string, number[]>;
}

function nameIndex(entries: readonly BuildingCatalogEntry[]): NameIndex {
  const index: NameIndex = { names: new Map(), whole: new Map(), byFirst: new Map(), byLast: new Map() };
  const add = (map: Map<string, number[]>, word: string, id: number) => {
    const ids = map.get(word);
    if (ids === undefined) map.set(word, [id]);
    else ids.push(id);
  };

  for (const entry of entries) {
    const { name, first, last } = lowerName(entry);
    if (name === "") continue;
    index.names.set(entry.id, name);
    index.whole.set(name, (index.whole.get(name) ?? 0) + 1);
    add(index.byFirst, first, entry.id);
    add(index.byLast, last, entry.id);
  }

  return index;
}

/** Whether a band could be another loaded tile's name: that name whole, or one its head opens and its tail closes. */
function couldBeAnother(index: NameIndex, id: number, band: Band): boolean {
  const { head, tail } = band;
  if (!band.cut) return (index.whole.get(head) ?? 0) > (index.names.get(id) === head ? 1 : 0);

  // A name the cut could be opens with the head's first word and closes with the tail's last: the fewer of the two.
  const opening = head === "" ? undefined : index.byFirst.get(band.opens) ?? [];
  const closing = tail === "" ? undefined : index.byLast.get(band.closes) ?? [];
  const among = opening === undefined ? closing ?? [] : closing === undefined || opening.length <= closing.length ? opening : closing;

  return among.some((other) => {
    const name = index.names.get(other)!;
    return other !== id && name.length >= head.length + tail.length
      && (head === "" || name === head || name.startsWith(`${head} `))
      && (tail === "" || name === tail || name.endsWith(` ${tail}`));
  });
}

/** The bands last worked out from a page's tags, with the room and the tiles they were worked out for. */
interface PageBands {
  tileWidth: number;
  textScale: number;
  tiles: readonly BuildingCatalogEntry[];
  bands: ReadonlyMap<number, string>;
}

/** Each tags map's bands: a page pushed again with the same tiles keeps its tags, and so its bands. */
const pageBands = new WeakMap<ReadonlyMap<number, string>, PageBands>();

/** Whether a tile reads as it did: its id, name, distinguishing word and lock, all a band reads. */
const sameTile = (one: BuildingCatalogEntry, other: BuildingCatalogEntry): boolean => one === other
  || (one.id === other.id && (one.name || one.prefabName) === (other.name || other.prefabName) && (one.distinctWord ?? "") === (other.distinctWord ?? "") && isEntryLocked(one) === isEntryLocked(other));

/**
 * Plates' name bands: each look-alike the tags name, named on a band at its top, its name whole or cut
 * once between whole words by the name planner, its distinguishing word kept, measured as its tag is.
 * Where no such cut fits, where a band could be another loaded tile's name, or where it reads as another
 * band or tag, it says its tile's tag instead, which is unique on the screen and fits the same room.
 * See docs/design-notes.md, "The looks".
 */
export function tileBands(entries: readonly BuildingCatalogEntry[], tags: ReadonlyMap<number, string>, tileWidth: number, textScale: number): ReadonlyMap<number, string> {
  const last = pageBands.get(tags);
  if (last !== undefined && last.tileWidth === tileWidth && last.textScale === textScale && last.tiles.length === entries.length
    && entries.every((entry, at) => sameTile(entry, last.tiles[at]))) {
    return last.bands;
  }

  const index = nameIndex(entries);
  const byName = bandsIn(tileWidth, textScale);
  const said: { id: number; tag: string; text: string }[] = [];
  for (const entry of entries) {
    const tag = tags.get(entry.id);
    if (tag === undefined) continue;
    const band = bandOf(entry, byName, tileWidth, textScale);
    said.push({ id: entry.id, tag, text: band !== null && !couldBeAnother(index, entry.id, band) ? band.text : tag });
  }

  // A band said twice, or saying another tile's tag, tells nothing apart: its own tag does. Each pass
  // turns bands to tags only, so it ends.
  for (let moved = true; moved;) {
    moved = false;
    const times = new Map<string, number>();
    const lower = said.map(({ text }) => text.toLowerCase());
    for (const key of lower) times.set(key, (times.get(key) ?? 0) + 1);
    said.forEach((each, at) => {
      if (each.text !== each.tag && times.get(lower[at])! > 1) {
        each.text = each.tag;
        moved = true;
      }
    });
  }

  const bands = new Map(said.map(({ id, text }) => [id, text]));
  pageBands.set(tags, { tileWidth, textScale, tiles: [...entries], bands });
  return bands;
}
