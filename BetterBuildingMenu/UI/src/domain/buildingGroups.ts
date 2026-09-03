/**
 * Grouping: headings over the result set, in every view mode.
 *
 * The zoning view groups zones by family then density and renders each leaf as
 * a small labelled tile. In play that read better than either catalog mode, and
 * not because the tiles are prettier: every name is fully readable and the set
 * is chunked. The grid truncates names and the table fits about twelve rows.
 *
 * The load-bearing decision is that **grouping is a primary sort key, not a
 * separate axis**. With paging the two cannot be independent — grouping only
 * the visible page splits a group across a page boundary, and then the heading
 * lies about what it contains. So the query orders by the group key first and
 * the chosen sort orders rows within each group.
 *
 * C# owns all of that: the ordering, the effective dimension, the heading each
 * entry falls under (`BuildingCatalogGrouping.Labels`, sent as `groupPath` and
 * `groupLabelId` on every page item) and which dimensions can act on a menu
 * (`BuildingLensGroupDimensions`). This module owns the picker's vocabulary and
 * builds the tree the views draw out of the paths it is sent. Nothing here
 * derives a heading from an entry's fields any more, so the two sides cannot
 * disagree about what a group is called.
 */

export type GroupDimensionId =
  | "none"
  | "category"
  | "subCategory"
  | "menuCategory"
  | "role"
  | "schoolTier"
  | "progression"
  | "development"
  | "theme"
  | "source"
  | "density"
  | "footprint"
  | "cost";

export interface GroupDimension {
  id: GroupDimensionId;
  label: string;
  /** How many heading levels this dimension yields. */
  depth: number;
}

/**
 * Offered in the picker, in this order.
 *
 * Array-valued dimensions — asset packs, placement flags, extensions — are
 * deliberately absent. An entry belongs to several of each, so it would appear
 * under several headings and the group counts would no longer sum to the result
 * total. Whether to duplicate the entry or pick a primary is a real question,
 * and answering it badly by default is worse than leaving it out.
 */
export const GROUP_DIMENSIONS: readonly GroupDimension[] = [
  // The game's own categories — the same split the tab strip shows. First,
  // because inside a vanilla menu it is the division the player already has in
  // mind, and it is the only dimension that works for a menu holding both
  // networks and buildings.
  // Depth 2: the category, then the tier within it — see C#'s CategoryTierLabel
  // for what "tier" means per menu (density for zones, the development branch for
  // service menus, the milestone for signatures). A menu whose entries share
  // one tier gets a single child level, which shouldShowHeading draws no
  // heading for, so this costs nothing where it says nothing.
  { id: "menuCategory", label: "Category", depth: 2 },
  // Ours, not the game's: Buildings, Networks, Service Buildings. Renamed from
  // "Category" so it does not compete with the game's own word for a different
  // idea.
  { id: "category", label: "Asset type", depth: 2 },
  { id: "subCategory", label: "Type", depth: 1 },
  { id: "role", label: "Role", depth: 1 },
  // Directly under Role, because it is the level below it: Role answers
  // "school", School tier answers "which one". Narrow on purpose — of 44
  // education buildings 40 carry a tier, and nothing else in the catalog does
  // — but Role is equally narrow the moment you pick it outside a service
  // menu, and the picker is opened deliberately.
  { id: "schoolTier", label: "School tier", depth: 1 },
  // The game's own progression, which is the one tier every asset has. School
  // tier answers "which school"; this answers "when does the game let me build
  // it", and it is the axis the player is actually moving along.
  //
  // Works because the milestone is now kept whatever the lock state. It used to
  // be zeroed on unlock, which took an asset out of its own tier at the moment
  // the player earned it — the one time they are looking at that tier.
  { id: "progression", label: "Progression", depth: 1 },
  // The other unlock modality. Progression is the city-growth ladder;
  // Development is the per-service tree bought with development points, and on
  // the big menus it is the one that actually chunks the set — Roads splits
  // into Roundabouts 38, Parking 33, Highways 17, where its milestone split is
  // two buckets.
  { id: "development", label: "Development", depth: 1 },
  { id: "theme", label: "Theme", depth: 1 },
  { id: "source", label: "Source", depth: 1 },
  { id: "density", label: "Density", depth: 1 },
  { id: "footprint", label: "Footprint", depth: 1 },
  { id: "cost", label: "Cost", depth: 1 },
  // "None", not "Nothing": vanilla's vocabulary for an absent selection, and
  // this dropdown is chrome, so it speaks the game's language.
  { id: "none", label: "None", depth: 0 },
];

/** Default when the section is unknown, and the fallback everywhere else. */
export const DEFAULT_GROUP_DIMENSION: GroupDimensionId = "category";

/**
 * The category whose assets the school levels stand in for.
 *
 * On the education menu the four levels partition this category exactly — ten
 * schools, 3/3/1/3 — so the strip draws them INSTEAD of it rather than beside
 * it, and the menu's other categories are unaffected. Matched on the id, which
 * is the category prefab's own name.
 */
export function isSchoolCategory(id: string | null | undefined): boolean {
  return /education/i.test(id ?? "");
}

