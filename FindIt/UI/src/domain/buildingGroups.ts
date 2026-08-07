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
 * the chosen sort orders rows within each group. C# owns that ordering; this
 * module owns the headings, and the two agree because they derive the same keys
 * from the same fields.
 *
 * Band edges are duplicated in `BuildingCatalogGrouping.cs` and asserted in both
 * test suites. There is no shared source across the boundary, so drift is caught
 * by tests rather than prevented by construction.
 */

export type GroupDimensionId =
  | "none"
  | "category"
  | "subCategory"
  | "role"
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
  { id: "category", label: "Category", depth: 2 },
  { id: "subCategory", label: "Type", depth: 1 },
  { id: "role", label: "Role", depth: 1 },
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
 * The grouping a section opens on, before the player chooses anything.
 *
 * Service buildings group by Role — Hospital, School, Fire Station — because
 * that is what the player came looking for, and the category level above it is
 * a single heading saying "Service Buildings" to someone who just clicked
 * Healthcare.
 *
 * Role deliberately does not generalize. Residential, commercial and industrial
 * prefabs carry no service component, so BuildingRole resolves null for all of
 * them and every one would land under "Other" — a default that files 3,667
 * buildings in one bucket is worse than no grouping at all.
 */
export function defaultGroupDimensionFor(section: string | null | undefined): GroupDimensionId {
  return typeof section === "string" && section.trim().toLowerCase() === "servicebuildings"
    ? "role"
    : DEFAULT_GROUP_DIMENSION;
}

/** Heading for entries with no value for the grouped field. */
export const UNGROUPED_LABEL = "Other";

/**
 * Cost band edges, in currency. Mirrored in BuildingCatalogGrouping.cs.
 *
 * A heading per distinct cost would be one heading per building; these are the
 * breaks that separate "a park bench", "an ordinary service building" and "the
 * thing you save up for".
 */
export const COST_BANDS: readonly number[] = [5_000, 25_000, 100_000];

/** Footprint bands by the larger lot dimension. Mirrored in C#. */
export const FOOTPRINT_BANDS: readonly number[] = [2, 4, 6];

export interface GroupableEntry {
  category?: string | null;
  categoryLabel?: string | null;
  subCategory?: string | null;
  subCategoryLabel?: string | null;
  buildingType?: string | null;
  theme?: string | null;
  provenance?: string | null;
  dlcId?: string | null;
  zoneType?: number | string | null;
  lotWidth?: number | null;
  lotDepth?: number | null;
  constructionCost?: number | null;
}

/**
 * Splits a PascalCase or snake_case id into words.
 *
 * Group headings come from raw prefab fields, so "DeathcareFacility" arrived as
 * one word and the heading's uppercase styling rendered it "DEATHCAREFACILITY".
 * The facet list already word-splits its own labels; headings should read the
 * same way.
 */
export function humanizeGroupLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : humanizeGroupLabel(trimmed);
}

function formatCurrency(value: number): string {
  return value >= 1000 ? `₡${Math.round(value / 1000)}k` : `₡${value}`;
}

export function costBandLabel(cost: number | null | undefined): string {
  if (typeof cost !== "number" || !Number.isFinite(cost)) return UNGROUPED_LABEL;

  for (let index = 0; index < COST_BANDS.length; index += 1) {
    if (cost < COST_BANDS[index]) {
      return index === 0
        ? `${formatCurrency(0)}–${formatCurrency(COST_BANDS[0])}`
        : `${formatCurrency(COST_BANDS[index - 1])}–${formatCurrency(COST_BANDS[index])}`;
    }
  }

  return `${formatCurrency(COST_BANDS[COST_BANDS.length - 1])}+`;
}

