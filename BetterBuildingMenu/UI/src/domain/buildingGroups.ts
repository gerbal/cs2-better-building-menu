/**
 * Grouping: headings over the result set, in every view mode. It is a primary
 * SORT KEY, not a separate axis — under paging an independent grouping splits a
 * group across a page and the heading lies. C# owns the key and the labels.
 */

import { GROUP_DIMENSION_IDS, type GroupDimensionId } from "./sharedContracts.generated";

// C# owns the ids and their order; see sharedContracts.generated.ts.
export type { GroupDimensionId };

export interface GroupDimension {
  id: GroupDimensionId;
  label: string;
  /** How many heading levels this dimension yields. */
  depth: number;
}

/** What the picker calls each dimension, and how many heading levels it yields. */
const GROUP_DIMENSION_PRESENTATION: Readonly<Record<GroupDimensionId, Omit<GroupDimension, "id">>> = {
  // Depth 2: the category, then the tier within it — see C#'s CategoryTierLabel.
  menuCategory: { label: "Category", depth: 2 },
  // Ours, not the game's: Buildings, Networks, Service Buildings. Named "Asset
  // type" so it does not compete with the game's own word for a different idea.
  category: { label: "Asset type", depth: 2 },
  subCategory: { label: "Type", depth: 1 },
  role: { label: "Role", depth: 1 },
  // Narrow on purpose, but so is Role outside a service menu, and the picker
  // is opened deliberately.
  schoolTier: { label: "School tier", depth: 1 },
  // The one tier every asset has: when the game lets you build it, which is
  // the axis the player is moving along.
  progression: { label: "Progression", depth: 1 },
  // On the big menus it chunks the set where the milestone split yields only
  // a bucket or two.
  development: { label: "Development", depth: 1 },
  theme: { label: "Theme", depth: 1 },
  source: { label: "Source", depth: 1 },
  density: { label: "Density", depth: 1 },
  footprint: { label: "Footprint", depth: 1 },
  cost: { label: "Cost", depth: 1 },
  // "None", not "Nothing": vanilla's vocabulary for an absent selection, and
  // this dropdown is chrome, so it speaks the game's language.
  none: { label: "None", depth: 0 },
};

/**
 * Offered in the picker, in C#'s order. Array-valued dimensions — asset packs,
 * placement flags, extensions — are absent: an entry belongs to several of
 * each, so the group counts would no longer sum to the result total.
 */
export const GROUP_DIMENSIONS: readonly GroupDimension[] = GROUP_DIMENSION_IDS.map((id) => ({
  id,
  ...GROUP_DIMENSION_PRESENTATION[id],
}));

/**
 * The category whose assets the school levels stand in for. On the education
 * menu the four levels partition it exactly, so the strip draws them INSTEAD
 * of it. Matched on the id, which is the category prefab's own name.
 */
export function isSchoolCategory(id: string | null | undefined): boolean {
  return /education/i.test(id ?? "");
}

/**
 * The menu whose assets carry a school tier. Matched loosely on the menu's own
 * prefab name — UIAssetMenuPrefab.name, never display text — so a rename or a
 * variant still resolves. C# makes the same test in VanillaMenus.IsEducation.
 */
export function isEducationMenu(menu: string | null | undefined): boolean {
  return /education/i.test(menu ?? "");
}

/**
 * The grouping choices worth offering, in picker order. C# decides which can
 * act on the current menu, since one that puts everything in a single bucket is
 * a control that cannot act; an empty list means it has not said yet.
 */
export function groupDimensionsFor(
  offeredIds: readonly string[] | null | undefined
): readonly GroupDimension[] {
  const offered = offeredIds ?? [];

  if (offered.length === 0) {
    return GROUP_DIMENSIONS;
  }

  return GROUP_DIMENSIONS.filter((dimension) => offered.includes(dimension.id));
}

/** What C# files an entry under when the dimension has no value for it. */
export const UNGROUPED_LABEL = "Other";

