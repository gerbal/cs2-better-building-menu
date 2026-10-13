import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Button } from "cs2/ui";
import classNames from "classnames";
import { memo, type ReactNode } from "react";

import type { ControlKind } from "domain/topRow";
import { CurrentSearch$ } from "mods/bindings";
import { FilterChips, FilterPanel, useFilterChips } from "mods/Pickers/FilterPanel";
import { GroupList, useGroupOptions } from "mods/Pickers/GroupList";
import { SortList, useSortOptions } from "mods/Pickers/SortList";
import { ViewList, useViewOptions } from "mods/Pickers/ViewList";
import { useLookRoot } from "mods/useLookRoot";
import styles from "./controlPane.module.scss";

/** A labelled row whose summary opens a list upward over the pane: the list the top row's popover shows. */
const PickerSummary = ({ label, value, open, onToggle, children }: { label: string; value: string; open: boolean; onToggle: () => void; children: ReactNode }) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{label}</span>
    <div className={styles.rowValue}>
      <div className={styles.picker}>
        <Button className={styles.pickerSummary} variant="icon" onSelect={onToggle} aria-expanded={open} aria-label={`${label} · ${value}`}>
          <span className={styles.pickerLabel}>{value}</span>
          {/* U+25BC, not the small U+25BE: the game's font stack has no small
              triangles, so the one mark saying this control opens would be the
              one glyph that would not render. */}
          <span className={styles.caret} aria-hidden="true">▼</span>
        </Button>
        {open && <div className={styles.pickerOptions}>{children}</div>}
      </div>
    </div>
  </div>
);

export interface ControlPaneProps {
  /** Which of the pane's lists is open, while the one open list is here. */
  open: ControlKind | null;
  /** A press on a summary: the box keeps one list open across the pane and the top row. */
  onToggle: (kind: ControlKind) => void;
  onClose: () => void;
}

/**
 * The control pane, an option: a column to the right of the build menu, mirroring vanilla's
 * tool-options column, with Filters, Group by, Sort by and View again. Its lists are the top row's,
 * so the two homes cannot disagree, and its root carries the look, so their tokens resolve beside
 * the box.
 */
export const ControlPane = memo(function ControlPane({ open, onToggle, onClose }: ControlPaneProps) {
  const { translate } = useLocalization();
  const look = useLookRoot();
  const sort = useSortOptions();
  const group = useGroupOptions();
  const view = useViewOptions();
  const chips = useFilterChips();
  const currentSearch = useValue(CurrentSearch$);
  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  return (
    <div className={classNames(styles.pane, look.className)} style={look.style}>
      {/* No standing result count here: each grouping heading carries its own,
          and the load-more row says when there is more. */}

      {/* Only while a search is active. The search field is in the asset menu and
          this is the far side of the screen, so naming the query here is the
          one caption that does not restate something already in view. */}
      {currentSearch?.trim() && (
        <div className={styles.searchContext}>
          {label("Tooltip.LABEL[BetterBuildingMenu.AssetMenuSearchResults]", "Results for {0}").replace("{0}", currentSearch)}
        </div>
      )}

      {/* The narrowing controls sit beside the results they narrow, not in the
          game's options bank at the screen edge. Vanilla's own Theme stays
          there, being the game's control, so filters do sit on both sides. */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>{label("Tooltip.LABEL[BetterBuildingMenu.Filters]", "Filters")}</span>
        <div className={styles.rowValue}>
          <FilterPanel chips={false} />
        </div>
      </div>

      {/* The record of what the filters did, beside them: apart, each half
          explains the other from across the screen. */}
      {chips.length > 0 && (
        <div className={classNames(styles.row, styles.rowChips)}>
          <span className={styles.rowLabel}>{label("Tooltip.LABEL[BetterBuildingMenu.ActiveFilters]", "Active")}</span>
          <div className={styles.rowValue}>
            <FilterChips onBody />
          </div>
        </div>
      )}

      {/* The two controls that reorder rows, in the order they apply: the grouping key first,
          then the sort within each group, its direction beside its name. */}
      <PickerSummary
        label={label("Tooltip.LABEL[BetterBuildingMenu.GroupBy]", "Group by")}
        value={group.current}
        open={open === "group"}
        onToggle={() => onToggle("group")}
      >
        <GroupList onPicked={onClose} />
      </PickerSummary>
      <PickerSummary
        label={label("Tooltip.LABEL[BetterBuildingMenu.SortBy]", "Sort by")}
        value={sort.indicator === "" ? sort.current : `${sort.current} ${sort.indicator}`}
        open={open === "sort"}
        onToggle={() => onToggle("sort")}
      >
        <SortList onPicked={onClose} />
      </PickerSummary>
      <PickerSummary
        label={label("Tooltip.LABEL[BetterBuildingMenu.ViewMode]", "View")}
        value={view.current}
        open={open === "view"}
        onToggle={() => onToggle("view")}
      >
        <ViewList onPicked={onClose} />
      </PickerSummary>
    </div>
  );
});
