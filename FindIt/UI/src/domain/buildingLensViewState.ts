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
  if (choiceState.get(key) === value) {
    return;
  }

  choiceState.set(key, value);
  listeners.forEach((listener) => listener());
}

/**
 * Notify on every choice change.
 *
 * The control plane and the catalog live in different React subtrees — the
 * pane is a sibling of the panel, not a descendant — so a module map alone
 * lets them disagree: the pane would set the group dimension and the grid
 * would go on rendering the old one until something else remounted it. A
 * subscription is the smallest thing that keeps them one value rather than
 * two copies.
 *
 * Deliberately not a backend binding, for the same reason the state is not:
 * this is presentation with no bearing on the query.
 */
type LensChoiceListener = () => void;

const listeners = new Set<LensChoiceListener>();

export function subscribeLensChoice(listener: LensChoiceListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Test seam; not used by the UI. */
export function resetLensViewState(): void {
  viewState.clear();
  choiceState.clear();
  listeners.clear();
}

export const LENS_DISCLOSURE_KEYS = {
  facets: "facets",
  metricRanges: "metricRanges",
} as const;
