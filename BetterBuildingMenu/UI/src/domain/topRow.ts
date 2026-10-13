/**
 * What the top row says and how much of it fits: the search field's placeholder and the building
 * Enter arms. Pure, so every rule is a test. Widths are the tab row's estimate, erring wide. See
 * docs/design-notes.md, "The top row".
 */
import { FIELD_CLEAR, FIELD_GAP, FIELD_GLYPH, FIELD_PADDING, TOP_ROW_TEXT } from "./assetMenuLayout";
import type { BuildingCatalogPage } from "./buildingCatalog";
import { pageAnswers } from "./buildingSearchRank";
import { textWidth } from "./tabRow";

/** The one mark a cut text ends on. */
const ELLIPSIS = "…";

/** The longest start of a text that fits a width at this size, ending on "…" when cut; null when not a character fits. */
export function cutToWidth(text: string, room: number, fontRem: number): string | null {
  if (textWidth(text, fontRem) <= room) return text;

  for (let length = text.length - 1; length > 0; length--) {
    const cut = text.slice(0, length).trimEnd() + ELLIPSIS;
    if (textWidth(cut, fontRem) <= room) return cut;
  }

  return null;
}

/**
 * The field's placeholder: the word and the menu's name, then the name's first word where that
 * does not fit ("Search Parks" for Parks & Recreation), then the word alone. In a language with no
 * string of ours, the game's own word for a search field.
 */
export function searchPlaceholder(template: string | null, gameFallback: string, menuLabel: string, room: number, fontRem: number): string {
  if (template === null || !template.includes("{0}")) return gameFallback;

  const name = menuLabel.trim();

  for (const part of [name, name.split(/\s+/)[0] ?? ""]) {
    if (part === "") continue;
    const text = template.replace("{0}", part);
    if (textWidth(text, fontRem) <= room) return text;
  }

  return template.replace("{0}", "").trim();
}

/** What Enter arms while a query is typed: a building by its name, or nothing armable. */
export type EnterTarget = { kind: "match"; name: string } | { kind: "locked" };

/**
 * Enter's target for the query in the box: the page's best match, once the page answers this
 * query; nothing armable when every match is locked; null without a query, or while the page
 * still answers an older one.
 */
export function enterTarget(
  page: Pick<BuildingCatalogPage, "searchText" | "bestMatch" | "allMatchesLocked"> | null | undefined,
  query: string
): EnterTarget | null {
  if (query.trim() === "" || !pageAnswers(page, query)) return null;
  if (page?.bestMatch) return { kind: "match", name: page.bestMatch.name };
  return page?.allMatchesLocked ? { kind: "locked" } : null;
}

export interface FieldPlanInput {
  /** The field's width, in rem. */
  field: number;
  scale: number;
  /** The open menu's name, in the player's language. */
  menuLabel: string;
  /** "Search {0}" in the player's language, or null in one with no string of ours. */
  template: string | null;
  /** The game's own word for a search field. */
  gameFallback: string;
  query: string;
  /** What the field names at its right while a query is typed, or null. */
  target: string | null;
}

export interface FieldPlan {
  placeholder: string;
  /** The target as drawn, whole or cut to the room the query leaves; null when there is none, or no room. */
  target: string | null;
}

/** The Enter mark, a character of the field's text wide, and the gap after it. */
const markWidth = (fontRem: number): number => fontRem + FIELD_GAP;

/** All the field holds but its Enter target: padding, glyph, clear, the query, the mark and their gaps. */
function besideTheTarget(query: string, fontRem: number): number {
  return 2 * FIELD_PADDING + FIELD_GLYPH + 2 * FIELD_GAP + FIELD_CLEAR + textWidth(query, fontRem) + FIELD_GAP + markWidth(fontRem);
}

/** What the field draws at this width: its placeholder, and its Enter target whole when the query leaves it room. */
export function planField(input: FieldPlanInput): FieldPlan {
  const font = TOP_ROW_TEXT * input.scale;
  const room = input.field - 2 * FIELD_PADDING - FIELD_GLYPH - FIELD_GAP;
  const placeholder = searchPlaceholder(input.template, input.gameFallback, input.menuLabel, room, font);

  if (input.query.trim() === "" || input.target === null) return { placeholder, target: null };

  return { placeholder, target: cutToWidth(input.target, input.field - besideTheTarget(input.query, font), font) };
}