/** The two fields C# stamps on every page item when the page is grouped. */
export interface GroupedEntry {
  /** Heading levels, outermost first. Empty or absent when nothing is grouped. */
  groupPath?: readonly string[] | null;
  /**
   * The game's own id behind the OUTER heading, where there is one — a
   * vanilla category name the renderer can localise. Empty otherwise.
   */
  groupLabelId?: string | null;
}

export interface GroupNode<T> {
  /** Heading text for this level. */
  label: string;
  /**
   * The game's own id behind this heading, where there is one. Only
   * menuCategory has one, and carrying it lets the renderer ask for the game's
   * localized word. The label stays the fallback and the node's identity.
   */
  labelId?: string;
  /** Levels above this one, so a nested node can report its full path. */
  path: string[];
  /** Total entries beneath this node, including nested children. */
  count: number;
  children: GroupNode<T>[];
  entries: T[];
}

/**
 * The group tree out of the paths C# stamped on the page. Only CONSECUTIVE
 * entries merge: the page is ordered by group key first, so merging distant
 * runs would draw a tree that disagrees with the order underneath it.
 */
export function groupTreeFromPaths<T extends GroupedEntry>(
  entries: readonly T[] | null | undefined
): GroupNode<T>[] {
  const roots: GroupNode<T>[] = [];

  for (const entry of entries ?? []) {
    const levels = entry.groupPath ?? [];
    if (levels.length === 0) continue;

    let siblings = roots;
    const path: string[] = [];

    for (let depth = 0; depth < levels.length; depth += 1) {
      const label = levels[depth];
      path.push(label);

      let node = siblings.length > 0 ? siblings[siblings.length - 1] : undefined;
      if (!node || node.label !== label) {
        node = { label, path: [...path], count: 0, children: [], entries: [] };

        // The outer level alone: C# carries the game's id for the category a
        // menuCategory heading names and nothing beneath it, so a tier node
        // taking it would draw its parent's name.
        if (depth === 0) {
          const id = typeof entry.groupLabelId === "string" ? entry.groupLabelId.trim() : "";
          if (id !== "") {
            node.labelId = id;
          }
        }

        siblings.push(node);
      }

      node.count += 1;

      if (depth === levels.length - 1) {
        node.entries.push(entry);
      } else {
        siblings = node.children;
      }
    }
  }

  return roots;
}

/**
 * Whether a heading is worth drawing. A single group covering everything is a
 * label with nothing to distinguish, once the player has already navigated
 * to exactly that thing.
 */
export function shouldShowHeading(nodes: readonly GroupNode<unknown>[]): boolean {
  return nodes.length > 1;
}

/**
 * Whether one group of a headed level draws its own heading. A sub-group of
 * one building names nothing its card does not, so only a top-level group
 * heads a single building.
 */
export function headsGroup(node: GroupNode<unknown>, depth: number): boolean {
  return depth === 0 || node.count > 1;
}

/** Whether a level draws any heading at all, once groups of one are left bare. */
export function levelDrawsHeading(nodes: readonly GroupNode<unknown>[], depth: number): boolean {
  return shouldShowHeading(nodes) && nodes.some((node) => headsGroup(node, depth));
}

/** One group of a row: the line it wrapped onto (its top) and its heading's height. */
export interface GroupPlacement {
  key: string;
  top: number | null;
  heading: number | null;
}

/**
 * The band each group of a row reserves above its tiles: the tallest heading
 * on ITS line, so tiles beside a heading share its baseline while a line with
 * no heading on it spends nothing. Until every line is known, the row's tallest.
 */
export function headingBands(groups: readonly GroupPlacement[]): Record<string, number | null> {
  const tallest = (members: readonly GroupPlacement[]): number | null => {
    const heights = members.map((group) => group.heading).filter((height): height is number => height !== null);
    return heights.length > 0 ? Math.max(...heights) : null;
  };
  const measured = groups.every((group) => group.top !== null);
  const bands: Record<string, number | null> = {};

  for (const group of groups) {
    bands[group.key] = measured
      ? tallest(groups.filter((other) => Math.round(other.top!) === Math.round(group.top!)))
      : tallest(groups);
  }

  return bands;
}

