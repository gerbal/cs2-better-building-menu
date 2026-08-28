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

