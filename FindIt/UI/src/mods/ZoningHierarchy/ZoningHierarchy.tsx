import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import { getBuildingLensCatalogMaxHeight } from "domain/buildingLensLayout";
import {
  buildZoningHierarchy,
  selectZoneCommand,
  type ZoneEntry,
} from "domain/zoningHierarchy";
import styles from "./zoningHierarchy.module.scss";

const ZoneCatalog$ = bindValue<ZoneEntry[]>(mod.id, "ZoneCatalog", []);
// Empty means every family. The selection lives in C# because the chip row
// renders it, and the chip row is not an ancestor of this component.
const ZoneFamilies$ = bindValue<string[]>(mod.id, "BuildingLensZoneFamilies", []);

const FAMILY_ICONS: Record<string, string> = {
  ZoneResidential: "Media/Game/Icons/ZoneResidential.svg",
  ZoneCommercial: "Media/Game/Icons/ZoneCommercial.svg",
  ZoneIndustrial: "Media/Game/Icons/ZoneIndustrial.svg",
  ZoneOffice: "Media/Game/Icons/ZoneOffice.svg",
  ZoneExtractors: "Media/Game/Icons/ZoneExtractors.svg",
};

/**
 * Browses zones by family and density, and hands assignment to the Zone tool.
 *
 * The lens owns the hierarchy; `toolbar.selectAsset` does the placing, so there
 * is no second placement implementation here.
 */
export const ZoningHierarchyComponent = () => {
  const { translate } = useLocalization();
  const zones = useValue(ZoneCatalog$);
  const selectedFamilies = useValue(ZoneFamilies$) ?? [];
  const all = buildZoningHierarchy(zones);
  // Empty selects everything: a filter nobody has touched should hide nothing.
  const hierarchy = selectedFamilies.length === 0
    ? all
    : all.filter((group) => selectedFamilies.includes(group.id));
  // A cap, not a height. This used to set both, which is why 24 zone tiles
  // filling 201px still held a 510px panel open with 43% of it empty. The
  // collapse this was guarding against came from `.tiers` being flex: 1 1 0
  // inside an auto-height column; now that the tier list sizes to its content,
  // the cap alone is enough.
  const maxHeight = getBuildingLensCatalogMaxHeight(
    typeof window === "undefined" ? 720 : window.innerHeight
  );

  if (hierarchy.length === 0) {
    return (
      <div className={styles.empty}>
        {translate("Tooltip.LABEL[FindItBuildingMenu.NoZonesIndexed]", "No zones indexed") ?? "No zones indexed"}
      </div>
    );
  }

  const assign = (zone: ZoneEntry) => {
    const command = selectZoneCommand(zone);
    trigger(command.group, command.method, ...command.args);
  };

  return (
    <div
      className={styles.zoning}
      style={{ maxHeight: `${maxHeight}rem` }}
    >
      {/* The family tab strip is gone. It cost a permanent row to express one
          value, and it was the worst case for an exclusive control: office
          zones are AreaType.Industrial carrying a flag, and density cuts across
          all four families, so "pick exactly one of R/C/I/O" asserted a
          partition the data does not have. Families are chips now, they
          compose, and with none selected every family is on screen. */}
      <Scrollable className={styles.tiers} vertical trackVisibility="scrollable">
        {hierarchy.map((group) => (
          <div className={styles.family} key={group.id}>
            {/* Only when more than one is showing: a single heading over the
                only family present is a label with nothing to distinguish. */}
            {hierarchy.length > 1 && (
              <div className={styles.familyLabel}>
                <img className={styles.familyIcon} src={FAMILY_ICONS[group.id] ?? ""} alt="" aria-hidden="true" />
                {translate(`Tooltip.LABEL[FindItBuildingMenu.Zoning_${group.id}]`, group.id) ?? group.id}
              </div>
            )}
            {group.densities.map((tier) => {
              // "Any" is not a tier — it is the absence of one — so it gets its
              // own heading rather than being labelled as a density.
              // Deliberately not the Zone<density> keys: those read '"Low"
              // Buildings' because they label buildings of a density, and this
              // labels the zones themselves.
              const heading = tier.density === "Any"
                ? translate("Tooltip.LABEL[FindItBuildingMenu.ZoneNoDensity]", "No density tier") ?? "No density tier"
                : translate(`Tooltip.LABEL[FindItBuildingMenu.ZoneTier${tier.density}]`, tier.density) ?? tier.density;

              return (
                <div className={styles.tier} key={tier.density}>
                  <div className={styles.tierLabel}>{heading}</div>
                  <div className={styles.zones}>
                    {tier.zones.map((zone) => (
                      <Button
                        key={zone.id}
                        className={styles.zone}
                        variant="icon"
                        onSelect={() => assign(zone)}
                        aria-label={zone.name}
                        title={zone.name}
                      >
                        {zone.thumbnail ? <img className={styles.zoneIcon} src={zone.thumbnail} alt="" /> : null}
                        <span className={styles.zoneName}>{zone.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Scrollable>
    </div>
  );
};
