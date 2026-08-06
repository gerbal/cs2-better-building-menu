import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import mod from "../../../mod.json";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { getBuildingLensCatalogMaxHeight } from "domain/buildingLensLayout";
import { getLensChoice, setLensChoice } from "domain/buildingLensViewState";
import { useState } from "react";
import { getZoneFacts, getZoneFootprints, selectZoneCommand, sortZonesForDisplay, zoneAsCatalogEntry, type ZoneEntry } from "domain/zoningHierarchy";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import styles from "./zoningHierarchy.module.scss";

const ZoneCatalog$ = bindValue<ZoneEntry[]>(mod.id, "ZoneCatalog", []);
// Empty means every family. The selection lives in C# because the chip row
// renders it, and the chip row is not an ancestor of this component.
const ZoneFamilies$ = bindValue<string[]>(mod.id, "BuildingLensZoneFamilies", []);
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch", "");

// Shared with the catalog, so switching to Cards in one and opening the other
// does not land the player in a different presentation than the one they chose.
const LENS_VIEW_MODE_KEY = "viewMode";

/**
 * Browses zones, and hands assignment to the Zone tool.
 *
 * This used to hand-write family → density → tiles: its own markup, its own
 * spacing, no view modes, no sort, and a family tab strip. That is
 * group-by-family with a density sub-level rendered as a list — the same thing
 * the catalog does — so it now maps each zone onto a catalog entry and renders
 * through the shared grouped view. The divergence is deleted rather than
 * maintained.
 *
 * The lens still owns the hierarchy and never the placement:
 * `toolbar.selectAsset` does the placing, so there is no second placement
 * implementation here.
 */
