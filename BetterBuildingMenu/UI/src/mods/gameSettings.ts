import { TextScale$, textScaleOf } from "domain/textScaleSetting";
import { UnitSettings$, unitSystemOf } from "domain/unitSettings";
import type { UnitSystem } from "domain/assetMenuMetricFormat";
import { useValue } from "mods/panelValue";

/**
 * The game's own settings the build menu draws with, read through the kept menu's
 * useValue: text scale re-fires as its slider moves, and a hidden menu must not
 * follow it (see mods/panelValue).
 */
export function useTextScale(): number {
  return textScaleOf(useValue(TextScale$));
}

export function useUnitSystem(): UnitSystem {
  return unitSystemOf(useValue(UnitSettings$));
}
