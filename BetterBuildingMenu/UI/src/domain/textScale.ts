/**
 * The game's Interface > Text scale setting, as the factor each font size
 * actually grows by — vanilla's own calc() per size. They grow neither linearly
 * nor alike, so a budget sized for 100 % is wrong at anything else.
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
