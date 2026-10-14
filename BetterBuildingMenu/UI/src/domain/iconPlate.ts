/**
 * What stands over an icon's picture, top to bottom: a locked icon's lock and why it waits in its upper
 * part, the icons with names' band at its foot (a family member's pill is `pillText`'s). Nothing meets at
 * any text scale: a piece that would gives way, and a word too wide for the icon is left off, never cut.
 * The lengths are iconsBody.module.scss's. Pure. See docs/design-notes.md, "The icons".
 */
import { textWidth } from "./textWidth";

/** The lock's top over the picture, `.locked`'s, and over a name band, `.lockedRow`'s. */
const LOCKED_TOP = 4;
const LOCKED_ROW_TOP = 2;

/** The lock glyph's side: `.lockGlyph`. */
const LOCK_GLYPH = 13;

/** Why it waits ("MS n"), its font and line at 100% text: `.milestone`. */
const WORD_FONT = 10;
const WORD_LINE = 11;

/** The room a word keeps from the icon's edges, both sides together. */
const WORD_INSET = 4;

/** The name band's line at 100% text and its room under it: `.nameBand`. */
const BAND_LINE = 12;
const BAND_BOTTOM = 1;

/** A locked icon's lock: the word it draws, "" for the lock alone, and where it ends from the icon's top. */
export interface LockedBlock {
  word: string;
  foot: number;
}

/**
 * A locked icon's lock and why it waits ("MS n", else the locked word): the word where it fits the icon at
 * this text scale, else the lock alone. Over a name band (`row`) the two sit side by side at the top; else
 * the word sits under the lock.
 */
export function lockedBlock(fact: string, iconSide: number, textScale: number, row: boolean): LockedBlock {
  const room = iconSide - WORD_INSET - (row ? LOCK_GLYPH : 0);
  // The wider of the game's two fonts, as the pill: erring wide leaves a word off, never cuts it.
  const word = textWidth(fact, WORD_FONT * textScale, "wider") <= room ? fact : "";
  const line = word === "" ? 0 : WORD_LINE * textScale;

  return { word, foot: row ? LOCKED_ROW_TOP + Math.max(LOCK_GLYPH, line) : LOCKED_TOP + LOCK_GLYPH + line };
}

/** The lines a name band holds under what stands over it, which ends `over` from the icon's top: two, or fewer. */
export function bandLines(iconSide: number, textScale: number, over: number): number {
  return Math.max(0, Math.min(2, Math.floor((iconSide - BAND_BOTTOM - over) / (BAND_LINE * textScale))));
}
