/**
 * The tab row's cells, from the bindings: which draw, in what order, what each says and sends, and
 * which is lit. Pure, so every rule is a test. See docs/design-notes.md, "The tab row".
 */
import {
  TAB_CELL_GAP,
  TAB_CELL_MIN_WIDTH,
  TAB_CELL_PADDING,
  TAB_COUNT_SIZE,
  TAB_NAME_GAP,
  TAB_NAME_SIZE,
  TAB_ROW_HEIGHT,
  TAB_ROW_INSET,
  TAB_SEGMENT_MARGIN,
} from "./assetMenuLayout";
import { isEducationMenu } from "./buildingGroups";
import { branchTabTooltip, expandedTabsFor, schoolTierTabs, type MenuBranchCount, type MenuCategoryTabs, type TierBracket } from "./menuProgression";
import {
  ALL_CATEGORIES_ID,
  categoryCount,
  isAssetMenuScoped,
  isCategorySelected,
  presentCategories,
  shouldShowCategoryStrip,
  type MenuCategoryCount,
  type VanillaMenuCategory,
} from "./vanillaMenuCategories";

/** What a cell stands for, which decides what a click on it sends. */
export type TabCellKind = "all" | "category" | "branch" | "tierParent" | "tier";

export interface TabCell {
  key: string;
  kind: TabCellKind;
  /** What a click sends: a category's id, a strip tab's id, or a level. */
  id: string;
  label: string;
  /** The picture it draws; a worded cell draws none. */
  icon: string;
  /** Null until C# sends the menu's counts: the cell draws its count blank, not a faint 0. */
  count: number | null;
  lit: boolean;
  /** The filters or the search leave nothing in it: it draws faint, where it was. */
  empty: boolean;
  /** It says its name, because its picture would not tell it apart. */
  named: boolean;
}

/** Education's tab and its levels, drawn as one plate. */
export interface TabBracket {
  kind: "bracket";
  key: string;
  parent: TabCell;
  tiers: TabCell[];
}

export type TabRowItem = TabCell | TabBracket;

export interface TabRowInput {
  menu: string;
  /** The menu's own icon, which the All cell draws on its plate. */
  menuIcon: string;
  allLabel: string;
  /** Null until C# sends the menu's counts: the All cell draws it blank, like the others. */
  allCount: number | null;
  categories: readonly VanillaMenuCategory[];
  counts: readonly MenuCategoryCount[];
  selectedCategory: string;
  expanded: readonly MenuCategoryTabs[];
  stripTabs: readonly MenuBranchCount[];
  selectedStripTabs: readonly string[];
  bracket: TierBracket;
  selectedTier: number;
  /** A category's name in the player's language. */
  categoryLabel: (category: VanillaMenuCategory) => string;
}

export interface TabRowView {
  items: TabRowItem[];
  /** The lit cell's name, which the readout gives. */
  place: string;
}

/** Every cell of a row, Education's plate opened up. */
export function cellsOf(items: readonly TabRowItem[]): TabCell[] {
  return items.flatMap((item) => (item.kind === "bracket" ? [item.parent, ...item.tiers] : [item]));
}

const cell = (key: string, kind: TabCellKind, id: string, label: string, icon: string, count: number | null, lit: boolean): TabCell =>
  ({ key, kind, id, label, icon, count, lit, empty: count === 0, named: false });

/**
 * The row as it draws: All first, then the game's tabs in its order (a split category's branches
 * in its place, Education's tab opened into its levels), or a one-category menu's strip; then which
 * cells say their names, and the lit cell's name.
 */
export function tabRow(input: TabRowInput): TabRowView {
  const scoped = isAssetMenuScoped(input.menu);
  const items: TabRowItem[] = [
    cell(
      "all", "all", ALL_CATEGORIES_ID, input.allLabel, scoped ? input.menuIcon : "", input.allCount,
      isCategorySelected(ALL_CATEGORIES_ID, input.selectedCategory) && input.selectedTier < 0 && input.selectedStripTabs.length === 0
    ),
  ];

  if (scoped && shouldShowCategoryStrip(input.categories, input.menu)) {
    items.push(...presentCategories(input.categories, input.counts).flatMap((category) => categoryItems(input, category)));
  } else if (scoped && input.stripTabs.length > 1) {
    items.push(...input.stripTabs.map((tab) => branchCell(tab, branchTabTooltip(tab, ""), input.selectedStripTabs)));
  }

  const named = nameUntoldPictures(items, input.menuIcon);
  const cells = cellsOf(named);
  const lit = cells.find((candidate) => candidate.kind === "tier" && candidate.lit) ?? cells.find((candidate) => candidate.lit);

  return { items: named, place: lit?.label ?? input.allLabel };
}

/** A category's place in the row: its own cell, its branches, or Education's plate. */
function categoryItems(input: TabRowInput, category: VanillaMenuCategory): TabRowItem[] {
  const label = input.categoryLabel(category);
  const count = categoryCount(input.counts, category.id);
  const picked = isCategorySelected(category.id, input.selectedCategory) && input.selectedStripTabs.length === 0;
  const tiers = schoolTierTabs(input.bracket.tiers);

  if (isEducationMenu(input.menu) && category.id === input.bracket.parentCategory && tiers.length > 1) {
    return [{
      kind: "bracket",
      key: `bracket-${category.id}`,
      // Lit with a level too: a level's pick sets its tab as well.
      parent: cell(category.id, "tierParent", category.id, label, category.icon, count, picked),
      tiers: tiers.map((tier) => ({
        ...cell(`tier-${tier.level}`, "tier", String(tier.level), tier.label, "", tier.count, input.selectedTier === tier.level),
        named: true,
      })),
    }];
  }

  const branches = expandedTabsFor(input.expanded, category.id);

  return branches.length > 1
    ? branches.map((branch) => branchCell(branch, branchTabTooltip(branch, label), input.selectedStripTabs))
    : [cell(category.id, "category", category.id, label, category.icon, count, picked && input.selectedTier < 0)];
}

