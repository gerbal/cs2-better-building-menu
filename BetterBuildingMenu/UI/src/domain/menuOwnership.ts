/**
 * Whether the asset menu stands in for the toolbar's open menu, decided in the UI.
 *
 * C# clears OwnsCurrentMenu on every close and sets it again when it hears the
 * next selection, which reaches the UI a frame after the game has mounted its own
 * menu: the game built vanilla's grid for that frame, and the asset menu came a
 * frame late. C# also publishes the menus it would take over (OwnedAssetMenus,
 * computed by the same rule it answers a selection with), so the UI can decide
 * in the frame the game opens the menu. See docs/design-notes.md, "Opening a menu".
 */

/** A toolbar menu C# stands in for: its entity index and prefab name. */
export interface OwnedAssetMenu {
  index: number;
  name: string;
}

/** The open menu's prefab name when C# lists it as one it takes over. */
export function ownedMenuName(selectedIndex: number | null, owned: readonly OwnedAssetMenu[]): string | null {
  if (selectedIndex === null) {
    return null;
  }

  for (const menu of owned) {
    if (menu.index === selectedIndex) {
      return menu.name;
    }
  }

  return null;
}

export interface MenuOwnershipState {
  replaceEnabled: boolean;
  /** C#'s own answer, a frame after the selection. Still authoritative. */
  ownsCurrentMenu: boolean;
  /** The toolbar's open menu, by entity index; null when none is open. */
  selectedIndex: number | null;
  owned: readonly OwnedAssetMenu[];
}

/** Whether the asset menu stands in for the toolbar's open menu now. */
export function ownsSelectedMenu({ replaceEnabled, ownsCurrentMenu, selectedIndex, owned }: MenuOwnershipState): boolean {
  if (ownsCurrentMenu) {
    return true;
  }

  return replaceEnabled && ownedMenuName(selectedIndex, owned) !== null;
}

export interface SlotJoinState {
  /** The menu the slot was opened for; null when only OwnsCurrentMenu put it up. */
  slotMenu: string | null;
  /** The menu the kept page answers; empty when its query was not scoped to one. */
  pageMenu: string;
  /** Whether any page has arrived since the slot opened: C# has answered the open. */
  pageSinceOpen: boolean;
  /** Whether the wait for that answer has run out. */
  waitedOut: boolean;
}

/**
 * Whether the kept menu moves into the slot now. At once when the page it holds is
 * the opened menu's (a reopen); otherwise when C#'s answer to the open arrives, so
 * no frame ever shows another menu's header and cards under this menu's button.
 */
export function shouldJoinSlot({ slotMenu, pageMenu, pageSinceOpen, waitedOut }: SlotJoinState): boolean {
  if (pageSinceOpen || waitedOut) {
    return true;
  }

  return !!slotMenu && slotMenu === pageMenu;
}
