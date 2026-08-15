import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
import classNames from "classnames";
import mod from "../../../mod.json";
import {
  clearBuildingLensFacetsCommand,
  facetGroupNeedsScroll,
  facetOptionMarker,
  hasScrollableFacetGroups,
  hasSelectedBuildingLensFacets,
  toggleBuildingLensFacetCommand,
  type BuildingLensFacetState,
} from "domain/buildingCatalogFacets";
import {
  LENS_DISCLOSURE_KEYS,
  getLensDisclosure,
  setLensDisclosure,
} from "domain/buildingLensViewState";
import styles from "./buildingCatalog.module.scss";

const BuildingLensFacets$ = bindValue<BuildingLensFacetState>(mod.id, "BuildingLensFacets");

export const BuildingCatalogFacetPanel = () => {
  const { translate } = useLocalization();
  const state = useValue(BuildingLensFacets$);
  // Survives the remount that closing/placing/toggling the lens causes, so an
  // open facet drawer is not silently collapsed over still-active filters.
  const [open, setOpenState] = useState(() => getLensDisclosure(LENS_DISCLOSURE_KEYS.facets));
  const setOpen = (next: boolean | ((current: boolean) => boolean)): void => {
    setOpenState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, value);
      return value;
    });
  };
  const active = hasSelectedBuildingLensFacets(state);
  const groups = state?.groups ?? [];
  const selectedCount = groups.reduce(
    (count, group) => count + group.options.filter((option) => option.selected).length,
    0
  );
  const scrollableGroups = groups.filter((group) => facetGroupNeedsScroll(group));
  const hasScrollableContent = hasScrollableFacetGroups(groups);

  return (
    <div className={styles.facetPanel} data-open={open}>
      <div className={styles.facetToolbar}>
        <Button className={classNames(styles.facetToggle, active && styles.facetToggleActive)} variant="icon" onSelect={() => setOpen((value) => !value)}>
          <span>{open ? "Hide filters" : "Filters"}</span>
          {active && <span className={styles.facetSelectionCount}>{selectedCount}</span>}
        </Button>
        {active && (
          <Button
            className={styles.facetClear}
            variant="icon"
            onSelect={() => trigger(mod.id, clearBuildingLensFacetsCommand().method)}
          >
            {translate("Tooltip.LABEL[FindItBuildingMenu.ClearLensFacets]", "Clear facets")}
          </Button>
        )}
        {open && hasScrollableContent && (
          <div className={styles.facetScrollHint} data-scroll-hint="true">
            <span className={styles.facetScrollGlyph} aria-hidden="true">↕</span>
            <span>
              Scroll for more filters
              {scrollableGroups.length > 1 ? ` (${scrollableGroups.length} groups)` : ""}
            </span>
          </div>
        )}
      </div>

      {open && (
        <div className={styles.facetGroups} data-scrollable={hasScrollableContent}>
          {groups.map((group) => (
            <div className={styles.facetGroup} key={group.id} data-facet-group={group.id} data-scrollable={facetGroupNeedsScroll(group)}>
              <div className={styles.facetGroupLabel}>
                <span>{group.label}</span>
                {facetGroupNeedsScroll(group) && <span className={styles.facetGroupScrollMark} aria-hidden="true">↕</span>}
              </div>
              <div className={styles.facetOptions} data-scrollable={facetGroupNeedsScroll(group)}>
                {group.options.map((option) => (
                  <Button
                    key={option.id}
                    className={classNames(styles.facetOption, option.selected && styles.facetOptionSelected)}
                    variant="icon"
                    title={option.label}
                    onSelect={() => {
                      const command = toggleBuildingLensFacetCommand(group.id, option.id);
                      trigger(mod.id, command.method, ...command.args);
                    }}
                  >
                    <span className={styles.facetOptionMarker} aria-hidden="true">{facetOptionMarker(option.selected)}</span>
                    <span className={styles.facetOptionLabel}>{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <span className={styles.facetEmpty}>
              {translate(
                "Tooltip.LABEL[FindItBuildingMenu.NoFacetsAvailable]",
                "No additional building facets are available."
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
