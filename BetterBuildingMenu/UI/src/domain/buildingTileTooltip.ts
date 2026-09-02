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
  /**
   * Rendered one per line when present, with `value` ignored.
   *
   * Unlock conditions are the case: three of them run together on one line read
   * as one long condition, and the reader has to find the separators before
   * they can count them.
   */
  values?: string[];
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

  /**
   * A line whose label says everything, with no value beside it.
   *
   * Vanilla's asset panel has one — its already-built row is a single phrase on
   * a coloured band, not a label/value pair — and this card could not express
   * it: the empty-value guard below read the blank as "nothing to say" and
   * dropped the line, so the row was implemented and rendered nowhere.
   */
  statement?: boolean;
}

/**
 * The cap is deliberate: the grid exists because it is faster to read than the
 * table, and a hover card that grows without limit is the table again with
 * worse manners.
 *
 * Seven, which is now every field there is — requires, cost, capacity,
 * parking, provides, upkeep, lot. At that point the cap has stopped doing the
 * work: applicability is what keeps a card short, and this only guards against
 * future growth going unnoticed. Originally four, which — unlock conditions and city
 * effects joined cost, capacity, upkeep and lot — and at four a locked
 * signature building silently lost its footprint to make room. The cap is a
 * ceiling on a card that has already dropped every field that does not apply,
 * so a typical asset still shows three or four; only one carrying everything
 * reaches six.
 */
export const TILE_TOOLTIP_MAX_LINES = 7;

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
    // The guard still earns its place — a metric that resolved to nothing must
    // not draw a label with a blank beside it — but a statement opts out of it.
    .filter((candidate) =>
      candidate.applicable && (candidate.statement === true || candidate.value.trim() !== ""))
    .slice(0, limit)
    .map(({ key, label, value, values, tone }) => {
      const line: TileTooltipLine = { key, label, value };
      if (values && values.length > 0) line.values = values;
      if (tone) line.tone = tone;
      return line;
    });
}