export function groupDimensionLabel(id: GroupDimensionId): string {
  return GROUP_DIMENSIONS.find((dimension) => dimension.id === id)?.label ?? id;
}

/** One line of a grouped table: a heading band, or a data row. */
export type GroupedRow<T> =
  | { kind: "heading"; key: string; label: string; labelId?: string; depth: number; count: number }
  | { kind: "row"; key: string; entry: T };

/**
 * Flatten a group tree into the sequence a table renders. Interleaved headings
 * rather than nested sections, because the table's columns line up only under
 * one flex geometry. Nothing here re-sorts; the backend's order is kept.
 */
export function flattenGroupedRows<T extends GroupedEntry>(
  entries: readonly T[] | null | undefined,
  keyOf: (entry: T) => string,
): GroupedRow<T>[] {
  const source = entries ?? [];
  const nodes = groupTreeFromPaths(source);

  // "None", or a dimension that grouped nothing: the table is a flat list.
  if (nodes.length === 0) {
    return source.map((entry) => ({ kind: "row", key: keyOf(entry), entry }));
  }

  const out: GroupedRow<T>[] = [];

  const walk = (level: readonly GroupNode<T>[], depth: number): void => {
    // Decided PER LEVEL, as GroupedResults does: a lone heading at one level
    // says nothing, but the level below it can still be worth labelling, and
    // judging the whole tree by its root would suppress those too.
    const withHeadings = shouldShowHeading(level);

    for (const node of level) {
      if (withHeadings && headsGroup(node, depth)) {
        out.push({
          kind: "heading",
          key: `h:${node.path.join("/")}`,
          label: node.label,
          labelId: node.labelId,
          depth,
          count: node.count,
        });
      }

      if (node.children.length > 0) {
        walk(node.children, depth + 1);
        continue;
      }

      for (const entry of node.entries) {
        out.push({ kind: "row", key: keyOf(entry), entry });
      }
    }
  };

  walk(nodes, 0);

  return out;
}

/**
 * A heading that fits the width its tiles give it. Cohtml reports
 * `text-overflow: ellipsis` as computed and then draws a hard cut, so the "…"
 * is put here. The budget comes from the tile COUNT, which sets the width.
 */
export function fitGroupLabel(label: string, tiles: number): string {
  const room = Math.min(Math.max(tiles, GROUP_LABEL_MIN_TILES), GROUP_LABEL_TILE_CAP);
  const budget = Math.max(MIN_GROUP_LABEL, room * GROUP_LABEL_PER_TILE);

  if (label.length <= budget) {
    return label;
  }

  return `${label.slice(0, Math.max(1, budget - 1)).trimEnd()}…`;
}

/**
 * A heading cut to the width it was actually given, for the modes whose rows
 * size to their content and where the tile-count estimate does not hold. Both
 * widths come from the DOM, so this assumes no font, character width or locale.
 */
export function fitLabelToWidth(label: string, availablePx: number, neededPx: number): string {
  // Not laid out yet, or it already fits. Callers keep their estimate.
  if (availablePx <= 0 || neededPx <= 0 || neededPx <= availablePx) {
    return label;
  }

  // -1 for the ellipsis, which costs a character the ratio has not counted.
  const budget = Math.max(MIN_GROUP_LABEL, Math.floor(label.length * (availablePx / neededPx)) - 1);

  if (label.length <= budget) {
    return label;
  }

  return `${label.slice(0, Math.max(1, budget - 1)).trimEnd()}…`;
}

/** Uppercase characters that fit over one tile at the heading's size. */
export const GROUP_LABEL_PER_TILE = 9;

/**
 * The tiles of width a group reserves for its label whatever it holds, so the
 * one- to three-tile groups a search produces can still be named.
 * groupedResults.module.scss gives .group the matching min-width.
 */
export const GROUP_LABEL_MIN_TILES = 3;

/** Past this the row has wrapped, so more tiles buy no more width. */
export const GROUP_LABEL_TILE_CAP = 9;

/** Short enough to fit one tile, long enough to still name something. */
export const MIN_GROUP_LABEL = 7;
