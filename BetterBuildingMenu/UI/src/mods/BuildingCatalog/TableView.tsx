import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { getAssetMenuMetricLabel } from "domain/assetMenuLayout";
import type { AssetMenuDensityTier, AssetMenuMetric } from "domain/assetMenuLayout";
import { getNumberSeparators } from "domain/assetMenuMetricFormat";
import {
  ASSET_MENU_COLUMN_SORT,
  getAssetMenuColumnSortIndicator,
} from "domain/assetMenuSortPresentation";
import { flattenGroupedRows } from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { useUnitSystem } from "domain/unitSettings";
import { useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { TableRow, type TableRowLabels } from "./TableRow";
import styles from "./buildingCatalog.module.scss";

const metricColumns: Array<{
  key: AssetMenuMetric;
  localizationKey: string;
  fallback: string;
  className: string;
}> = [
  { key: "cost", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Cost]", fallback: "Cost", className: "metricCost" },
  { key: "upkeep", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Upkeep]", fallback: "Upkeep", className: "metricUpkeep" },
  { key: "workers", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Workers]", fallback: "Workers", className: "metricWorkers" },
  { key: "capacity", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Capacity]", fallback: "Capacity", className: "metricCapacity" },
  { key: "lot", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Lot]", fallback: "Lot", className: "metricLot" },
  { key: "level", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Level]", fallback: "Level", className: "metricLevel" },
  { key: "parking", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Parking]", fallback: "Parking", className: "metricParking" },
];

export interface TableViewProps {
  items: BuildingCatalogEntry[];
  /** What to draw when there are no rows: the indexing notice, the scope notice, or the empty message. */
  emptyState: ReactNode;
  density: AssetMenuDensityTier;
  /** The metric columns to draw, in order: a narrow build menu drops some (visibleTableMetrics). */
  metrics: readonly AssetMenuMetric[];
  /** The width of one metric column; the header and every row read the same numbers. */
  columnStyle(metric: AssetMenuMetric): CSSProperties;
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
 * Table view: a fixed column header over a scrolling list of group headings and
 * rows. The one view that cannot use GroupedResults — a scrolling section per
 * group breaks the shared column geometry — so flattenGroupedRows interleaves.
 */
export const TableView = ({
  items,
  emptyState,
  density,
  metrics,
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
  const unitSystem = useUnitSystem();
  // Read once for every row, which is what the hook asks of its caller.
  const hoverCard = useHoverCardContext();
  // The player's own thousands/decimal marks, so our columns agree with the
  // numbers the game is drawing elsewhere on the same screen. Memoised, with
  // the labels, so the rows' props hold still between renders.
  const separators = useMemo(() => getNumberSeparators(translate, unitSystem), [translate, unitSystem]);
  const labels: TableRowLabels = useMemo(() => ({
    place: translate("Tooltip.LABEL[BetterBuildingMenu.Place]", "Place") ?? "Place",
    inspect: translate("Tooltip.LABEL[BetterBuildingMenu.Inspect]", "Details") ?? "Details",
    locked: translate("Tooltip.LABEL[BetterBuildingMenu.Locked]", "Locked") ?? "Locked",
    built:
      translate("Toolbar.ASSET_ALREADY_BUILT", "")
      || translate("Tooltip.LABEL[BetterBuildingMenu.AlreadyBuilt]", "Already built")
      || "Already built",
  }), [translate]);

  return (
    <>
      {/* The rows scroll and this header does not, so the scrollbar would
          leave every value sitting left of its heading. The gutter is reserved
          unconditionally, because a few rem of padding cannot desync while a
          has-more test standing in for a will-this-overflow test can. */}
      <div className={styles.columnHeader} data-rows-scrollable="true">
        {/* "Name", not "Building": the sort control offers a field called
            Name and sorting by it reorders THIS column, and the column holds
            roads, props and zones, none of which are buildings. */}
        <span className={styles.identityHeader}>{translate("Tooltip.LABEL[BetterBuildingMenu.Name]", "Name")}</span>
        {metricColumns.filter((column) => metrics.includes(column.key)).map((column) => {
          const fullLabel = translate(column.localizationKey, column.fallback) ?? column.fallback;
          const indicator = getAssetMenuColumnSortIndicator(column.key, { column: sortColumn, descending });
          const sortTarget = ASSET_MENU_COLUMN_SORT[column.key];
          const headerTitle = indicator === ""
            ? `${fullLabel} — ${translate("Tooltip.LABEL[BetterBuildingMenu.SortByColumn]", "sort by this column") ?? "sort by this column"}`
            : `${fullLabel} — ${translate("Tooltip.LABEL[BetterBuildingMenu.ReverseSort]", "reverse this sort") ?? "reverse this sort"}`;

          return (
            <Button
              key={column.key}
              className={classNames(styles.metricHeader, styles[column.className], indicator !== "" && styles.metricHeaderSorted)}
              style={columnStyle(column.key)}
              data-metric={column.key}
              variant="icon"
              onSelect={() => onSort(sortTarget)}
              title={headerTitle}
              aria-label={headerTitle}
              data-sort-indicator={indicator}
            >
              {getAssetMenuMetricLabel(column.key, density, fullLabel)}
              {indicator !== "" && <span className={styles.metricHeaderIndicator} aria-hidden="true">{indicator}</span>}
            </Button>
          );
        })}
      </div>

      {/* No data-* marker on this one: cs2/ui's Scrollable drops props it does
          not know, so it would never reach the DOM. The scroll container is
          found by walking up from a row instead — see catalogDom.ts. */}
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
              hoverCard={hoverCard}
              metrics={metrics}
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
