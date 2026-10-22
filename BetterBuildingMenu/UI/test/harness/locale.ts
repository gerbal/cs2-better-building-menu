import { FALLBACK_SEPARATORS, type NumberSeparators, type UnitSystem } from "domain/assetMenuMetricFormat";

/** The game's translate with no locale loaded: a key answers with its English fallback, or null without one. */
export const english = (_key: string, fallback?: string | null): string | null => (fallback === undefined ? null : fallback);

/** The fallback separators, read under a unit system. */
export const separators = (unitSystem: UnitSystem): NumberSeparators => ({ ...FALLBACK_SEPARATORS, unitSystem });
