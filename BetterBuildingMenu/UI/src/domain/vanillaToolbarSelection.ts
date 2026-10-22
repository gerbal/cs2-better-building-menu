/**
 * The game's own filter row, forwarded to the backend: `ToolbarUISystem`
 * filters its own grid on four bindings, and the asset menu replaced that grid and
 * not the row. The rule is C#'s; this only carries the selection across.
 */

import { toolbarEntityIndex, type ToolbarEntity } from "./toolbarEntity";

/** What the four bindings currently say. */
export interface VanillaToolbarState {
  themes: readonly ToolbarEntity[];
  packs: readonly ToolbarEntity[];
  vanillaSelected: boolean;
  modsSelected: boolean;
}

/**
 * Entity indices, comma-joined, in the order the toolbar gave them. Entries
 * that do not resolve are dropped rather than sent as NaN; the binding carries
 * a bare number, a string or an {index, version} pair depending on which.
 */
export function joinEntityIndices(entities: readonly ToolbarEntity[] | null | undefined): string {
  if (!entities || entities.length === 0) {
    return "";
  }

  const indices: number[] = [];

  for (const entity of entities) {
    const index = toolbarEntityIndex(entity);

    if (index !== null) {
      indices.push(index);
    }
  }

  return indices.join(",");
}

/**
 * A stable string for the whole row, so the forward only fires on real change:
 * the bindings re-emit on unrelated toolbar churn, and every spurious forward
 * costs a full catalog rebuild.
 */
export function toolbarSelectionKey(state: VanillaToolbarState): string {
  return [
    joinEntityIndices(state.themes),
    joinEntityIndices(state.packs),
    state.vanillaSelected ? "1" : "0",
    state.modsSelected ? "1" : "0",
  ].join("|");
}
