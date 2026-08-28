/**
 * Turns the numbers we project into the answer the player is actually after.
 *
 * A value is not decision support. "115 000" is a fact about a prefab;
 * "115 000 of 310 000" is a decision about a city. "Capacity 2 000" is a fact;
 * "3 400 of 3 100 students — covers it" is the reason you are standing in this
 * menu at all.
 *
 * Everything here reads the game's own live bindings — toolbarBottom.money for
 * the treasury, educationInfo and friends for demand — so the comparison is
 * against the player's city rather than against nothing.
 *
 * Deliberately returns numbers rather than formatted text: formatting is the
 * component's job, and keeping it there also avoids a domain-to-domain value
 * import, which this toolchain cannot express (node's type stripping needs an
 * explicit .ts extension and TS2691 forbids one).
 */

export interface CostForecast {
  cost: number;
  treasury: number | null;
  share: number | null;
  affordable: boolean;
}

export interface CapacityForecast {
  /**
   * What the verdict compared against demand.
   *
   * cm-7r5r. Without this the verdict answered one of two different questions
   * depending on data availability, and said which nowhere: "does the city
   * meet demand once this is built" when a baseline was known, and "does THIS
   * BUILDING meet the whole city's demand" when it was not. A 25-patient
   * clinic in a city with ample beds and one in a city with none rendered
   * identically. The caller now knows which it is holding.
   */
  basis: "city" | "building";
  /** Null when the city's current capacity is unknown; report `added` instead. */
  projected: number | null;
  added: number;
  demand: number;
  unit: string;
  covers: boolean;
  shortfall: number;
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function getCostForecast(
  cost: number | null | undefined,
  treasury: number | null | undefined
): CostForecast | null {
  if (!isNumber(cost)) {
    return null;
  }

  if (!isNumber(treasury)) {
    // Still worth stating the cost; just without a comparison to make.
    return { cost, treasury: null, share: null, affordable: true };
  }

  return {
    cost,
    treasury,
    // A bankrupt treasury makes the share meaningless, but the answer to
    // "can I afford this" is still a clear no.
    share: treasury > 0 ? Math.round((cost / treasury) * 100) : Number.POSITIVE_INFINITY,
    affordable: treasury >= cost,
  };
}

export function getCapacityForecast(input: {
  added: number | null | undefined;
  current: number | null | undefined;
  demand: number | null | undefined;
  unit: string;
}): CapacityForecast | null {
  // No capacity means nothing to forecast, and no demand series means we would
  // be guessing — a park has no "eligible" figure. Better silent than
  // confidently wrong.
  if (!isNumber(input.added) || input.added <= 0 || !isNumber(input.demand)) {
    return null;
  }

  // A zero baseline is indistinguishable from "the binding has not reported
  // yet". Claiming "2 000 of 291" when the city already has 1 400 places is
  // worse than claiming less, so an unknown baseline reports the contribution
  // rather than a total that would be quietly wrong.
  const hasBaseline = isNumber(input.current) && input.current > 0;
  const projected = hasBaseline ? (input.current as number) + input.added : null;
  const measured = projected ?? input.added;

  return {
    basis: hasBaseline ? "city" : "building",
    projected,
    added: input.added,
    demand: input.demand,
    unit: input.unit,
    covers: measured >= input.demand,
    shortfall: Math.max(0, input.demand - measured),
  };
}
