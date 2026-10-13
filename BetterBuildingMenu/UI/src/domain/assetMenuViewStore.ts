import type { ListForm } from "./bodyGeometry";
import type { BuildingCatalogEntry, SharedValue } from "./buildingCatalog";
import type { Rect } from "./hoverCardPlace";

/**
 * The one store for the asset menu's visual state, which has to outlive a React
 * unmount but has no bearing on the query. One object, because two subtrees read
 * it. It keeps this session only; each menu's view is C#'s.
 */

export interface AssetMenuView {
  /** Drawer open/closed by key; absent means "use the fallback". */
  disclosures: Readonly<Record<string, boolean>>;
  /** Where the player was in each list, by getAssetMenuAnchorKey — an entry id, never a pixel offset. */
  anchors: Readonly<Record<string, number>>;
  /** The start the list was last put in place for (BuildingCatalogPage.listStart), so a remount does not redo it. */
  listStart: number | null;
  /** The game's slot's left edge as last read, and the window it was read in, so a remount starts there. */
  slot: SlotReading | null;
  /** The values the readout says once, which the rows that hold them leave blank; none while it says none. */
  said: readonly SharedValue[];
  /** The form the list draws its plates in, which decides the numbers the readout may say; null while no list draws. */
  drawnForm: ListForm | null;
  /** The building the pointer rests on and its cell on screen, in rem, which the hover card says; null for none. */
  pointed: Pointed | null;
}

/** A building pointed at, and where its cell sits on screen, in rem. */
export interface Pointed {
  entry: BuildingCatalogEntry;
  cell: Rect;
}

/** Where the game's slot starts, in rem, on a window of this size in pixels. */
export interface SlotReading {
  innerWidth: number;
  innerHeight: number;
  left: number;
}

const initial = (): AssetMenuView => ({ disclosures: {}, anchors: {}, listStart: null, slot: null, said: [], drawnForm: null, pointed: null });

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

/** The start the list was last put in place for, or null before the first. */
export function getAssetMenuListStart(): number | null {
  return state.listStart;
}

export function setAssetMenuListStart(start: number | null): void {
  setAssetMenuView({ listStart: start });
}

/** The slot's left edge as last read on a window of this size, or null: another size's would place the box wrong. */
export function getAssetMenuSlotLeft(innerWidth: number, innerHeight: number): number | null {
  const { slot } = state;

  return slot !== null && slot.innerWidth === innerWidth && slot.innerHeight === innerHeight ? slot.left : null;
}

export function setAssetMenuSlotLeft(reading: SlotReading): void {
  if (getAssetMenuSlotLeft(reading.innerWidth, reading.innerHeight) === reading.left) {
    return;
  }

  setAssetMenuView({ slot: reading });
}

export const ASSET_MENU_DISCLOSURE_KEYS = {
  facets: "facets",
  metricRanges: "metricRanges",
} as const;

/**
 * Says which values the readout says once; the same values said again tell no subscriber. A value is
 * its figure, its basis and its unit: one figure in another basis or unit is another value.
 */
export function setReadoutSaid(said: readonly SharedValue[]): void {
  const key = (values: readonly SharedValue[]) =>
    values.map((value) => `${value.kind}:${value.value}:${value.depth}:${value.perCell ?? ""}:${value.unit ?? ""}`).join("|");

  if (key(said) === key(state.said)) {
    return;
  }

  setAssetMenuView({ said });
}

/** Says which form the list draws its plates in; null once it draws none. */
export function setDrawnForm(form: ListForm | null): void {
  setAssetMenuView({ drawnForm: form });
}

/** Says the pointer rests on this building's cell. */
export function setPointed(pointed: Pointed): void {
  setAssetMenuView({ pointed });
}

/**
 * Says the pointer left this building's cell: only while it is still the one pointed at, so a leave the
 * engine sends after the next cell's enter takes nothing away; with no id, whatever is pointed at.
 */
export function clearPointed(id?: number): void {
  if (state.pointed !== null && (id === undefined || state.pointed.entry.id === id)) setAssetMenuView({ pointed: null });
}
