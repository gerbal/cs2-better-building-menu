/**
 * The one store for the asset menu's purely visual state, which has to outlive a
 * React unmount but has no bearing on the query, so it is neither a backend
 * binding nor persisted. One object, because two subtrees read it.
 */

export interface AssetMenuView {
  /** Grid, list, cards or table; "" until the player has chosen, meaning the component's default. */
  viewMode: string;
  /** The table row opened to its full height, by entry id. */
  expandedId: number | null;
  /** Drawer open/closed by key; absent means "use the fallback". */
  disclosures: Readonly<Record<string, boolean>>;
  /** Where the player was in each list, by getAssetMenuAnchorKey — an entry id, never a pixel offset. */
  anchors: Readonly<Record<string, number>>;
}

const initial = (): AssetMenuView => ({ viewMode: "", expandedId: null, disclosures: {}, anchors: {} });

let state: AssetMenuView = initial();

const listeners = new Set<() => void>();

export function getAssetMenuView(): AssetMenuView {
  return state;
}

/**
 * Replace the fields given, and tell the subscribers — unless nothing moved.
 * Checked per field on the partial, so a component re-writing the value it
 * already holds does not re-render every subscriber.
 */
export function setAssetMenuView(partial: Partial<AssetMenuView>): void {
  const keys = Object.keys(partial) as (keyof AssetMenuView)[];

  if (keys.every((key) => Object.is(partial[key], state[key]))) {
    return;
  }

  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

export function subscribeAssetMenuView(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Test seam; not used by the UI. */
export function resetAssetMenuView(): void {
  state = initial();
  listeners.clear();
}

export function getAssetMenuDisclosure(key: string, fallback = false): boolean {
  return state.disclosures[key] ?? fallback;
}

export function setAssetMenuDisclosure(key: string, value: boolean): void {
  if (state.disclosures[key] === value) {
    return;
  }

  setAssetMenuView({ disclosures: { ...state.disclosures, [key]: value } });
}

export interface AssetMenuAnchorKeyParts {
  /** Which list is asking. See the note below on why this is not optional. */
  list: string;
  viewMode: string;
  groupBy?: string;
}

/**
 * Build the composite key an anchor is stored under: list, view mode and
 * group dimension each rebuild the list, so all three are in it. The value is
 * an entry ID, which survives a window coming back a different length.
 */
export function getAssetMenuAnchorKey({ list, viewMode, groupBy = "" }: AssetMenuAnchorKeyParts): string {
  return `${list}|${viewMode}|${groupBy}`;
}

export function getAssetMenuAnchor(key: string): number | null {
  return state.anchors[key] ?? null;
}

export function setAssetMenuAnchor(key: string, entryId: number | null): void {
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

  setAssetMenuView({ anchors });
}

export const ASSET_MENU_DISCLOSURE_KEYS = {
  facets: "facets",
  metricRanges: "metricRanges",
} as const;
