/**
 * Plates' name bands: each look-alike the tags name says its name on a band across its tile's top, whole
 * or cut once between whole words, where that fits as its tag would and reads apart from every other
 * loaded tile; else its tag. Pure. See docs/design-notes.md, "The looks".
 */
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked } from "./buildingLockState";
import { ownWord, wordsOf } from "./lookAlikeTags";
import { CUT_MARK } from "./namePlan";
import { cutToTag, tagRoom } from "./tileTag";

/** The most names whose bands, or whose lowered forms, are kept: the 2,000 tiles a list loads, twice over. */
const MOST_NAMES = 4096;

/**
 * A band's width on a tile this wide: the tag's room, which its text is measured in, from the picture's
 * inset to the tile's edge, and on a locked tile to its lock glyph.
 */
export function bandWidth(tileWidth: number, locked: boolean): number {
  return tagRoom(tileWidth, locked);
}

/**
 * Whether a band's text is its name whole or cut once between whole words, the head's words opening it
 * and the tail's closing it, the word at `own` among them; -1 where no word is its own.
 */
function cutBetweenWords(text: string, words: readonly string[], own: number): boolean {
  const parts = text.split(CUT_MARK);
  if (parts.length === 1) return parts[0] === words.join(" ");
  if (parts.length !== 2) return false;

  const [head, tail] = parts.map((part) => part.split(/\s+/).filter(Boolean));
  const from = words.length - tail.length;
  return head.length + tail.length > 0 && head.length + tail.length < words.length
    && head.every((word, at) => word === words[at]) && tail.every((word, at) => word === words[from + at])
    && (own < 0 || own < head.length || own >= from);
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

/**
 * A tile's name on its band, whole or cut once between whole words to fit it as a tag fits, keeping the
 * word its tag tells it apart by: the word after a "with", which the planner is asked to hold, or a
 * single letter, which it never holds, so a cut without it is refused. Null where none fits.
 */
function bandOf(entry: BuildingCatalogEntry, byName: Map<string, CutBand>, tileWidth: number, textScale: number): Band | null {
  const name = entry.name || entry.prefabName;
  const distinct = entry.distinctWord ?? "";
  const locked = isEntryLocked(entry);
  const known = byName.get(name);
  if (known !== undefined && known.distinct === distinct && known.locked === locked) return known.band;

  const words = wordsOf(entry);
  const own = ownWord(words, distinct);
  const text = cutToTag(words.join(" "), tileWidth, textScale, { besideLock: locked, keep: own < 0 ? [] : [words[own]] });
  const [head, tail = ""] = text.toLowerCase().split(CUT_MARK).map((part) => part.trim());
  const opens = head.split(" ", 1)[0];
  const closes = tail.slice(tail.lastIndexOf(" ") + 1);
  const band = cutBetweenWords(text, words, own) ? { text, cut: text.includes(CUT_MARK), head, tail, opens, closes } : null;
  byName.set(name, { distinct, locked, band });
  if (byName.size > MOST_NAMES) byName.delete(byName.keys().next().value!);
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
    if (lowered.size > MOST_NAMES) lowered.delete(lowered.keys().next().value!);
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

/** How many loaded names the bands have been checked against, a whole name's count as one. */
let compared = 0;

/** How many loaded names the bands have been checked against: a test seam, which holds a page's check to its few candidates, never the page's square. */
export function namesCompared(): number {
  return compared;
}

/** Whether a band could be another loaded tile's name: that name whole, or one its head opens and its tail closes. */
function couldBeAnother(index: NameIndex, id: number, band: Band): boolean {
  const { head, tail } = band;
  compared += 1;
  if (!band.cut) return (index.whole.get(head) ?? 0) > (index.names.get(id) === head ? 1 : 0);

  // A name the cut could be opens with the head's first word and closes with the tail's last: the fewer of the two.
  const opening = head === "" ? undefined : index.byFirst.get(band.opens) ?? [];
  const closing = tail === "" ? undefined : index.byLast.get(band.closes) ?? [];
  const among = opening === undefined ? closing ?? [] : closing === undefined || opening.length <= closing.length ? opening : closing;

  return among.some((other) => {
    compared += 1;
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

  // A band said twice, or saying another loaded tile's tag, drawn or not, tells nothing apart: its own
  // tag does. Each pass turns bands to tags only, so it ends.
  const tagOf = new Map<string, number>();
  for (const [id, tag] of tags) tagOf.set(tag.toLowerCase(), id);
  for (let moved = true; moved;) {
    moved = false;
    const times = new Map<string, number>();
    const lower = said.map(({ text }) => text.toLowerCase());
    for (const key of lower) times.set(key, (times.get(key) ?? 0) + 1);
    said.forEach((each, at) => {
      const owner = tagOf.get(lower[at]);
      if (each.text !== each.tag && (times.get(lower[at])! > 1 || (owner !== undefined && owner !== each.id))) {
        each.text = each.tag;
        moved = true;
      }
    });
  }

  const bands = new Map(said.map(({ id, text }) => [id, text]));
  pageBands.set(tags, { tileWidth, textScale, tiles: [...entries], bands });
  return bands;
}
