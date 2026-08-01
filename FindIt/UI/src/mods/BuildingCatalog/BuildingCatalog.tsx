import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
import classNames from "classnames";
import mod from "../../../mod.json";
import { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  getBuildingLensDensity,
  getBuildingLensMetricLabel,
} from "domain/buildingLensLayout";
import type { BuildingLensDensityTier, BuildingLensMetric } from "domain/buildingLensLayout";
import {
  MAX_COMPARE_ENTRIES,
  nextSortState,
  normalizeCatalogOffset,
  removeCompareEntry,
  setCatalogOffsetCommand,
  setBuildingCapacityFloorCommand,
  setSortColumnCommand,
  setSortDescendingCommand,
  toggleCompareEntry,
} from "domain/buildingCatalogContracts";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { findItSurfacePort } from "domain/findItSurfacePort";
import styles from "./buildingCatalog.module.scss";

const BuildingCatalog$ = bindValue<BuildingCatalogPage>(mod.id, "BuildingCatalog");
const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth");
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
const BuildingCapacityFilterVisible$ = bindValue<boolean>(mod.id, "BuildingCapacityFilterVisible");
const BuildingCapacityFloor$ = bindValue<number>(mod.id, "BuildingCapacityFloor");

const educationCapacityPresets = [0, 100, 500, 1000];

const sortColumns: Array<{ key: SortColumn; label: string }> = [
  { key: "Name", label: "Name" },
  { key: "Category", label: "Category" },
  { key: "ConstructionCost", label: "Cost" },
  { key: "Upkeep", label: "Upkeep" },
  { key: "Workers", label: "Workers" },
  { key: "Capacity", label: "Capacity" },
  { key: "LotWidth", label: "Width" },
  { key: "LotDepth", label: "Depth" },
  { key: "BuildingLevel", label: "Level" },
  { key: "HasParking", label: "Parking" },
];

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

const densityClassNames: Record<BuildingLensDensityTier, string> = {
  compact: styles.densityCompact,
  default: styles.densityDefault,
  expanded: styles.densityExpanded,
};