export function footprintBandLabel(
  width: number | null | undefined,
  depth: number | null | undefined
): string {
  const longest = Math.max(
    typeof width === "number" && Number.isFinite(width) ? width : 0,
    typeof depth === "number" && Number.isFinite(depth) ? depth : 0
  );

  if (longest <= 0) return UNGROUPED_LABEL;

  for (const edge of FOOTPRINT_BANDS) {
    if (longest <= edge) return `${edge}×${edge} and under`;
  }

  return `Larger than ${FOOTPRINT_BANDS[FOOTPRINT_BANDS.length - 1]}×${FOOTPRINT_BANDS[FOOTPRINT_BANDS.length - 1]}`;
}

/**
 * The heading levels an entry falls under, outermost first.
 *
 * Category yields two. That is what keeps it useful after navigation: once the
 * player has navigated to Service Buildings a lone SERVICE BUILDINGS heading is
 * noise, but the subcategory level underneath still chunks the set.
 */
export function groupLevelsFor(
  entry: GroupableEntry | null | undefined,
  dimension: GroupDimensionId
): string[] {
  if (!entry || dimension === "none") return [];

  switch (dimension) {
    case "category":
      return [
        text(entry.categoryLabel) ?? text(entry.category) ?? UNGROUPED_LABEL,
        text(entry.subCategoryLabel) ?? text(entry.subCategory) ?? UNGROUPED_LABEL,
      ];
    case "subCategory":
      return [text(entry.subCategoryLabel) ?? text(entry.subCategory) ?? UNGROUPED_LABEL];
    case "role":
      return [text(entry.buildingType) ?? UNGROUPED_LABEL];
    case "theme":
      return [text(entry.theme) ?? UNGROUPED_LABEL];
    case "source":
      // Provenance is the broad answer ("Base game", "Mod"); the DLC name is
      // more specific when there is one, so it wins.
      return [text(entry.dlcId) ?? text(entry.provenance) ?? UNGROUPED_LABEL];
    case "density":
      return [
        typeof entry.zoneType === "number"
          ? String(entry.zoneType)
          : text(entry.zoneType) ?? UNGROUPED_LABEL,
      ];
    case "footprint":
      return [footprintBandLabel(entry.lotWidth, entry.lotDepth)];
    case "cost":
      return [costBandLabel(entry.constructionCost)];
    default:
      return [];
  }
}

export interface GroupNode<T> {
  /** Heading text for this level. */
  label: string;
  /** Levels above this one, so a nested node can report its full path. */
  path: string[];
  /** Total entries beneath this node, including nested children. */
  count: number;
  children: GroupNode<T>[];
  entries: T[];
}

/**
 * Groups entries into a tree, preserving their incoming order throughout.
 *
 * Order is preserved rather than sorted because the caller has already been
 * ordered by (group key, chosen sort) on the C# side. Re-sorting here would
 * silently disagree with the paging, which is the exact failure this design
 * exists to avoid.
 */
export function buildGroupedView<T extends GroupableEntry>(
  entries: readonly T[] | null | undefined,
  dimension: GroupDimensionId
): GroupNode<T>[] {
  const source = entries ?? [];
  if (dimension === "none" || source.length === 0) return [];

  const roots: GroupNode<T>[] = [];

  for (const entry of source) {
    const levels = groupLevelsFor(entry, dimension);
    if (levels.length === 0) continue;

    let siblings = roots;
    const path: string[] = [];

    for (let depth = 0; depth < levels.length; depth += 1) {
      const label = levels[depth];
      path.push(label);

      let node = siblings.find((candidate) => candidate.label === label);
      if (!node) {
        node = { label, path: [...path], count: 0, children: [], entries: [] };
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

  // "Other" last, whatever order it arrived in. It is the only group that is
  // defined by absence, so leading with it opens the view on the buildings that
  // matched the grouping least — Police & Administration by role opened on the
  // six that have no role at all. C# sorts its key last for the same reason;
  // doing it here too means the UI is right even when the two disagree.
  const named = roots.filter((node) => node.label !== UNGROUPED_LABEL);
  const other = roots.filter((node) => node.label === UNGROUPED_LABEL);

  return [...named, ...other];
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
