/**
 * A building's effects in words: each one's label, then its number as the
 * game's own formatter draws it in vanilla's tooltip.
 */

import type { EffectLine } from "./buildingCatalog";
import { FALLBACK_SEPARATORS, groupDigits, type NumberSeparators } from "./buildingLensMetricFormat";

/**
 * The game's renderer for a signed number in one of its units, the one its
 * tooltip draws an effect with. Injected, so this module stays pure.
 */
export type RenderGameNumber = (value: number, unit: string) => string | null | undefined;

const PERCENTAGE = "percentage";

/**
 * Ours, for when the game's renderer is not there: the rounding its two effect
 * units apply, the sign, and the player's separators. A whole percentage, or
 * floatSingleFraction's one decimal.
 */
export function formatEffectDelta(
  delta: number,
  unit: string,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  const percent = unit === PERCENTAGE;
  const rounded = percent ? Math.round(delta) : singleFraction(delta);
  // A plus on a gain only: a loss carries its own minus, and a zero neither.
  const sign = rounded > 0 ? "+" : "";

  return `${sign}${groupDigits(rounded, separators)}${percent ? "%" : ""}`;
}

/**
 * floatSingleFraction: one decimal, a whole number from 100 up, and never less
 * than 0.1 for a figure that is not zero, so a small effect still reads as one.
 */
function singleFraction(value: number): number {
  const magnitude = Math.abs(value);

  if (magnitude >= 100) return Math.round(value);
  if (magnitude > 0 && magnitude < 0.1) return Math.sign(value) * 0.1;

  return Math.round(value * 10) / 10;
}

/** One line per effect, in the order the building carries them. */
export function effectLines(
  effects: readonly EffectLine[] | null | undefined,
  render: RenderGameNumber | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string[] {
  return (effects ?? []).map((effect) => `${effect.label} ${formatEffect(effect, render, separators)}`);
}

function formatEffect(effect: EffectLine, render: RenderGameNumber | undefined, separators: NumberSeparators): string {
  if (render) {
    try {
      const drawn = render(effect.delta, effect.unit);
      if (typeof drawn === "string" && drawn !== "") return drawn;
    } catch {
      // The game's renderer is its UI's, not ours to rely on: ours draws the line instead.
    }
  }

  return formatEffectDelta(effect.delta, effect.unit, separators);
}
