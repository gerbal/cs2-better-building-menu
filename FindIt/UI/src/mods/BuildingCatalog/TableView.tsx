import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import type { CSSProperties, ReactNode } from "react";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { getBuildingLensMetricLabel } from "domain/buildingLensLayout";
import type { BuildingLensDensityTier, BuildingLensMetric } from "domain/buildingLensLayout";
import { getNumberSeparators } from "domain/buildingLensMetricFormat";
import {
  BUILDING_LENS_COLUMN_SORT,
  getBuildingLensColumnSortIndicator,
} from "domain/buildingLensSortPresentation";
import { flattenGroupedRows } from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { TableRow, type TableRowLabels } from "./TableRow";
import styles from "./buildingCatalog.module.scss";

const metricColumns: Array<{
  key: BuildingLensMetric;
  localizationKey: string;
  fallback: string;
  className: string;
}> = [
  { key: "cost", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Cost]", fallback: "Cost", className: "metricCost" },
  { key: "upkeep", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Upkeep]", fallback: "Upkeep", className: "metricUpkeep" },
  { key: "workers", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Workers]", fallback: "Workers", className: "metricWorkers" },
  { key: "capacity", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Capacity]", fallback: "Capacity", className: "metricCapacity" },
  { key: "lot", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Lot]", fallback: "Lot", className: "metricLot" },
  { key: "level", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Level]", fallback: "Level", className: "metricLevel" },
  { key: "parking", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Parking]", fallback: "Parking", className: "metricParking" },
];

export interface TableViewProps {
  items: BuildingCatalogEntry[];
  /** What to draw when there are no rows: the indexing notice, the scope notice, or the empty message. */
  emptyState: ReactNode;
  density: BuildingLensDensityTier;
  /** The width of one metric column; the header and every row read the same numbers. */
  columnStyle(metric: BuildingLensMetric): CSSProperties;
  nameBudget: number;
  resolveFacetLabel(groupId: string, value: string): string | null;
  sortColumn: SortColumn;
  descending: boolean;
  onSort(column: SortColumn): void;
  expandedId: number | null;
  onToggleExpanded(id: number): void;
  onPlace(entry: BuildingCatalogEntry): void;
  /** The end of the feed, rendered as the last child inside the scroll. */
  footer: ReactNode;
}

/**
 * Table view: a fixed column header over a scrolling list of group headings
 * and rows.
 *
 * The one view that could not use GroupedResults: it draws its own rows
 * against a shared column geometry, and wrapping each group in its own
 * scrolling section would break the column alignment the whole surface
 * depends on. So group headings are interleaved into one flat list
 * (flattenGroupedRows) and the rows keep a single flex column geometry.
 */
export const TableView = ({
  items,
  emptyState,
  density,
  columnStyle,
  nameBudget,
  resolveFacetLabel,
  sortColumn,
  descending,
  onSort,
  expandedId,
  onToggleExpanded,
  onPlace,
  footer,
}: TableViewProps) => {
  const { translate } = useLocalization();
  // The player's own thousands/decimal marks, so our columns agree with the
  // numbers the game is drawing elsewhere on the same screen.
  const separators = getNumberSeparators(translate);
  const labels: TableRowLabels = {
    place: translate("Tooltip.LABEL[FindItBuildingMenu.Place]", "Place") ?? "Place",
    inspect: translate("Tooltip.LABEL[FindItBuildingMenu.Inspect]", "Details") ?? "Details",
    locked: translate("Tooltip.LABEL[FindItBuildingMenu.Locked]", "Locked") ?? "Locked",
    built:
      translate("Toolbar.ASSET_ALREADY_BUILT", "")
      || translate("Tooltip.LABEL[FindItBuildingMenu.AlreadyBuilt]", "Already built")
      || "Already built",
  };

  return (
    <>
      {/* The rows scroll and this header does not, so the scrollbar narrows
          them and would leave every value sitting left of its heading. The
          gutter is reserved unconditionally: it used to be reserved only when
          total > rendered, a has-more-pages test doing duty as a
          will-this-overflow test — under a growing window that flips false
          exactly when the list is longest. A few rem of padding cannot
          desync. */}
      <div className={styles.columnHeader} data-rows-scrollable="true">
        {/* "Name", not "Building". The sort control offers a field called
            Name and sorting by it reorders THIS column, so two names for one
            field made the chip look like it acted on something else. The
            column also holds roads, props and zones, none of which are
            buildings. */}
        <span className={styles.identityHeader}>{translate("Tooltip.LABEL[FindItBuildingMenu.Name]", "Name")}</span>
        {metricColumns.map((column) => {
          const fullLabel = translate(column.localizationKey, column.fallback) ?? column.fallback;
          const indicator = getBuildingLensColumnSortIndicator(column.key, { column: sortColumn, descending });
          const sortTarget = BUILDING_LENS_COLUMN_SORT[column.key];
          const headerTitle = indicator === ""
            ? `${fullLabel} — ${translate("Tooltip.LABEL[FindItBuildingMenu.SortByColumn]", "sort by this column") ?? "sort by this column"}`
            : `${fullLabel} — ${translate("Tooltip.LABEL[FindItBuildingMenu.ReverseSort]", "reverse this sort") ?? "reverse this sort"}`;

          return (
            <Button
              key={column.key}
              className={classNames(styles.metricHeader, styles[column.className], indicator !== "" && styles.metricHeaderSorted)}
              style={columnStyle(column.key)}
              variant="icon"
              onSelect={() => onSort(sortTarget)}
              title={headerTitle}
              aria-label={headerTitle}
              data-sort-indicator={indicator}
            >
              {getBuildingLensMetricLabel(column.key, density, fullLabel)}
              {indicator !== "" && <span className={styles.metricHeaderIndicator} aria-hidden="true">{indicator}</span>}
            </Button>
          );
        })}
      </div>

      {/* No data-* marker on this one: cs2/ui's Scrollable drops props it
          does not know, so the attribute that used to be here never reached
          the DOM. The scroll container is found by walking up from a row,
          inside the catalog's root (catalogDom.ts). */}
      <Scrollable
        className={styles.rows}
        vertical
        trackVisibility="scrollable"
      >
        {items.length === 0 && emptyState}
        {flattenGroupedRows(items, (entry) => String(entry.id)).map((line) => {
          if (line.kind === "heading") {
            return (
              <div
                key={line.key}
                className={styles.tableGroupHeading}
                data-group-depth={line.depth}
              >
                <span className={styles.tableGroupLabel}>
                  {line.labelId === undefined
                    ? line.label
                    : resolveVanillaLabel(
                      vanillaCategoryNameKeys(line.labelId),
                      (key) => translate(key, null),
                      line.label
                    )}
                </span>
                <span className={styles.tableGroupCount}>{line.count}</span>
              </div>
            );
          }

          return (
            <TableRow
              key={line.entry.id}
              entry={line.entry}
              expanded={expandedId === line.entry.id}
              nameBudget={nameBudget}
              separators={separators}
              labels={labels}
              columnStyle={columnStyle}
              resolveFacetLabel={resolveFacetLabel}
              onPlace={onPlace}
              onToggleExpanded={onToggleExpanded}
            />
          );
        })}
        {footer}
      </Scrollable>
    </>
  );
};
