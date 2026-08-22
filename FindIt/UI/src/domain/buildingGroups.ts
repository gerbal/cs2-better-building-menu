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
  { id: "menuCategory", label: "Category", depth: 1 },
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
/**
 * The menu whose assets carry a school tier.
 *
 * Matched loosely on the menu's own prefab name rather than pinned to the exact
 * string, so a rename or a variant still resolves. The name is NOT localised —
 * it is UIAssetMenuPrefab.name, the same value the census prints and assets
 * carry as UiMenu — so this is not matching on display text.
 */
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

export function isEducationMenu(menu: string | null | undefined): boolean {
  return /education/i.test(menu ?? "");
}

/**
 * The grouping choices worth offering for a menu.
 *
 * School tier answers "which school", which is a question only the education
 * menu can ask. Offered everywhere else it is a dimension that puts the whole
 * result in one "Ungrouped" heading — a control that cannot act, drawn in a
 * picker of controls that can.
 *
 * Only schoolTier is filtered. The rest are narrow in places too — Role outside
 * a service menu, Density outside zoned buildings — but they degrade to a
 * sensible split rather than to a single bucket, and the picker is opened
 * deliberately.
 */
export function groupDimensionsFor(
  menu: string | null | undefined,
  entries: readonly GroupableEntry[] | null | undefined = null
): readonly GroupDimension[] {
  const offered = isEducationMenu(menu)
    ? GROUP_DIMENSIONS
    : GROUP_DIMENSIONS.filter((dimension) => dimension.id !== "schoolTier");

  // With no entries to judge by — before the first page lands — offer
  // everything rather than guess a menu into a shorter list it then keeps.
  const sample = entries ?? [];

  if (sample.length === 0) {
    return offered;
  }

  // A dimension that puts the whole menu in ONE bucket is a control that
  // cannot act: picking Development in Landscaping draws a single heading
  // over 379 assets, because nothing there is gated by a development tree.
  // "None" always stays — it is how the player turns grouping off, and it
  // groups nothing by definition.
  return offered.filter((dimension) => {
    if (dimension.id === "none") {
      return true;
    }

    const seen = new Set<string>();

    for (const entry of sample) {
      // The outermost level is the one the picker's label names; a second
      // level only subdivides what the first already split.
      const level = groupLevelsFor(entry, dimension.id)[0];

      if (level !== undefined) {
        seen.add(level);
      }

      if (seen.size > 1) {
        return true;
      }
    }

    return false;
  });
}

export function defaultGroupDimensionFor(
  section: string | null | undefined,
  menuHasCategories: boolean = false,
  stripAxis: string = "",
  educationMenu: boolean = false,
): GroupDimensionId {
  // The strip and the headings answer the same question, so they should not
  // open on different answers. The strip picks its axis per menu — vanilla's
  // categories where they exist, otherwise whichever of the development tree
  // or buildings-against-networks cuts that menu best — and the grouping now
  // follows it, so arriving in a menu shows one division rather than two.
  //
  // "category" is this module's Buildings/Networks/Service Buildings, which is
  // the same cut the strip calls assetType; the names differ because the
  // strip's axis ids are the backend's and this module's are the picker's.
  // BEFORE the axis checks. The education menu reports a development axis —
  // its schools do span several unlock nodes — but its strip draws school
  // LEVELS in that category's place, so the axis is not what the row is
  // showing. Asking about the menu first is what keeps the grouping matched to
  // the tabs rather than to the axis they were derived from.
  if (educationMenu) {
    return "schoolTier";
  }

  // The MENU'S OWN CATEGORIES BEAT THE AXIS. Reported by the user on Roads,
  // which has ten categories and still opened grouped by Development.
  //
  // GetStripAxis says "development" for a category menu whenever one of those
  // categories is drawn as branches — deliberately, because the tabs and the
  // predicate have to agree on the axis or clicking a tab matches nothing. But
  // that is a statement about how ONE category is subdivided, not about what
  // the row is showing, and the picker read it as the latter. Roads still
  // shows ten category tabs; grouping the grid by service branch beneath them
  // is a second division the player did not ask for.
  //
  // Same shape as the education case above, which is why that one had to be
  // checked before the axis too: ask what the STRIP IS DRAWING, not what axis
  // it derived on the way there.
  if (menuHasCategories) {
    return "menuCategory";
  }

  if (stripAxis === "development") {
    return "development";
  }

  if (stripAxis === "assetType") {
    return "category";
  }

  // Inside a vanilla menu, the game's own categories win — this is master's
  // behaviour (4ce4ba5), restored.
  //
  // This branch changed it to "none" on the argument that the strip already
  // shows that division, and backed it with a measurement: Transportation at
  // 720p, 53 tiles, 9 per row — 6 rows flat against 9 rows plus 6 headings
  // grouped, "a third more scrolling, in a panel that shows two rows at a
  // time".
  //
  // That last clause is what expired. The panel no longer shows two rows at a
  // time: it is 984px wide at 10 tiles per row, and its height is a value the
  // player drags anywhere from 200rem to 960rem. The cost the argument was
  // paying for — scrolling, in a panel too short to absorb headings — is a
  // cost of a layout this branch has since replaced.
  //
  // What is left is the case for grouping: the categories are the split the
  // player already has in mind because the strip shows it, and repeating it in
  // the grid lets them see the whole menu at once instead of tabbing through
  // it. Master went on to build on that — 479ffeb gave the grouping a real
  // order, 0aa0203 taught the table to draw the groups it was already sorting
  // into — so "none" here also left those two doing nothing on this branch.
  return typeof section === "string" && section.trim().toLowerCase() === "servicebuildings"
    ? "role"
    : DEFAULT_GROUP_DIMENSION;
}

