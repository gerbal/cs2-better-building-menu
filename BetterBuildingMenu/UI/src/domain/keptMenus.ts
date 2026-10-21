import { shouldJoinSlot } from "./menuOwnership";

/**
 * Every toolbar menu's panel is kept built, each holding the page it last drew
 * (see KeptAssetMenu). This is which one the asset-menu slot shows.
 */
export interface KeptMenus {
  /** The menu the slot was opened for; "" when only OwnsCurrentMenu put it up; null with no slot. */
  opened: string | null;
  /** Whether C# has answered this open: a page arrived, or the wait ran out. */
  answered: boolean;
  /** Each built panel, by menu, with the menu of the page it last drew live ("" for a narrower query). */
  built: ReadonlyMap<string, string>;
  /**
   * Panels last drawn in another view or grouping than the current one. Shown at
   * once, their catalog would be rebuilt on screen; they wait for C# instead.
   */
  stale: ReadonlySet<string>;
  /** The panel a switch with the menu up keeps in the slot until the opened menu's can show. */
  held: string | null;
}

/**
 * The opened menu's panel once C# has answered, or before then when its last page
 * was that menu's opening view in the current view and grouping; otherwise the
 * panel held through a switch, or none.
 */
export function shownMenu({ opened, answered, built, stale, held }: KeptMenus): string | null {
  if (opened === null) {
    return null;
  }

  const pageMenu = built.get(opened);
  const current = pageMenu !== undefined && !stale.has(opened);

  if (answered || (current && shouldJoinSlot({ slotMenu: opened || null, pageMenu, answered: false }))) {
    return opened;
  }

  return held !== null && built.has(held) ? held : null;
}
