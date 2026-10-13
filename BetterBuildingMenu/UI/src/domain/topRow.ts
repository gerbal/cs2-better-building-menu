/**
 * What the top row says and how much of it fits: the search field's placeholder, the building
 * Enter arms, the controls' form, and where a control's popover opens. Pure, so every rule is a
 * test. Widths are the tab row's estimate, erring wide. See docs/design-notes.md, "The top row".
 */
import {
  CONTROL_CARET,
  CONTROL_CARET_GAP,
  CONTROL_DIVIDER,
  CONTROL_GLYPH,
  CONTROL_PADDING,
  CONTROL_PADDING_FOLDED,
  CONTROL_WORD_GAP,
  CONTROLS_GAP,
  FIELD_CLEAR,
  FIELD_GAP,
  FIELD_GLYPH,
  FIELD_MIN_WIDTH,
  FIELD_PADDING,
  POPOVER_WIDTH,
  TOP_ROW_TEXT,
} from "./assetMenuLayout";
import { LAYOUT_HEIGHT } from "./sharedContracts.generated";
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

/** Sort, Filter, Group and View, in their order on the row. */
export type ControlKind = "sort" | "filter" | "group" | "view";

/** A control as the strip draws it. */
export interface ControlCell {
  kind: ControlKind;
  /** Its word, drawn at 100% text: "Sort". */
  word: string;
  /** What it is set to now. */
  value: string;
  /** Every value it can show in this menu: its slot is as wide as the widest, so a pick never moves the strip. */
  values: readonly string[];
  /** Set away from how the menu opens: the value in the set colour, with a dot. */
  changed: boolean;
}

/** The words and the value, or a glyph and the value. */
export type ControlForm = "words" | "glyphs";

export interface ControlsPlan {
  form: ControlForm;
  /** The field's width: what the strip leaves of the row. */
  field: number;
  /** Each cell's value slot, in rem, in the cells' order. */
  slots: number[];
}

/** A cell's width as the sheet lays it out: padding, its word or glyph, the value's slot, the caret. */
function cellWidth(cell: ControlCell, slot: number, form: ControlForm, scale: number): number {
  const padding = form === "words" ? CONTROL_PADDING : CONTROL_PADDING_FOLDED;
  const lead = form === "words" ? textWidth(cell.word, TOP_ROW_TEXT * scale) : CONTROL_GLYPH;

  return 2 * padding + lead + CONTROL_WORD_GAP + slot + CONTROL_CARET_GAP + CONTROL_CARET;
}

/** The strip's width, with its gap from the field. */
function stripWidth(cells: readonly ControlCell[], slots: readonly number[], form: ControlForm, scale: number): number {
  if (cells.length === 0) return 0;

  return CONTROLS_GAP
    + cells.reduce((sum, cell, index) => sum + cellWidth(cell, slots[index], form, scale), 0)
    + (cells.length - 1) * CONTROL_DIVIDER;
}

/**
 * How the controls fit a row this wide, the row less close: their words at 100% text while the
 * field keeps its floor and, while a query is typed, its whole Enter target; else a glyph and the
 * value, as always from 110%. A value's slot is as wide as the widest the control can show here.
 */
export function planControls(input: { row: number; scale: number; cells: readonly ControlCell[]; fieldNeeds: number }): ControlsPlan {
  const font = TOP_ROW_TEXT * input.scale;
  const slots = input.cells.map((cell) => Math.max(textWidth(cell.value, font), ...cell.values.map((value) => textWidth(value, font))));
  const field = (form: ControlForm) => input.row - stripWidth(input.cells, slots, form, input.scale);
  const form: ControlForm = input.scale <= 1 && field("words") >= Math.max(FIELD_MIN_WIDTH, input.fieldNeeds) ? "words" : "glyphs";

  return { form, field: field(form), slots };
}

/** How wide the field must be to name a query's Enter target whole; 0 with nothing to name. */
export function fieldNeeds(query: string, target: string | null, scale: number): number {
  const font = TOP_ROW_TEXT * scale;

  return query.trim() === "" || target === null ? 0 : besideTheTarget(query, font) + textWidth(target, font);
}

/** What a popover's root carries, so a press inside it is not outside it. */
export const POPOVER_MARK = "data-bbm-popover";

/** What the controls strip carries: a press on a control opens, closes or switches its popover itself. */
export const CONTROLS_MARK = "data-bbm-controls";

/** Whether a pressed element, or one of its ancestors, carries an attribute. */
export function isWithin(target: unknown, attribute: string): boolean {
  type Node = { getAttribute?: (name: string) => string | null; parentElement?: unknown } | null | undefined;

  for (let node = target as Node; node; node = node.parentElement as Node) {
    if (typeof node.getAttribute === "function" && node.getAttribute(attribute) !== null) return true;
  }

  return false;
}

/** The open popover: whose control, and that control's left edge in the box, where it was measured. */
export interface OpenPopover {
  kind: ControlKind;
  left: number | null;
}

/**
 * A popover's left edge in the box: under its control, pulled left to end at the limit, never left of
 * the box; at the limit when the control was not measured.
 */
export function popoverLeft(controlLeft: number | null, limit: number): number {
  const latest = limit - POPOVER_WIDTH;

  return Math.max(0, controlLeft === null || !Number.isFinite(controlLeft) ? latest : Math.min(controlLeft, latest));
}

/** A control's left edge in the box, in rem, from two drawn rectangles' pixels; null when either is missing. */
export function controlLeftRem(cellLeftPx: number | undefined, rootLeftPx: number | undefined, innerHeight: number): number | null {
  if (typeof cellLeftPx !== "number" || typeof rootLeftPx !== "number" || !(innerHeight > 0)) return null;

  return ((cellLeftPx - rootLeftPx) * LAYOUT_HEIGHT) / innerHeight;
}
