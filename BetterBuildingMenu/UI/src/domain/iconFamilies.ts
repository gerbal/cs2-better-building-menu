/**
 * What the icons say of families: a member's pill, its family's varying word, and the plate tone that
 * alternates with each run of a family's members, so a run reads as one. The tone is a class, as Cohtml
 * has no `:nth-child(an+b)`. Pure. See docs/design-notes.md, "The icons".
 */
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { textWidth } from "./textWidth";

/** A pill's font at 100% text, and its padding both sides together: iconsBody.module.scss's `.pillWord`. */
const PILL_FONT = 10;
const PILL_PADDING = 10;

/** A pill's height at 100% text, `.pillWord`'s, and its room under it, `.pill`'s bottom. */
const PILL_LINE = 12;
const PILL_BOTTOM = 2;

/** The room a pill keeps from the icon's edges, both sides together. */
const PILL_INSET = 4;

/**
 * A family member's pill: its token ("05", "2x") where it fits the icon at this text scale and clears
 * what stands over it, which ends `over` from the icon's top (a locked icon's lock); "" for none.
 */
export function pillText(entry: BuildingCatalogEntry, iconSide: number, textScale: number, over = 0): string {
  const token = entry.familyToken ?? "";
  if (token === "" || over > iconSide - PILL_BOTTOM - PILL_LINE * textScale) return "";

  // The wider of the game's two fonts: erring wide leaves a pill off that would have fitted, never cut.
  return PILL_PADDING + textWidth(token, PILL_FONT * textScale, "wider") <= iconSide - PILL_INSET ? token : "";
}

/**
 * Each icon's tone, 0 or 1, in the order the icons are drawn: a run of one family's members takes the
 * other tone from the icons either side of it; icons in no family keep the tone of the run they stand in.
 */
export function familyTones(entries: readonly BuildingCatalogEntry[]): ReadonlyMap<number, number> {
  const tones = new Map<number, number>();
  let tone = 0;
  let previous: string | null = null;

  for (const entry of entries) {
    const run = entry.familyKey ? `family\u0001${entry.familyKey}` : "";
    if (previous !== null && run !== previous) tone = 1 - tone;
    previous = run;
    tones.set(entry.id, tone);
  }

  return tones;
}