/**
 * The menu whose assets carry a school tier.
 *
 * Matched loosely on the menu's own prefab name rather than pinned to the exact
 * string, so a rename or a variant still resolves. The name is NOT localised —
 * it is UIAssetMenuPrefab.name, the same value the census prints and assets
 * carry as UiMenu — so this is not matching on display text. C# makes the same
 * test in VanillaMenus.IsEducation.
 */
export function isEducationMenu(menu: string | null | undefined): boolean {
  return /education/i.test(menu ?? "");
}

/**
 * The grouping choices worth offering, in picker order.
 *
 * C# decides which dimensions can act on the current menu — a dimension that
 * puts the whole menu in ONE bucket is a control that cannot act, School tier
 * is only a question the education menu can ask — and publishes the ids as
 * `BuildingLensGroupDimensions`. This keeps the picker's order and labels and
 * shows the ones offered. Before the binding has said anything (an empty
 * list) everything is offered, so a picker opened early is not left short.
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

/**
 * The four school tiers, from the game's own `SchoolLevel` enum.
 *
 * `SchoolLevel { Elementary = 1, HighSchool, College, University, Outside }`
 * (Game/Prefabs/SchoolLevel.cs), reaching us as `SchoolData.m_EducationLevel`
 * — a plain 1-based tier index. Not a bitmask, and not cumulative: a
 * university grants exactly its own tier, which is why
 * CitizenPathfindSetup requires `m_EducationLevel == value` rather than a
 * range, and why SchoolData.Combine takes max rather than OR.
 *
 * The two values that are not tiers are deliberately missing. 0 is a school
 * upgrade that adds capacity without a tier of its own, and 5 (`Outside`) is
 * the outside connection that teaches nobody here. Both are real values on
 * real indexed prefabs, and both must fall through to "no tier" rather than
 * becoming headings called "0" and "5".
 *
 * `label` is the game's own wording, shipped as
 * `SelectedInfoPanel.EDUCATION_LEVELS[Elementary|HighSchool|College|University]`
 * in Locale.cok. It is English here because every group heading in this module
 * renders raw, so a translated school tier would be the only translated
 * heading on screen — the key above is where to read from when headings do get
 * plumbed.
 *
 * `id` was once duplicated as EDUCATION_LEVEL_TIERS in serviceForecast.ts,
 * which keyed the capacity forecast's series off the same four rows. That
 * forecast was retired in e1fe039 (cm-7r5r) — a card about a BUILDING should
 * not answer a question about the CITY — so this is the only table now, and
 * the drift test that kept the two honest went with it.
 */
export interface SchoolTier {
  /** `SchoolData.m_EducationLevel`. */
  level: number;
  /** Stable id for the tier. */
  id: string;
  /** Heading text, in the game's own wording. */
  label: string;
}

export const SCHOOL_TIERS: readonly SchoolTier[] = [
  { level: 1, id: "elementary", label: "Elementary School" },
  { level: 2, id: "highSchool", label: "High School" },
  { level: 3, id: "college", label: "College" },
  { level: 4, id: "university", label: "University" },
];

/** What C# files an entry under when the dimension has no value for it. */
export const UNGROUPED_LABEL = "Other";

/** What the progression dimension calls an asset the game never gated. */
export const PROGRESSION_UNGATED_LABEL = "From the start";

/**
 * Names a milestone index out of the dense table the backend publishes.
 *
 * Falls back to the bare index rather than to "Other": an asset with no name
 * for its milestone still sits at a definite point in the progression, and
 * lumping it with the unknowns would hide that.
 */
export function milestoneLabel(
  index: number | null | undefined,
  names: readonly string[] | null | undefined
): string {
  if (typeof index !== "number" || !Number.isFinite(index) || index < 0) {
    return UNGROUPED_LABEL;
  }

  const named = (names ?? [])[index];

  if (named) {
    return named;
  }

  // The game's milestones start at 1, and the published table is dense from 0,
  // so slot 0 is empty in every save. An asset at 0 is not at a milestone the
  // player has to reach — it is one the game never gated — and "Milestone 0"
  // named a thing that does not exist.
  return index === 0 ? PROGRESSION_UNGATED_LABEL : `Milestone ${index}`;
}

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
   * The game's own id behind this heading, where there is one.
   *
   * Only the menuCategory dimension has one: its headings name vanilla
   * categories, and the game ships localized strings for them under
   * SubServices.NAME[<id>]. Carrying the id means the renderer can ask for the
   * game's word — "Road" — instead of drawing our best guess at what
   * "TransportationRoad" was meant to say, which was English-only.
   *
   * The label remains the fallback and the node's identity, so grouping works
   * unchanged when the key is missing.
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
 * The group tree out of the paths C# stamped on the page.
 *
 * Consecutive entries sharing a heading form one node, nested by depth. Only
 * consecutive: the page arrives ordered by (group key, chosen sort), so a
 * group's entries are contiguous by construction, and merging distant runs
 * would draw a tree that disagrees with the order underneath it. "Other"
 * last, ordinal dimensions in their own order — all of that is C#'s key, and
 * this reads it off the page rather than re-deriving it.
 *
 * Entries with no path are left out: an ungrouped page ("None", or a page C#
 * did not stamp) yields no tree, and the views draw the flat list.
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
        // menuCategory heading names, and nothing beneath it. Taking it on a
        // tier node made every one of Residential's six tier headings draw
        // "Residential Zones" once the renderer resolved it.
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
 * Whether a heading is worth drawing.
 *
 * A single group covering everything is a label with nothing to distinguish —
 * which is what a lone SERVICE BUILDINGS heading is once the player has already
 * navigated there.
 */