function formatMetric(value: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export const BuildingCatalogComponent = () => {
  const { translate } = useLocalization();
  const page = useValue(BuildingCatalog$);
  const panelWidth = useValue(PanelWidth$);
  const currentSearch = useValue(CurrentSearch$);
  const capacityFilterVisible = useValue(BuildingCapacityFilterVisible$);
  const capacityFloor = useValue(BuildingCapacityFloor$);
  const [sortColumn, setSortColumn] = useState<SortColumn>("Name");
  const [descending, setDescending] = useState(false);
  const [compareEntries, setCompareEntries] = useState<BuildingCatalogEntry[]>([]);

  const items = page?.items ?? [];
  const totalCount = page?.totalCount ?? 0;
  const offset = page?.offset ?? 0;
  const limit = page?.limit ?? 100;
  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + items.length < totalCount;
  const pageNumber = Math.floor(offset / Math.max(1, limit)) + 1;
  const density = getBuildingLensDensity(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH);

  function activate(entry: BuildingCatalogEntry): void {
    // Keep the existing FindIt placement path: the backend resolves this id
    // through its single prefab index and activates the normal prefab tool.
    findItSurfacePort.activatePrefab({ prefabId: entry.id });
  }

  function toggleCompare(entry: BuildingCatalogEntry): void {
    setCompareEntries((current) => toggleCompareEntry(current, entry));
  }

  function removeCompare(id: number): void {
    setCompareEntries((current) => removeCompareEntry(current, id));
  }

  function setSort(column: SortColumn): void {
    const next = nextSortState({ column: sortColumn, descending }, column);

    setSortColumn(next.column);
    setDescending(next.descending);
    for (const command of [setSortColumnCommand(next.column), setSortDescendingCommand(next.descending), setCatalogOffsetCommand(0)]) {
      trigger(mod.id, command.method, ...command.args);
    }
  }

  function setPage(nextOffset: number): void {
    const command = setCatalogOffsetCommand(normalizeCatalogOffset(nextOffset, totalCount, limit));
    trigger(mod.id, command.method, ...command.args);
  }

  return (
    <div className={classNames(styles.catalog, densityClassNames[density])} data-density={density}>
      <div className={styles.heading}>
        <div>
          <div className={styles.title}>{translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLens]", "Building lens")}</div>
          <div className={styles.subtitle}>
            {currentSearch?.trim()
              ? translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLensSearchResults]", "Results for {0}")?.replace("{0}", currentSearch)
              : translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLensDescription]", "Buildings from the FindIt index")}
          </div>
        </div>
        <div className={styles.count}>{totalCount.toLocaleString()}</div>
      </div>

      <div className={styles.sortBar}>
        <span className={styles.sortLabel}>{translate("Tooltip.LABEL[FindItBuildingMenu.SortBy]", "Sort by")}</span>
        {sortColumns.map((column) => (
          <Button
            key={column.key}
            className={classNames(styles.sortButton, column.key === sortColumn && styles.sortButtonSelected)}
            variant="icon"
            onSelect={() => setSort(column.key)}
          >
            <span>{column.label}</span>
            {column.key === sortColumn && <span className={styles.sortDirection}>{descending ? "▼" : "▲"}</span>}
          </Button>
        ))}
      </div>

      {capacityFilterVisible && (
        <div className={styles.capacityFilter}>
          <span className={styles.capacityFilterLabel}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.EducationCapacityFilter]", "Education capacity")}
          </span>
          {educationCapacityPresets.map((floor) => (
            <Button
              key={floor}
              className={classNames(styles.capacityButton, floor === capacityFloor && styles.capacityButtonSelected)}
              variant="icon"
              onSelect={() => {
                const command = setBuildingCapacityFloorCommand(floor);
                trigger(mod.id, command.method, ...command.args);
              }}
            >
              {floor === 0 ? "Any" : `${floor}+`}
            </Button>
          ))}
        </div>
      )}

      {compareEntries.length > 0 && (
        <div className={styles.compare}>
          <div className={styles.compareHeading}>
            <span className={styles.compareTitle}>
              {translate("Tooltip.LABEL[FindItBuildingMenu.CompareBuildings]", "Compare buildings")}
              <span className={styles.compareCount}> {compareEntries.length} / {MAX_COMPARE_ENTRIES}</span>
            </span>
            <Button className={styles.clearCompare} variant="icon" onSelect={() => setCompareEntries([])}>
              {translate("Tooltip.LABEL[FindItBuildingMenu.ClearCompare]", "Clear")}
            </Button>
          </div>
          <div className={styles.compareRows}>
            {compareEntries.map((entry) => (
              <div className={styles.compareRow} key={entry.id}>
                <div className={styles.compareIdentity}>
                  <span className={styles.compareName}>{entry.name || entry.prefabName}</span>
                  <span className={styles.compareMetrics}>
                    Cost {formatMetric(entry.constructionCost)} · Upkeep {formatMetric(entry.upkeep)} · Workers {formatMetric(entry.workers)} · Capacity {formatMetric(entry.capacity)}
                  </span>
                </div>
                <Button className={styles.comparePlace} variant="icon" onSelect={() => activate(entry)}>
                  {translate("Tooltip.LABEL[FindItBuildingMenu.Place", "Place")}
                </Button>
                <Button className={styles.compareRemove} variant="icon" onSelect={() => removeCompare(entry.id)}>
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.columnHeader}>
        <span className={styles.identityHeader}>{translate("Tooltip.LABEL[FindItBuildingMenu.Building]", "Building")}</span>
        {metricColumns.map((column) => {
          const fullLabel = translate(column.localizationKey, column.fallback) ?? column.fallback;
          return (
            <span
              key={column.key}
              className={classNames(styles.metricHeader, styles[column.className])}
              title={fullLabel}
            >
              {getBuildingLensMetricLabel(column.key, density, fullLabel)}
            </span>
          );
        })}
      </div>

      <div className={styles.rows}>
        {items.length === 0 && (
          <div className={styles.empty}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.NoBuildings]", "No buildings match the current search and category.")}
          </div>
        )}
        {items.map((entry) => {
          const isCompared = compareEntries.some((candidate) => candidate.id === entry.id);

          return (
            <div key={entry.id} className={styles.row}>
              <Button className={styles.rowSelect} variant="icon" onSelect={() => activate(entry)}>
                <div className={styles.identityCell}>
                  <div className={styles.thumbnail}>
                    {entry.thumbnail && <img src={entry.thumbnail} />}
                  </div>
                  <div className={styles.identity}>
                    <div className={styles.name}>{entry.name || entry.prefabName}</div>
                    <div className={styles.category}>
                      {entry.category}
                      {entry.subCategory && ` · ${entry.subCategory}`}
                    </div>
                  </div>
                </div>
                <div className={classNames(styles.metric, styles.metricCost)} title={`Cost ${formatMetric(entry.constructionCost)}`}>
                  {formatMetric(entry.constructionCost)}
                </div>
                <div className={classNames(styles.metric, styles.metricUpkeep)} title={`Upkeep ${formatMetric(entry.upkeep)}`}>
                  {formatMetric(entry.upkeep)}
                </div>
                <div className={classNames(styles.metric, styles.metricWorkers)} title={`Workers ${formatMetric(entry.workers)}`}>
                  {formatMetric(entry.workers)}
                </div>
                <div className={classNames(styles.metric, styles.metricCapacity)} title={`Capacity ${formatMetric(entry.capacity)}`}>
                  {formatMetric(entry.capacity)}
                </div>
                <div className={classNames(styles.metric, styles.metricLot)} title="Lot dimensions">
                  {entry.lotWidth} × {entry.lotDepth}
                </div>
                <div className={classNames(styles.metric, styles.metricLevel)} title="Building level">
                  {entry.buildingLevel}
                </div>
                <div className={classNames(styles.parking, styles.metricParking, entry.hasParking && styles.parkingActive)} title={entry.hasParking ? "Parking" : "No parking"}>
                  {entry.hasParking ? "P" : "—"}
                </div>
              </Button>
              <Button
                className={classNames(styles.compareButton, isCompared && styles.compareButtonSelected)}
                variant="icon"
                disabled={!isCompared && compareEntries.length >= MAX_COMPARE_ENTRIES}
                onSelect={() => toggleCompare(entry)}
                title={isCompared ? "Remove from comparison" : "Add to comparison"}
              >
                {isCompared ? "✓" : "+"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className={styles.paging}>
        <Button
          className={styles.pageButton}
          variant="icon"
          disabled={!hasPreviousPage}
          onSelect={() => setPage(offset - limit)}
        >
          <span>‹</span>
        </Button>
        <span className={styles.pageLabel}>{pageNumber} / {Math.max(1, Math.ceil(totalCount / Math.max(1, limit)))}</span>
        <Button
          className={styles.pageButton}
          variant="icon"
          disabled={!hasNextPage}
          onSelect={() => setPage(offset + limit)}
        >
          <span>›</span>
        </Button>
      </div>
    </div>
  );
};
