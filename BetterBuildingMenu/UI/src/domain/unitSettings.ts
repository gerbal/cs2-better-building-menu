import { bindValue } from "cs2/api";
import { UnitSystem } from "domain/assetMenuMetricFormat";

/**
 * The player's unit system, from the game's own ("options", "unitSettings")
 * binding, which re-fires when they change it. Never a mod setting: a second
 * switch for what the game already asks is a way for the two to disagree.
 */
export interface VanillaUnitSettings {
  timeFormat?: number;
  temperatureUnit?: number;
  unitSystem?: number;
}

export const UnitSettings$ = bindValue<VanillaUnitSettings>("options", "unitSettings", {});

/**
 * Metric until the binding answers. It is the game's own default and the safer
 * wrong answer for one frame: metric shown to a metric player looks like
 * nothing at all. See mods/gameSettings.
 */
export function unitSystemOf(settings: VanillaUnitSettings | null | undefined): UnitSystem {
  return settings?.unitSystem === UnitSystem.Freedom ? UnitSystem.Freedom : UnitSystem.Metric;
}