/**
 * A group heading for the game's own category.
 *
 * The id is a prefab name — "TransportationRoad", "PropsNature", "BikePaths" —
 * so it needs both splitting into words and, where the convention holds,
 * relieving of the menu name it repeats. "TransportationRoad" inside
 * Transportation is "Road"; "PropsNature" inside Landscaping keeps both words,
 * because that menu does not prefix its categories.
 */
export function menuCategoryLabel(entry: GroupableEntry): string {
  const raw = typeof entry.uiCategory === "string" ? entry.uiCategory.trim() : "";

  if (raw === "") {
    return UNGROUPED_LABEL;
  }

  const menu = (typeof entry.uiMenu === "string" ? entry.uiMenu : "").replace(/[^A-Za-z]/g, "");
  const withoutMenu = menu !== "" && raw.toLowerCase().startsWith(menu.toLowerCase())
    ? raw.slice(menu.length)
    : raw;

  return splitWords(withoutMenu === "" ? raw : withoutMenu);
}

/** "BikePaths" -> "Bike Paths". The ids are camel case, not sentences. */
function splitWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
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
 * `id` is duplicated as EDUCATION_LEVEL_TIERS in serviceForecast.ts, which
 * keys the capacity forecast's series off the same four rows. See the note
 * there for why they are not one table, and serviceForecast.test.ts for the
 * test that keeps them honest.
 */
export interface SchoolTier {
  /** `SchoolData.m_EducationLevel`. */
  level: number;
  /** Stable id, shared with the capacity forecast's series. */
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

export function schoolTierFor(level: number | null | undefined): SchoolTier | null {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return null;
  }

  return SCHOOL_TIERS.find((tier) => tier.level === level) ?? null;
}

