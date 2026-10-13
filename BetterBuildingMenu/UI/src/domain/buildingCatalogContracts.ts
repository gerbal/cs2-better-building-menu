/**
 * The catalog's commands in a pure module, so Node's browserless runner can
 * exercise the same commands the Gameface components fire and the payloads
 * cannot drift from the C# bindings.
 */
import type { Command } from "./command";
import type { MetricRangeId } from "./buildingCatalogRanges";
import { SORT_FIRST_DESCENDING, type SortColumn } from "./sharedContracts.generated";

// C# owns the sort columns; see sharedContracts.generated.ts.
export type { SortColumn };

export interface TriggerCommand extends Command {
  args: readonly (string | number | boolean)[];
}

export interface SortState {
  column: SortColumn;
  descending: boolean;
}

export function createTriggerCommand(method: string, ...args: (string | number | boolean)[]): TriggerCommand {
  return { method, args };
}

export const setSortColumnCommand = (column: SortColumn): TriggerCommand => createTriggerCommand("SetBuildingCatalogSortColumn", column);
export const setSortDescendingCommand = (descending: boolean): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogSortDescending", descending);
// Names the limit wanted, so a request sent twice (a double click, the scroll
// poll firing again before the answer lands) grows the window once. The backend
// still owns the step and the ceiling and clamps the request to both.
export const loadMoreCatalogCommand = (requestedLimit: number): TriggerCommand =>
  createTriggerCommand("LoadMoreBuildingCatalog", requestedLimit);
export const setBuildingCatalogMetricRangeCommand = (id: MetricRangeId, minText: string, maxText: string): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogMetricRange", id, minText, maxText);
export const clearBuildingCatalogMetricRangesCommand = (): TriggerCommand =>
  createTriggerCommand("ClearBuildingCatalogMetricRanges");
export const searchChangedCommand = (value: string): TriggerCommand => createTriggerCommand("SearchChanged", value);
// A row a press, down for 1: C# walks the rows that can be placed and stops at the list's ends, so a
// key held past one leaves the target at the end. Each press is a refresh, so the keys send one at a time.
export const moveEnterTargetCommand = (direction: 1 | -1): TriggerCommand => createTriggerCommand("MoveEnterTarget", direction);
// How many buildings one screen of the drawn body holds, 0 for a body without slots: C# keeps the window past it.
// A whole count of 0 or more, since C# reads an int and a body measured before its stylesheet loads reads NaN.
export const setCatalogScreenCommand = (slots: number): TriggerCommand =>
  createTriggerCommand("SetCatalogScreen", Number.isFinite(slots) ? Math.max(0, Math.floor(slots)) : 0);

// A press on the Locked label: the locked rows leave the window, or come back. C# collapses only those.
export const setSectionCollapsedCommand = (id: string, collapsed: boolean): TriggerCommand =>
  createTriggerCommand("SetCatalogSectionCollapsed", id, collapsed);

// The small menus, one name a line, whose rows all fit one screen: C# opens each on All from its next open.
export const setMenusOpeningOnAllCommand = (joined: string): TriggerCommand =>
  createTriggerCommand("SetMenusOpeningOnAll", joined);

// Of those, the ones of one tab drawn as a list with Small menus grow on, one name a line: C# groups
// each one's All by none unless picked.
export const setMenusDrawingNoGroupsCommand = (joined: string): TriggerCommand =>
  createTriggerCommand("SetMenusDrawingNoGroups", joined);

/** Whether a sort's first click puts the highest first, which C# says per sort (SortDefaults). */
const startsDescending = (column: SortColumn): boolean =>
  (SORT_FIRST_DESCENDING as readonly string[]).includes(column);

/** A new column starts best first; a click on the sort already chosen reverses it. */
export function nextSortState(current: SortState, column: SortColumn): SortState {
  return {
    column,
    descending: column === current.column ? !current.descending : startsDescending(column),
  };
}

