/**
 * Module-scoped memory for the lens's purely visual view state.
 *
 * The facet panel, the metric drawer, and the Catalog/Tools switch all kept
 * their open/closed state in component state, so every remount — closing the
 * panel, placing a building, toggling the lens — collapsed them back to their
 * defaults. Meanwhile the filters those drawers contain are backend-owned and
 * survived, so the player came back to active filters hidden behind closed
 * drawers, with no visible sign of what was still applied.
 *
 * This is deliberately not a backend binding: it is presentation state with no
 * bearing on the query, and round-tripping it through C# would add bindings
 * and traffic for something that only needs to outlive a React unmount. It is
 * intentionally not persisted across sessions either.
 */

const viewState = new Map<string, boolean>();

export function getLensDisclosure(key: string, fallback = false): boolean {
  const stored = viewState.get(key);

  return stored === undefined ? fallback : stored;
}

export function setLensDisclosure(key: string, value: boolean): void {
  viewState.set(key, value);
}

// The view mode stopped being a boolean when List joined Grid and Table, and
// the group dimension was never one. Same lifetime and same reasoning as the
// booleans above: outlives a React unmount, never reaches the query.
const choiceState = new Map<string, string>();

export function getLensChoice(key: string, fallback: string): string {
  const stored = choiceState.get(key);

  return stored === undefined ? fallback : stored;
}

export function setLensChoice(key: string, value: string): void {
  choiceState.set(key, value);
}

/**
 * Where the player was in the list, as the id of the entry they were looking
 * at — never a pixel offset.
 *
 * Rows are not a uniform height: an expanded row is `height: auto`, the density
 * tiers disagree by eight units, and a grid tile changes height when a metric
 * sort puts a figure on it. The window itself comes back from the backend at
 * whatever length it has grown to, so the same scrollTop lands on a different
 * building. An id survives all of that, and the row that no longer exists after
 * a predicate change simply fails to match.
 */
const anchorState = new Map<string, number>();

export interface LensAnchorKeyParts {
  /** Which lens is asking. See the note below on why this is not optional. */
  surface: string;
  viewMode: string;
  groupBy?: string;
}

/**
 * Build the composite key an anchor is stored under.
 *
 * The choice store above is one flat namespace of unprefixed strings, and both
 * BuildingCatalog and ZoningHierarchy write "viewMode" into it — two unrelated
 * lists sharing one slot, which nothing in the type system notices. Anchors
 * cannot afford that: restoring one list to a row that only exists in the other
 * scrolls to nothing, or worse, to a coincidence. So the surface is part of the
 * key, along with the view mode and group dimension, because grouping and mode
 * both rebuild the list and an entry's place in one says nothing about its
 * place in another.
 */
export function getLensAnchorKey({ surface, viewMode, groupBy = "" }: LensAnchorKeyParts): string {
  return `${surface}|${viewMode}|${groupBy}`;
}

export function getLensAnchor(key: string): number | null {
  const stored = anchorState.get(key);

  return stored === undefined ? null : stored;
}

export function setLensAnchor(key: string, entryId: number | null): void {
  // A stored NaN can never equal an entry id, so the restore would quietly do
  // nothing and be indistinguishable from an anchor that was never taken.
  if (entryId === null || !Number.isFinite(entryId)) {
    anchorState.delete(key);
    return;
  }

  anchorState.set(key, entryId);
}

/** Test seam; not used by the UI. */
export function resetLensViewState(): void {
  viewState.clear();
  choiceState.clear();
  anchorState.clear();
}

export const LENS_DISCLOSURE_KEYS = {
  facets: "facets",
  metricRanges: "metricRanges",
} as const;
