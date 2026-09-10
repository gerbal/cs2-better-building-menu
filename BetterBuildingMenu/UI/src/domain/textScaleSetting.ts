import { bindValue, useValue } from "cs2/api";

/**
 * The player's text scale, from the game's own ("options", "textScale")
 * binding, which re-fires as the slider moves so an open grid re-lays itself
 * out. Not a mod setting, for the same reason the unit system is not.
 */
const TextScale$ = bindValue<number>("options", "textScale", 1);

/** 1 until the binding answers — the game's own default, and the safe one. */
export function useTextScale(): number {
  const scale = useValue(TextScale$);
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1;
}