export function shouldShowHeading(nodes: readonly GroupNode<unknown>[]): boolean {
  return nodes.length > 1;
}

export function groupDimensionLabel(id: GroupDimensionId): string {
  return GROUP_DIMENSIONS.find((dimension) => dimension.id === id)?.label ?? id;
}

export function isGroupDimension(value: unknown): value is GroupDimensionId {
  return GROUP_DIMENSIONS.some((dimension) => dimension.id === value);
}

/** One line of a grouped table: a heading band, or a data row. */
export type GroupedRow<T> =
  | { kind: "heading"; key: string; label: string; labelId?: string; depth: number; count: number }
  | { kind: "row"; key: string; entry: T };

/**
 * Flatten a group tree into the sequence a table renders.
 *
 * The table is the one view that could not use GroupedResults: it draws its own
 * rows against a shared column geometry, and wrapping each group in its own
 * scrolling section would break the column alignment the whole surface depends
 * on. So it went ungrouped — and the Group by control stayed on screen and kept
 * working on the C# side, which reorders by group key before it sorts. The
 * result was a table that silently rearranged itself with nothing to say why:
 * picking "Asset type" moved every bridge to the top and drew no heading.
 *
 * Interleaving headings into one flat list keeps a single flex column geometry
 * for the data rows and gives the reordering a visible reason.
 *
 * Order is preserved exactly as groupTreeFromPaths produced it, which is the
 * order the backend already sorted; nothing here re-sorts.
 */
export function flattenGroupedRows<T extends GroupedEntry>(
  entries: readonly T[] | null | undefined,
  keyOf: (entry: T) => string,
): GroupedRow<T>[] {
  const source = entries ?? [];
  const nodes = groupTreeFromPaths(source);

  // "None", or a dimension that grouped nothing: the table is the flat list it
  // has always been.
  if (nodes.length === 0) {
    return source.map((entry) => ({ kind: "row", key: keyOf(entry), entry }));
  }

  const out: GroupedRow<T>[] = [];

  const walk = (level: readonly GroupNode<T>[], depth: number): void => {
    // Decided PER LEVEL, which is what GroupedResults does and what a first
    // version of this got wrong. Grouping the Roads menu by asset type puts
    // every entry under one root — they are all Networks — and judging the
    // whole tree by that root suppressed the headings underneath it too, so
    // the table reordered itself into Roads, Bridges and Tracks and named
    // none of them. A lone heading at one level says nothing; the level below
    // it can still be worth labelling.
    const withHeadings = shouldShowHeading(level);

    for (const node of level) {
      if (withHeadings) {
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
 * A heading that fits the width its tiles give it.
 *
 * Cohtml reports `text-overflow: ellipsis` as computed and then draws a hard
 * cut, so the "…" has to be put there rather than asked for. The budget comes
 * from the tile COUNT because that is what sets a group's width — the heading
 * is out of flow precisely so it cannot — and a tile is about nine uppercase
 * characters wide at this size.
 *
 * Never shorter than a few characters: a group of one still has to be
 * identifiable, and "C…" identifies nothing. The full name stays in the
 * tooltip and on the tiles below.
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
 * A heading cut to the width it has actually been given.
 *
 * The estimate above budgets by tile COUNT, which only holds where a tile has
 * a fixed width — the grid. Cards and list rows size to their content, so
 * measured in Electricity a one-item group ran 94px to 172px while the budget
 * said the same nine characters for every one of them, and "Gas Power Plant"
 * was cut to "Gas Powe…" inside 166px of room.
 *
 * Both widths come from the DOM, so nothing here assumes a character width,
 * a font, or a locale: `availablePx` is the box the label was given and
 * `neededPx` is what the full string wants. Their ratio converts directly to
 * a character count.
 *
 * Safe to feed back into the label because the heading is positioned OUT OF
 * FLOW — see groupedResults.module.scss. Shortening the text cannot narrow
 * the group, so measure → shorten → measure cannot spiral.
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
 * The tiles of width a group reserves for its label whatever it holds.
 *
 * A search is a run of one- to three-tile groups, and a budget straight from
 * the tile count cut every one of their names — "ROAD SER…" over one tile.
 * groupedResults.module.scss gives .group the matching min-width, so the
 * estimate and the box agree.
 */
export const GROUP_LABEL_MIN_TILES = 3;

/** Past this the row has wrapped, so more tiles buy no more width. */
export const GROUP_LABEL_TILE_CAP = 9;

/** Short enough to fit one tile, long enough to still name something. */
export const MIN_GROUP_LABEL = 7;
