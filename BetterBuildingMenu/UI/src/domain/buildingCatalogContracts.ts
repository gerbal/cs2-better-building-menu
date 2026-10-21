/**
 * The catalog's sort state in a pure module, so Node's browserless runner can
 * exercise the same rule the Gameface components follow.
 */
import type { SortColumn } from "./sharedContracts.generated";

// C# owns the sort columns; see sharedContracts.generated.ts.
export type { SortColumn };

export interface SortState {
  column: SortColumn;
  descending: boolean;
}

export function nextSortState(current: SortState, column: SortColumn): SortState {
  return {
    column,
    descending: column === current.column ? !current.descending : false,
  };
}

