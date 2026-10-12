import { bindValue, useValue } from "cs2/api";

import { DEFAULT_TRANSPARENCY } from "domain/looks";

/**
 * The player's interface transparency, 0 to 1, from the game's own ("options",
 * "interfaceTransparency") binding, which follows the Options slider as it moves.
 */
const InterfaceTransparency$ = bindValue<number>("options", "interfaceTransparency", DEFAULT_TRANSPARENCY);

/** The game's default until the binding answers. */
export function useInterfaceTransparency(): number {
  const transparency = useValue(InterfaceTransparency$);
  return typeof transparency === "number" && Number.isFinite(transparency) ? transparency : DEFAULT_TRANSPARENCY;
}
