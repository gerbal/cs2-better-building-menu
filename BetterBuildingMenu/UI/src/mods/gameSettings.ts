import { useMemo } from "react";
import { useLocalization } from "cs2/l10n";
import { TextScale$, textScaleOf } from "domain/textScaleSetting";
import { UnitSettings$, unitSystemOf } from "domain/unitSettings";
import { getNumberSeparators, type NumberSeparators, type UnitSystem } from "domain/assetMenuMetricFormat";
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

/**
 * The player's number marks and units, from the game's dictionary. One object until
 * the language or the unit system changes, so the rows it is handed to skip a render.
 */
export function useNumberSeparators(): NumberSeparators {
  const { translate } = useLocalization();
  const unitSystem = useUnitSystem();

  return useMemo(() => getNumberSeparators(translate, unitSystem), [translate, unitSystem]);
}
