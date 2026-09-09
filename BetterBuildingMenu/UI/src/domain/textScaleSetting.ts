import { bindValue, useValue } from "cs2/api";

/**
 * The player's text scale, read from the game's own settings binding.
 *
 * Vanilla publishes InterfaceSettings.textScale as a GetterValueBinding on
 * ("options", "textScale") — the float the Interface › Text scale slider
 * sets, 1.0 to 1.5 (OptionsUISystem.cs:587). It is an update binding, so a
 * grid or table open when the player moves the slider re-lays itself out.
 *
 * Not a mod setting, for the same reason the unit system is not: the game
 * already asks once.
 */
const TextScale$ = bindValue<number>("options", "textScale", 1);

/** 1 until the binding answers — the game's own default, and the safe one. */
export function useTextScale(): number {
  const scale = useValue(TextScale$);
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1;
}
