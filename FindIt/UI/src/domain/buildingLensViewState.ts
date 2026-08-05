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

/** Test seam; not used by the UI. */
export function resetLensViewState(): void {
  viewState.clear();
}

export const LENS_DISCLOSURE_KEYS = {
  facets: "facets",
  metricRanges: "metricRanges",
} as const;
