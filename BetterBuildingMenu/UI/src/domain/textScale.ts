/**
 * The game's Interface › Text scale setting, as the factor each of its font
 * sizes actually grows by.
 *
 * Vanilla applies the setting as two root variables — `--fontScale` is the
 * scale s (1.0–1.5) and `--fontScaleChange` is s − 1 — and every
 * `--fontSize*` is a calc() of the two, read off the shipped bundle:
 *
 *   XS = 12·s + (s−1)·1.15·12
 *   S  = 14·s + (s−1)·1.1·14
 *   M  = 14·s + 2 + (s−1)·1.05·14
 *
 * so the sizes do not grow linearly with the setting, nor by the same factor
 * as each other: at 125 % XS is ×1.54, S ×1.53, M ×1.45. A character budget
 * or a column width sized for 100 % is wrong by that much at 125 %; measured
 * live, grid tile names overran their line by 10–40px and the Table's Cost
 * and Upkeep cells by 15–20px.
 */
export type FontSizeKind = "xs" | "s" | "m";

const fontSizeRem = (kind: FontSizeKind, scale: number): number => {
  const change = scale - 1;
  switch (kind) {
    case "xs": return 12 * scale + change * 1.15 * 12;
    case "s": return 14 * scale + change * 1.1 * 14;
    case "m": return 14 * scale + 2 + change * 1.05 * 14;
  }
};

/** How much larger the named size draws at this text scale than at 100 %. */
export function fontSizeRatio(kind: FontSizeKind, textScale: number): number {
  const scale = Number.isFinite(textScale) && textScale > 0 ? textScale : 1;
  return fontSizeRem(kind, scale) / fontSizeRem(kind, 1);
}
