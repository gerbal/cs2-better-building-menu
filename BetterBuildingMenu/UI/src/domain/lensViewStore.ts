/**
 * The one store for the lens's purely visual state, which has to outlive a
 * React unmount but has no bearing on the query, so it is neither a backend
 * binding nor persisted. One object, because two subtrees read it.
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
 * Checked per field on the partial, so a component re-writing the value it
 * already holds does not re-render every subscriber.
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
 * Build the composite key an anchor is stored under: surface, view mode and
 * group dimension each rebuild the list, so all three are in it. The value is
 * an entry ID, which survives a window coming back a different length.
 */
export function getLensAnchorKey({ surface, viewMode, groupBy = "" }: LensAnchorKeyParts): string {
  return `${surface}|${viewMode}|${groupBy}`;
}

export function getLensAnchor(key: string): number | null {
  return state.anchors[key] ?? null;
}

export function setLensAnchor(key: string, entryId: number | null): void {
  const anchors: Record<string, number> = { ...state.anchors };

  // A stored NaN can never equal an entry id, so it would restore nothing and
  // be indistinguishable from an anchor that was never taken.
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
