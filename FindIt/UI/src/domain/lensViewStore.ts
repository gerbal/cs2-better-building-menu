/**
 * The one store for the lens's purely visual state.
 *
 * The facet panel, the metric drawer, the view mode and the expanded row all
 * used to live in component state, so every remount — closing the panel,
 * placing a building, toggling the lens — collapsed them back to their
 * defaults. Meanwhile the filters those drawers contain are backend-owned and
 * survived, so the player came back to active filters hidden behind closed
 * drawers, with no visible sign of what was still applied.
 *
 * This is deliberately not a backend binding: it is presentation state with no
 * bearing on the query, and round-tripping it through C# would add bindings
 * and traffic for something that only needs to outlive a React unmount. It is
 * intentionally not persisted across sessions either.
 *
 * One object behind one subscription, because the control pane and the catalog
 * live in different React subtrees — the pane is a sibling of the panel, not a
 * descendant — and two module maps with their own listeners let them disagree.
 * The React hook over this store lives in mods/useLensView.ts; this module
 * stays free of React so the test runner can load it as it is.
 */

export interface LensView {
  /** Grid, list, cards or table; "" until the player has chosen, meaning the component's default. */
  viewMode: string;
  /** The table row opened to its full height, by entry id. */
  expandedId: number | null;
  /** Drawer open/closed by key; absent means "use the fallback". */
  disclosures: Readonly<Record<string, boolean>>;
  /** Where the player was in each list, by getLensAnchorKey — an entry id, never a pixel offset. */
  anchors: Readonly<Record<string, number>>;
}

const initial = (): LensView => ({ viewMode: "", expandedId: null, disclosures: {}, anchors: {} });

let state: LensView = initial();

const listeners = new Set<() => void>();

export function getLensView(): LensView {
  return state;
}

/**
 * Replace the fields given, and tell the subscribers — unless nothing moved.
 *
 * The equality check is per field on the partial, so a component re-writing
 * the value it already holds does not re-render every subscriber.
 */
export function setLensView(partial: Partial<LensView>): void {
  const keys = Object.keys(partial) as (keyof LensView)[];

  if (keys.every((key) => Object.is(partial[key], state[key]))) {
    return;
  }

  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

export function subscribeLensView(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Test seam; not used by the UI. */
export function resetLensView(): void {
  state = initial();
  listeners.clear();
}

export function getLensDisclosure(key: string, fallback = false): boolean {
  return state.disclosures[key] ?? fallback;
}

export function setLensDisclosure(key: string, value: boolean): void {
  if (state.disclosures[key] === value) {
    return;
  }

  setLensView({ disclosures: { ...state.disclosures, [key]: value } });
}

export interface LensAnchorKeyParts {
  /** Which lens is asking. See the note below on why this is not optional. */
  surface: string;
  viewMode: string;
  groupBy?: string;
}

/**
 * Build the composite key an anchor is stored under.
 *
 * Both BuildingCatalog and ZoningHierarchy have a view mode, and two unrelated
 * lists sharing one slot is something nothing in the type system notices.
 * Anchors cannot afford that: restoring one list to a row that only exists in
 * the other scrolls to nothing, or worse, to a coincidence. So the surface is
 * part of the key, along with the view mode and group dimension, because
 * grouping and mode both rebuild the list and an entry's place in one says
 * nothing about its place in another.
 *
 * Rows are not a uniform height: an expanded row is `height: auto`, the density
 * tiers disagree by eight units, and a grid tile changes height when a metric
 * sort puts a figure on it. The window itself comes back from the backend at
 * whatever length it has grown to, so the same scrollTop lands on a different
 * building. An id survives all of that, and the row that no longer exists after
 * a predicate change simply fails to match.
 */
export function getLensAnchorKey({ surface, viewMode, groupBy = "" }: LensAnchorKeyParts): string {
  return `${surface}|${viewMode}|${groupBy}`;
}

export function getLensAnchor(key: string): number | null {
  return state.anchors[key] ?? null;
}

export function setLensAnchor(key: string, entryId: number | null): void {
  const anchors: Record<string, number> = { ...state.anchors };

  // A stored NaN can never equal an entry id, so the restore would quietly do
  // nothing and be indistinguishable from an anchor that was never taken.
  if (entryId === null || !Number.isFinite(entryId)) {
    if (!(key in anchors)) {
      return;
    }

    delete anchors[key];
  } else {
    if (anchors[key] === entryId) {
      return;
    }

    anchors[key] = entryId;
  }

  setLensView({ anchors });
}

export const LENS_DISCLOSURE_KEYS = {
  facets: "facets",
  metricRanges: "metricRanges",
} as const;
