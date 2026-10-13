import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { useMemo } from "react";

import { getNumberSeparators, type NumberSeparators } from "domain/assetMenuMetricFormat";
import { lookOf } from "domain/looks";
import { workersUnitWord } from "domain/hoverCardLines";
import { GLYPH_MARKS, type UnitMarks } from "domain/rowNumbers";
import { useUnitSystem } from "domain/unitSettings";
import { AssetMenuLook$ } from "mods/bindings";

/** Why a building cannot be placed, in words; the words every body's buildings say it with. */
export interface StateWords {
  locked: string;
  built: string;
}

/**
 * The locked and already-built words, read once per body rather than per building. The game's own
 * already-built string first, so a body reads as vanilla's menu does; ours where the key is missing.
 */
export function useStateWords(): StateWords {
  const { translate } = useLocalization();

  return useMemo(() => ({
    locked: translate("Tooltip.LABEL[BetterBuildingMenu.Locked]", "Locked") ?? "Locked",
    built: translate("Toolbar.ASSET_ALREADY_BUILT", "") || translate("Tooltip.LABEL[BetterBuildingMenu.AlreadyBuilt]", "Already built") || "Already built",
  }), [translate]);
}

/** The digit separators a body's numbers use, held still until the language or the unit system changes. */
export function useNumberSeparators(): NumberSeparators {
  const { translate } = useLocalization();
  const unitSystem = useUnitSystem();

  return useMemo(() => getNumberSeparators(translate, unitSystem), [translate, unitSystem]);
}

/** How the look marks a key number's unit, held still until the look or the language changes: Standard's glyphs, or Plates' words. */
export function useUnitMarks(): UnitMarks {
  const { translate } = useLocalization();
  const units = lookOf(useValue(AssetMenuLook$)).units;

  return useMemo(
    () => (units === "word"
      ? {
          mode: "word",
          workersUnit: workersUnitWord(translate),
          capacityUnit: translate("Tooltip.LABEL[BetterBuildingMenu.CapacityUnit]", "capacity") ?? "capacity",
        }
      : GLYPH_MARKS),
    [units, translate]
  );
}
