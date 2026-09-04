import { bindValue, useValue } from "cs2/api";
import { UnitSystem } from "domain/buildingLensMetricFormat";

/**
 * The player's unit system, read from the game's own settings binding.
 *
 * Vanilla publishes it as a GetterValueBinding on ("options", "unitSettings")
 * carrying { timeFormat, temperatureUnit, unitSystem }, where unitSystem is
 * InterfaceSettings.UnitSystem as an integer — 0 Metric, 1 Freedom. Being an
 * update binding, it re-fires when the player changes the setting, so a card
 * open at the time re-renders in the new units rather than going stale.
 *
 * This is not a mod setting and must never become one: a second switch for
 * something the game already asks once is a way for the two to disagree.
 *
 * The whole object is bound rather than a projection of it, because that is
 * the shape vanilla writes; the other two fields are ignored here but cost
 * nothing and are what a future temperature or clock would read.
 */
interface VanillaUnitSettings {
  timeFormat?: number;
  temperatureUnit?: number;
  unitSystem?: number;
}

const UnitSettings$ = bindValue<VanillaUnitSettings>("options", "unitSettings", {});

/**
 * Metric until the binding answers.
 *
 * The first frame has no value, and metric is both the game's own default and
 * the safer wrong answer: a metric player shown metres sees nothing odd, where
 * a Freedom player shown yards for one frame would flicker.
 */
export function useUnitSystem(): UnitSystem {
  const settings = useValue(UnitSettings$);

  return settings?.unitSystem === UnitSystem.Freedom ? UnitSystem.Freedom : UnitSystem.Metric;
}
