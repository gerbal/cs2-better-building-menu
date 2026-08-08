/**
 * Which lines a grid tile's hover card actually shows.
 *
 * The card used to print three fixed lines of bare values: a cost with no
 * word beside it, then "{capacity} · {lot}", then "{upkeep} · {lot}" — the lot
 * twice, and every line unlabelled, so the card read as a column of
 * unattributed figures. Worse, the capacity and lot lines rendered
 * unconditionally, so a road with no footprint and no capacity still spent two
 * of its three lines saying "—".
 *
 * A line earns its place by having a value. Nothing else does.
 */
export interface TileTooltipLine {
  key: string;
  label: string;
  value: string;
  /** Drives the affordability / coverage colouring the forecasts already had. */
  tone?: "warn" | "good";
}

export interface TileTooltipCandidate extends TileTooltipLine {
  /**
   * False when the field does not apply to this asset at all — a network's
   * lot, a road's capacity. Distinct from "applies but is unknown", which the
   * caller signals by leaving the value empty.
   */
  applicable: boolean;
}

/**
 * The cap is deliberate: the grid exists because it is faster to read than the
 * table, and a hover card that grows to eight lines is the table again with
 * worse manners.
 *
 * Four rather than three, because dropping the inapplicable lines freed the
 * room. At three, a service building spent every slot on cost, capacity and
 * upkeep and silently lost its lot size — which is the one figure that decides
 * whether the thing fits where you are standing.
 */
export const TILE_TOOLTIP_MAX_LINES = 4;

/**
 * Whether a metric has a value worth printing.
 *
 * Absent stays absent — the indexer leaves a missing component null rather
 * than serialising a misleading zero, and this is the other half of that
 * contract. A real zero is a value and passes; only null, undefined and
 * non-finite numbers are nothing.
 */
export function isMetricPresent(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildTileTooltipLines(
  candidates: readonly TileTooltipCandidate[],
  max: number = TILE_TOOLTIP_MAX_LINES,
): TileTooltipLine[] {
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;

  return candidates
    .filter((candidate) => candidate.applicable && candidate.value.trim() !== "")
    .slice(0, limit)
    .map(({ key, label, value, tone }) => (tone ? { key, label, value, tone } : { key, label, value }));
}
