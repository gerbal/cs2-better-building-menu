import type { BuildingCatalogEntry } from "./buildingCatalog";
import type { ActivatePrefabAction, LocatePrefabAction } from "./menuSurfaceContracts";
export type {
  ActivatePrefabAction,
  MenuSurfaceAction,
  LocatePrefabAction,
} from "./menuSurfaceContracts";
import type { MetricRangeId } from "./buildingCatalogRanges";
import type { NumberSeparators } from "./buildingLensMetricFormat";

/**
 * Keep the UI's windowing rules in a pure module.
 *
 * The Gameface components call the trigger commands from this module, while
 * the same contract can be exercised by Node's browserless test runner. This
 * prevents a payload drift between the React UI and the C# bindings.
 */
export const MAX_CATALOG_PAGE_SIZE = 500;

export type SortColumn =
  | "Default"
  | "Name"
  | "Category"
  | "ConstructionCost"
  | "Upkeep"
  | "Workers"
  | "Capacity"
  | "LotWidth"
  | "LotDepth"
  | "BuildingLevel"
  | "HasParking";

export interface TriggerCommand {
  method: string;
  args: readonly (string | number | boolean)[];
}

export interface SortState {
  column: SortColumn;
  descending: boolean;
}

export function createTriggerCommand(method: string, ...args: (string | number | boolean)[]): TriggerCommand {
  return { method, args };
}

export const setCurrentPrefabCommand = (id: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId: id });
export const setSortColumnCommand = (column: SortColumn): TriggerCommand => createTriggerCommand("SetBuildingCatalogSortColumn", column);
export const setSortDescendingCommand = (descending: boolean): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogSortDescending", descending);
// Takes no argument on purpose. The window is the backend's: it knows the
// current Limit, the step and the ceiling, so a client that named the next size
// would be a second opinion about all three.
export const loadMoreCatalogCommand = (): TriggerCommand => createTriggerCommand("LoadMoreBuildingCatalog");
export const setBuildingCatalogMetricRangeCommand = (id: MetricRangeId, minText: string, maxText: string): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogMetricRange", id, minText, maxText);
export const clearBuildingCatalogMetricRangesCommand = (): TriggerCommand =>
  createTriggerCommand("ClearBuildingCatalogMetricRanges");
export const searchChangedCommand = (value: string): TriggerCommand => createTriggerCommand("SearchChanged", value);
export const locatePrefabCommand = (id: number): LocatePrefabAction => ({ type: "locatePrefab", prefabId: id });

export function nextSortState(current: SortState, column: SortColumn): SortState {
  return {
    column,
    descending: column === current.column ? !current.descending : false,
  };
}

export function normalizeCatalogPageSize(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(MAX_CATALOG_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}

export function normalizeCapacityFloor(floor: number): number {
  if (!Number.isFinite(floor)) {
    return 0;
  }

  return Math.min(10000, Math.max(0, Math.floor(floor)));
}

/**
 * Group digits the way `groupDigits` does, for counts.
 *
 * The regex is `buildingLensMetricFormat`'s, and the test asserts this function
 * agrees with it, because the import that would have shared it cannot exist:
 * these modules are imported extensionlessly, which webpack and tsc resolve and
 * `node --test` does not, and the `.ts` specifier node wants is a hard error in
 * TypeScript 4.9. Every runtime import between src modules would break the
 * suite, so today there are none.
 *
 * `toLocaleString` is not the answer either — it groups in Node and does
 * nothing in Cohtml, which is how the page summary this replaces asserted
 * "4,206" in a passing test while the game rendered "4206". The separator comes
 * from the caller because it comes from the game's own loc dictionary; a
 * hardcoded one disagrees with the numbers in the rows above it.
 */
function groupCount(value: number, separators: NumberSeparators): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separators.group);
}

/**
 * Say how much of the match set is on screen, for a window that grows rather
 * than a page that turns.
 */
/**
 * The same fact as {@link getCatalogWindowSummary}, short enough for a badge.
 *
 * The header's count is a fixed-size pill — `flex: 0 0 auto` with `nowrap` —
 * sitting between the title and the search context. Putting the sentence in it
 * shoved the search context and the Group by control sideways and the toolbar
 * read as three captions fighting for one line. The sentence is still the
 * tooltip, where it has room.
 *
 * Collapses to a single figure once the window covers everything, because
 * "401 / 401" asks the player to compare two numbers to learn they are the
 * same.
 */
export function getCatalogWindowBadge(
  renderedCount: number,
  totalCount: number,
  separators: NumberSeparators,
): string {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeRendered = Math.max(0, Math.floor(Number.isFinite(renderedCount) ? renderedCount : 0));
  const shown = Math.min(safeRendered, safeTotal);
  const total = groupCount(safeTotal, separators);

  return shown === safeTotal ? total : `${groupCount(shown, separators)} / ${total}`;
}

export function getCatalogWindowSummary(
  renderedCount: number,
  totalCount: number,
  separators: NumberSeparators,
): string {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeRendered = Math.max(0, Math.floor(Number.isFinite(renderedCount) ? renderedCount : 0));
  // A narrowing predicate shrinks the total while the previous rows are still
  // mounted, and "Showing 500 of 120" reads as a bug rather than as a stale frame.
  const shown = Math.min(safeRendered, safeTotal);

  return `Showing ${groupCount(shown, separators)} of ${groupCount(safeTotal, separators)}`;
}

