import { useLocalization } from "cs2/l10n";

import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { useUnitSystem } from "domain/unitSettings";
import {
  getBuildingDetailMetrics,
  getNumberSeparators,
} from "domain/buildingLensMetricFormat";
import {
  getBuildingExtensionLabels,
  getBuildingFlagGroups,
  getBuildingProvenanceChips,
  resolveAssetDescription,
} from "domain/buildingLensRowDetails";

import styles from "./buildingCatalog.module.scss";

interface BuildingResultDetailsProps {
  entry: BuildingCatalogEntry;
  /** Turns a raw facet value into the label its filter chip shows. */
  resolveFacetLabel: (groupId: string, value: string) => string | null;
}

/**
 * Everything the indexer knows about one result, ready to draw under it.
 *
 * Extracted from the table, which was the only view that could show any of it
 * (cm-0lom). The list and cards now open the same block, so a building tells
 * you the same things wherever you happen to be looking at it — the same
 * argument the hover card already settled for hover.
 *
 * It computes rather than receives: a caller passes an entry and gets a block.
 * The table used to derive all four of these inline and pass nothing, which is
 * why nothing else could reuse it.
 */
export const BuildingResultDetails = ({ entry, resolveFacetLabel }: BuildingResultDetailsProps) => {
  const { translate } = useLocalization();
  const separators = getNumberSeparators(translate, useUnitSystem());

  const detailMetrics = getBuildingDetailMetrics(entry, separators);
  const flagGroups = getBuildingFlagGroups(entry.placementFlags);
  const extensionLabels = getBuildingExtensionLabels(entry.supportedUpgrades);
  const provenanceChips = getBuildingProvenanceChips(entry, resolveFacetLabel);
  const description = resolveAssetDescription(entry.prefabName, translate);
  const upgradesLabel = translate("Tooltip.LABEL[BetterBuildingMenu.Upgrades]", "Upgrades") ?? "Upgrades";
  const noDetailsLabel = translate(
    "Tooltip.LABEL[BetterBuildingMenu.NoDetailMetrics]",
    "No further data for this building",
  ) ?? "No further data for this building";

  return (
    <div className={styles.rowDetails}>
      {/* The game's own copy for this prefab. Free: the entry already carries
          prefabName and the game keys descriptions by it. */}
      {description && <div className={styles.rowDescription}>{description}</div>}

      <div className={styles.rowDetailMetrics}>
        {detailMetrics.length === 0 ? (
          <span className={styles.rowDetailEmpty}>{noDetailsLabel}</span>
        ) : (
          detailMetrics.map((detail) => (
            <span className={styles.rowDetail} key={detail.key}>
              <span className={styles.rowDetailLabel}>{detail.label}</span>
              <span className={styles.rowDetailValue}>{detail.value}</span>
            </span>
          ))
        )}
      </div>

      {flagGroups.map((group) => (
        <div className={styles.rowFlagGroup} key={group.id} data-flag-group={group.id}>
          <span className={styles.rowDetailLabel}>{group.label}</span>
          {group.values.map((value) => (
            <span className={styles.rowFlag} key={value}>{value}</span>
          ))}
        </div>
      ))}

      {extensionLabels.length > 0 && (
        <div className={styles.rowFlagGroup} data-flag-group="extensions">
          <span className={styles.rowDetailLabel}>{upgradesLabel}</span>
          {extensionLabels.map((label) => (
            <span className={styles.rowFlag} key={label}>{label}</span>
          ))}
        </div>
      )}

      {provenanceChips.length > 0 && (
        <div className={styles.rowFlagGroup} data-flag-group="provenance">
          {provenanceChips.map((chip) => (
            <span className={styles.rowProvenance} key={chip.label}>
              <span className={styles.rowDetailLabel}>{chip.label}</span>
              <span className={styles.rowDetailValue}>{chip.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