export const ZoningHierarchyComponent = () => {
  const { translate } = useLocalization();
  const zones = useValue(ZoneCatalog$);
  const selectedFamilies = useValue(ZoneFamilies$) ?? [];
  const searchText = useValue(CurrentSearch$) ?? "";

  // Empty selects everything: a filter nobody has touched should hide nothing.
  // Sorted here because the grouped renderer preserves input order — it trusts
  // the query to have ordered things, and the zone catalog is published in
  // index order rather than in tier order.
  const visible = sortZonesForDisplay(zones).filter(
    (zone) => selectedFamilies.length === 0 || selectedFamilies.includes(zone.family)
  );

  // Family names are ids ("ZoneResidential"); the catalog's headings come
  // straight from the entry, so the label is resolved here before mapping.
  const entries = visible.map((zone) => ({
    ...zoneAsCatalogEntry(zone),
    category: familyLabel(zone.family),
    categoryLabel: familyLabel(zone.family),
    subCategory: densityLabel(zone.density),
    subCategoryLabel: densityLabel(zone.density),
    // What the game measured about this zone and never showed anyone. The
    // renderer takes these verbatim, so they are translated here.
    facts: getZoneFacts(zone).map(factLabel),
    // The shapes themselves, for the tooltip to draw. A range says roughly
    // what fits; these say exactly which shapes do.
    footprints: getZoneFootprints(zone),
    footprintOverflow: zone.footprintOverflow ?? 0,
  })) as unknown as BuildingCatalogEntry[];

  function factLabel(fact: { kind: string; value: string | number }): string {
    switch (fact.kind) {
      case "lots":
        return (translate("Tooltip.LABEL[FindItBuildingMenu.ZoneLots]", "fits {0}") ?? "fits {0}")
          .replace("{0}", String(fact.value));
      case "height":
        return (translate("Tooltip.LABEL[FindItBuildingMenu.ZoneMaxHeight]", "up to {0}m") ?? "up to {0}m")
          .replace("{0}", String(fact.value));
      case "narrow":
        return translate("Tooltip.LABEL[FindItBuildingMenu.ZoneNarrowLots]", "narrow lots") ?? "narrow lots";
      case "corners":
        return translate("Tooltip.LABEL[FindItBuildingMenu.ZoneCorners]", "corners") ?? "corners";
      case "sold":
        return (translate("Tooltip.LABEL[FindItBuildingMenu.ZoneSells]", "sells {0}") ?? "sells {0}")
          .replace("{0}", String(fact.value));
      case "manufactured":
        return (translate("Tooltip.LABEL[FindItBuildingMenu.ZoneMakes]", "makes {0}") ?? "makes {0}")
          .replace("{0}", String(fact.value));
      default:
        return (translate("Tooltip.LABEL[FindItBuildingMenu.ZoneStores]", "stores {0}") ?? "stores {0}")
          .replace("{0}", String(fact.value));
    }
  }

  function familyLabel(family: string): string {
    return translate(`Tooltip.LABEL[FindItBuildingMenu.Zoning_${family}]`, family) ?? family;
  }

  function densityLabel(density: string): string {
    // "Any" is not a tier — it is the absence of one — so it gets its own
    // heading rather than being labelled as a density. Deliberately not the
    // Zone<density> keys: those read '"Low" Buildings' because they label
    // buildings of a density, and this labels the zones themselves.
    return density === "Any"
      ? translate("Tooltip.LABEL[FindItBuildingMenu.ZoneNoDensity]", "No density tier") ?? "No density tier"
      : translate(`Tooltip.LABEL[FindItBuildingMenu.ZoneTier${density}]`, density) ?? density;
  }

  // List by default — zones are chosen by name and their thumbnails are
  // near-identical coloured squares — but the choice is the player's and is
  // shared with the catalog, so switching in one holds in the other.
  const [viewMode, setViewModeState] = useState<CatalogViewMode>(() => {
    const stored = getLensChoice(LENS_VIEW_MODE_KEY, "list") as CatalogViewMode;
    return stored === "table" ? "list" : stored;
  });

  const setViewMode = (next: CatalogViewMode) => {
    setLensChoice(LENS_VIEW_MODE_KEY, next);
    setViewModeState(next);
  };

  const maxHeight = getBuildingLensCatalogMaxHeight(
    typeof window === "undefined" ? 720 : window.innerHeight
  );

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        {translate("Tooltip.LABEL[FindItBuildingMenu.NoZonesIndexed]", "No zones indexed") ?? "No zones indexed"}
      </div>
    );
  }

  const assign = (entry: BuildingCatalogEntry): void => {
    const command = selectZoneCommand(entry as unknown as { id: number; version: number });
    trigger(command.group, command.method, ...command.args);
  };

  return (
    <div className={styles.zoning} style={{ maxHeight: `${maxHeight}rem` }}>
      {/* The same toolbar the catalog has. Zoning previously inherited whatever
          view mode the catalog was last set to and offered no way to change it
          from where the player was standing — the same results deserve the same
          affordances however you arrived at them. */}
      <div className={styles.toolbar}>
        <div className={styles.title}>
          {translate("Tooltip.LABEL[FindItBuildingMenu.Zones]", "Zones") ?? "Zones"}
        </div>
        <div className={styles.count}>{entries.length.toLocaleString()}</div>
        <div className={styles.toolbarSpacer} />
        {/* Table is omitted rather than disabled: its columns are building
            metrics — cost, workers, capacity — that a zone does not have. */}
        <ViewModeBar value={viewMode} onChange={setViewMode} omit={["table"]} />
      </div>

      <GroupedResults
        entries={entries}
        // Family then density, which is the hierarchy this view always had —
        // now expressed as a grouping rather than as bespoke markup.
        groupBy="category"
        // List by default — zones are chosen by name and their thumbnails are
        // near-identical coloured squares — but Cards is honoured, because a
        // zone now has facts worth a card: how tall it grows, what lot sizes it
        // fills, what it trades in. An earlier comment here said none of the
        // card's facts applied, which was true when it was written and stopped
        // being true the moment those facts existed.
        //
        // Table still falls back: there is no zone table, and its columns are
        // all building metrics a zone does not have.
        viewMode={viewMode}
        searchText={searchText}
        onPlace={assign}
      />
    </div>
  );
};
