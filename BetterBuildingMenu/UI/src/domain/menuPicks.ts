/**
 * Each menu's own pick, as C# publishes it from the settings: its VIEW or its GROUP. See
 * docs/design-notes.md, "Each menu's own view and group".
 */

/** One menu's pick: the menu by the game's name, as the catalog's rows carry it, and the value. */
export interface MenuPick {
  menu: string;
  value: string;
}

/** A menu's own pick, or "" when it has none and draws its default. */
export function menuPickOf(picks: readonly MenuPick[] | null | undefined, menu: string | null | undefined): string {
  return picks?.find((pick) => pick.menu === menu)?.value ?? "";
}