/** A strip tab, on the strip or in its category's place. */
function branchCell(tab: MenuBranchCount, label: string, selected: readonly string[]): TabCell {
  return cell(`branch-${tab.id}`, "branch", tab.id, label, tab.icon, tab.count, selected.includes(tab.id));
}

/**
 * A cell says its name where its picture would not tell it apart: no picture, the menu's own (the
 * All cell draws that on its plate), or one another cell draws too. A level always says its name.
 */
function nameUntoldPictures(items: readonly TabRowItem[], menuIcon: string): TabRowItem[] {
  const uses = new Map<string, number>();

  for (const candidate of cellsOf(items)) {
    if (candidate.kind !== "all" && candidate.kind !== "tier") uses.set(candidate.icon, (uses.get(candidate.icon) ?? 0) + 1);
  }

  const name = (candidate: TabCell): TabCell => {
    if (candidate.kind === "tier") return candidate;
    const named = candidate.kind === "all"
      ? candidate.icon === ""
      : candidate.icon === "" || candidate.icon === menuIcon || (uses.get(candidate.icon) ?? 0) > 1;
    return { ...candidate, named };
  };

  return items.map((item) => (item.kind === "bracket" ? { ...item, parent: name(item.parent), tiers: item.tiers.map(name) } : name(item)));
}

/** A picture's size in its slot, as fractions of the slot's side. */
export interface IconFit {
  width: number;
  height: number;
}

export const SQUARE: IconFit = { width: 1, height: 1 };

/** Its long side fills the slot and its short side scales, since Cohtml has no object-fit; square until its size is known. */
export function fitIcon(naturalWidth: number, naturalHeight: number): IconFit {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return SQUARE;
  const long = Math.max(naturalWidth, naturalHeight);
  return { width: naturalWidth / long, height: naturalHeight / long };
}

/** A count C# sent, or null while it has not: the binding's initial value is negative. */
export function arrivedCount(value: number | null | undefined): number | null {
  return typeof value === "number" && value >= 0 ? value : null;
}

/** Overpass draws about half an em a character; an estimate erring wide only costs the readout its place line sooner. */
const EM_PER_CHARACTER = 0.55;

/** A run of text's width in rem, estimated: the row cuts what an estimate gets wrong. */
export function textWidth(text: string, fontRem: number): number {
  return text.length * EM_PER_CHARACTER * fontRem;
}

/** How much of the readout the row shows: its place over its range, or the range alone, which always stays. */
export type ReadoutForm = "full" | "range";

export interface TabRowPlan {
  readout: ReadoutForm;
  /** The last tabs run past the room the readout leaves, and the row cuts them. */
  clipped: boolean;
}

/** A cell's width as the sheet lays it out: a picture over its count, or a name beside it. */
function cellWidth(cell: TabCell, scale: number, format: (count: number) => string): number {
  const countWidth = textWidth(cell.count === null ? "" : format(cell.count), TAB_COUNT_SIZE * scale);

  if (cell.named || cell.kind === "tier") {
    return textWidth(cell.label, TAB_NAME_SIZE * scale) + TAB_NAME_GAP + countWidth + 2 * TAB_CELL_PADDING;
  }

  return Math.max(TAB_CELL_MIN_WIDTH, Math.max(TAB_ROW_HEIGHT - TAB_COUNT_SIZE * scale, countWidth) + 2 * TAB_CELL_PADDING);
}

function itemWidth(item: TabRowItem, scale: number, format: (count: number) => string): number {
  if (item.kind !== "bracket") return cellWidth(item, scale, format);

  const cells = [item.parent, ...item.tiers];
  return 2 * TAB_SEGMENT_MARGIN
    + cells.reduce((sum, member) => sum + cellWidth(member, scale, format), 0)
    + (cells.length - 1) * TAB_CELL_GAP;
}

/**
 * How the row fits a box this wide. The readout's place line gives way first: the two lines fit
 * the row only at 100% text. Its range always stays, and the last tabs run past the room it leaves,
 * where the row cuts them: it never wraps.
 */
export function planTabRow(
  items: readonly TabRowItem[],
  readout: { place: string; range: string },
  boxWidth: number,
  scale: number,
  format: (count: number) => string
): TabRowPlan {
  const widths = items.map((item) => itemWidth(item, scale, format));
  const cells = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * TAB_CELL_GAP;
  // The spacer and the readout each sit a gap past what comes before them.
  const room = boxWidth - 2 * TAB_ROW_INSET - cells - 2 * TAB_CELL_GAP;
  const range = textWidth(readout.range, TAB_COUNT_SIZE * scale);
  const place = textWidth(readout.place, TAB_NAME_SIZE * scale);
  const full = scale <= 1 && Math.max(place, range) <= room;

  return { readout: full ? "full" : "range", clipped: range > room };
}

/** The readout's second line: the window the list holds, with the true total; the total alone while nothing is loaded. */
export function readoutRange(loaded: number, total: number, template: string, format: (count: number) => string): string {
  if (loaded <= 0 || total <= 0) return format(Math.max(0, total));
  return template.replace("{0}", format(Math.min(loaded, total))).replace("{1}", format(total));
}
