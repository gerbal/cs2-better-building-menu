/**
 * A line in a grid tile's hover card. A line earns its place by having a
 * value, so a card never spends a row printing "—" for a field the asset
 * does not have.
 */
export interface TileTooltipLine {
  key: string;
  label: string;
  value: string;
  /**
   * Rendered one per line when present, with `value` ignored. Unlock
   * conditions need it: run together on one line they read as a single long
   * condition.
   */
  values?: string[];
  /** Drives the affordability / coverage colouring. */
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
   * A line whose label says everything, with no value beside it — vanilla's
   * already-built band is one. It opts the line out of the empty-value guard,
   * which would otherwise read the blank as "nothing to say".
   */
  statement?: boolean;
}

/**
 * A ceiling, not a target: the grid is worth using because it reads faster
 * than the table, and an unbounded hover card is the table again. Applicability
 * is what actually keeps a card short; this only catches unnoticed growth.
 */
export const TILE_TOOLTIP_MAX_LINES = 10;

/**
 * Whether a metric has a value worth printing. The indexer leaves a missing
 * component null rather than serialising a misleading zero, so a real zero
 * passes here and only null, undefined and non-finite numbers are nothing.
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
    // A metric that resolved to nothing must not draw a label with a blank
    // beside it; a statement carries its meaning in the label and opts out.
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
