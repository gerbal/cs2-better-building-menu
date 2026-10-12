import { bindValue, useValue } from "cs2/api";

/**
 * The player's interface transparency, 0 to 1, from the game's own ("options",
 * "interfaceTransparency") binding, which follows the Options slider as it moves.
 */
const InterfaceTransparency$ = bindValue<number>("options", "interfaceTransparency", 0.5);

/** The game's default, 0.5, until the binding answers. */
export function useInterfaceTransparency(): number {
  const transparency = useValue(InterfaceTransparency$);
  return typeof transparency === "number" && Number.isFinite(transparency) ? transparency : 0.5;
}
