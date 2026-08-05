import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
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
  const hierarchy = buildZoningHierarchy(zones);
  const [family, setFamily] = useState<string | null>(null);
  // The container sizes this panel from its child, exactly as it does for the
  // catalog. Without an explicit height the hierarchy collapses to its first
  // row and everything below the family tabs is clipped.
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

  // Default to the first family that actually has zones rather than assuming
  // Residential is present: which zones exist depends on DLC and packs.
  const activeFamily = family ?? hierarchy[0].id;
  const active = hierarchy.find((group) => group.id === activeFamily) ?? hierarchy[0];

  const assign = (zone: ZoneEntry) => {
    const command = selectZoneCommand(zone);
    trigger(command.group, command.method, ...command.args);
  };

  return (
    <div
      className={styles.zoning}
      style={{ height: `${maxHeight}rem`, maxHeight: `${maxHeight}rem` }}
    >
      <div className={styles.families}>
        {hierarchy.map((group) => {
          const label = translate(`Tooltip.LABEL[FindItBuildingMenu.Zoning_${group.id}]`, group.id) ?? group.id;

          return (
            <Button
              key={group.id}
              className={classNames(styles.family, group.id === active.id && styles.familySelected)}
              variant="icon"
              onSelect={() => setFamily(group.id)}
              aria-label={label}
              title={label}
            >
              <img className={styles.familyIcon} src={FAMILY_ICONS[group.id] ?? ""} alt="" />
            </Button>
          );
        })}
      </div>

      <Scrollable className={styles.tiers} vertical trackVisibility="scrollable">
        {active.densities.map((tier) => {
          // "Any" is not a tier — it is the absence of one — so it gets its own
          // heading rather than being labelled as a density.
          const heading = tier.density === "Any"
            ? translate("Tooltip.LABEL[FindItBuildingMenu.ZoneNoDensity]", "No density tier") ?? "No density tier"
            : translate(`Tooltip.LABEL[FindItBuildingMenu.Zone${tier.density}]`, tier.density) ?? tier.density;

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
      </Scrollable>
    </div>
  );
};