export interface GroupableEntry {
  /** The game's own menu placement, indexed from UIObject.m_Group. */
  uiMenu?: string | null;
  uiCategory?: string | null;
  category?: string | null;
  categoryLabel?: string | null;
  subCategory?: string | null;
  subCategoryLabel?: string | null;
  buildingType?: string | null;
  educationLevel?: number | null;
  /** Milestone index the game gates the asset behind; 0 for available at start. */
  unlockMilestone?: number | null;
  devTreeBranch?: string | null;
  devTreeBranchDepth?: number | null;
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

/**
 * The heading levels an entry falls under, outermost first.
 *
 * Category yields two. That is what keeps it useful after navigation: once the
 * player has navigated to Service Buildings a lone SERVICE BUILDINGS heading is
 * noise, but the subcategory level underneath still chunks the set.
 */
export function groupLevelsFor(
  entry: GroupableEntry | null | undefined,
  dimension: GroupDimensionId,
  milestoneNames: readonly string[] = []
): string[] {
  if (!entry || dimension === "none") return [];

  switch (dimension) {
    case "category":
      return [
        text(entry.categoryLabel) ?? text(entry.category) ?? UNGROUPED_LABEL,
        text(entry.subCategoryLabel) ?? text(entry.subCategory) ?? UNGROUPED_LABEL,
      ];
    case "menuCategory":
      return [menuCategoryLabel(entry)];
    case "subCategory":
      return [text(entry.subCategoryLabel) ?? text(entry.subCategory) ?? UNGROUPED_LABEL];
    case "role":
      return [text(entry.buildingType) ?? UNGROUPED_LABEL];
    case "progression":
      // Named by the caller, which holds the milestone name table — the entry
      // carries a bare index because the ~20 names are published once rather
      // than repeated on every row. Index 0 means UNGATED — the game's own
      // milestones start at 1 — which is why milestoneLabel names it rather
      // than printing "Milestone 0".
      return [milestoneLabel(entry.unlockMilestone, milestoneNames)];
    case "development":
      // Already the branch, resolved at index time against the game's own
      // tree, and already "Basic" for anything the tree never gated — so
      // there is no ungrouped case left to invent here.
      return [text(entry.devTreeBranch) ?? UNGROUPED_LABEL];
    case "schoolTier":
      // Not word-split through text(): these are the game's own labels, and
      // "Elementary School" is already a phrase.
      //
      // Anything with no tier falls back to its own CATEGORY rather than to
      // "Other". This is the grouping the education menu opens on, and its
      // three research buildings under a heading called "Other" said nothing
      // about them — where "Research" is exactly what the strip's own tab
      // beside the four levels says. The rule generalises: split the schools
      // out, leave everything else where it was.
      return [
        schoolTierFor(entry.educationLevel)?.label ?? menuCategoryLabel(entry),
      ];
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
  /**
   * Where this heading sits in an ordered dimension.
   *
   * Only progression sets it. Every other dimension's headings are nominal —
   * "Hospital" is not before or after "Clinic" — so they keep the order the
   * entries arrived in. Milestones are ordinal by definition, and reading the
   * order off the entries would hand the progression whatever order the SORT
   * happened to produce: sorted by name, a Roads menu would run Grand Village,
   * Small Village, Tiny Village.
   */
  order?: number;
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
  dimension: GroupDimensionId,
  milestoneNames: readonly string[] = []
): GroupNode<T>[] {
  const source = entries ?? [];
  if (dimension === "none" || source.length === 0) return [];

  const roots: GroupNode<T>[] = [];

  for (const entry of source) {
    const levels = groupLevelsFor(entry, dimension, milestoneNames);
    if (levels.length === 0) continue;

    let siblings = roots;
    const path: string[] = [];

    for (let depth = 0; depth < levels.length; depth += 1) {
      const label = levels[depth];
      path.push(label);

      let node = siblings.find((candidate) => candidate.label === label);
      if (!node) {
        node = { label, path: [...path], count: 0, children: [], entries: [] };

        // Only where the game owns the id. Every other dimension's heading is
        // derived from a value rather than named by the game, so there is
        // nothing to look up.
        if (dimension === "menuCategory" && label !== UNGROUPED_LABEL) {
          const id = typeof entry.uiCategory === "string" ? entry.uiCategory.trim() : "";
          if (id !== "") {
            node.labelId = id;
          }
        }

        if (dimension === "progression" && typeof entry.unlockMilestone === "number") {
          node.order = entry.unlockMilestone;
        }

        // Development is ordinal too — the tree's own columns. Without this the
        // headings formed in encounter order, so a name sort drew Coal Power
        // Plant above the basic buildings it is unlocked long after.
        if (dimension === "development" && typeof entry.devTreeBranchDepth === "number") {
          node.order = entry.devTreeBranchDepth;
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

  // "Other" last, whatever order it arrived in. It is the only group that is
  // defined by absence, so leading with it opens the view on the buildings that
  // matched the grouping least — Police & Administration by role opened on the
  // six that have no role at all. C# sorts its key last for the same reason;
  // doing it here too means the UI is right even when the two disagree.
  const named = roots.filter((node) => node.label !== UNGROUPED_LABEL);
  const other = roots.filter((node) => node.label === UNGROUPED_LABEL);

  // Ordinal dimensions state their own order; see GroupNode.order.
  if (dimension === "progression" || dimension === "development") {
    named.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

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
 * Order is preserved exactly as buildGroupedView produced it, which is the
 * order the backend already sorted; nothing here re-sorts.
 */
export function flattenGroupedRows<T extends GroupableEntry>(
  entries: readonly T[] | null | undefined,
  dimension: GroupDimensionId,
  keyOf: (entry: T) => string,
): GroupedRow<T>[] {
  const source = entries ?? [];
  const nodes = buildGroupedView(source, dimension);

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
  const budget = Math.max(MIN_GROUP_LABEL, Math.min(tiles, GROUP_LABEL_TILE_CAP) * GROUP_LABEL_PER_TILE);

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

/** Past this the row has wrapped, so more tiles buy no more width. */
export const GROUP_LABEL_TILE_CAP = 9;

/** Short enough to fit one tile, long enough to still name something. */
export const MIN_GROUP_LABEL = 7;
