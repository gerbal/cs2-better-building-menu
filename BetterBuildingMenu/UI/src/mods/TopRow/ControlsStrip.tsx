import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useRef } from "react";

import filterGlyph from "images/filter.svg";
import groupGlyph from "images/group.svg";
import sortGlyph from "images/sort.svg";
import viewGlyph from "images/view.svg";
import { isSortSet } from "domain/assetMenuSortPresentation";
import { removableChipCount } from "domain/filterChips";
import { menuPickOf } from "domain/menuPicks";
import { CONTROLS_MARK, type ControlCell, type ControlForm, type ControlKind } from "domain/topRow";
import { useFilterChips } from "mods/Pickers/FilterPanel";
import { useGroupOptions } from "mods/Pickers/GroupList";
import { useSortOptions } from "mods/Pickers/SortList";
import { useViewOptions } from "mods/Pickers/ViewList";
import { AssetMenu$, AssetMenuGroups$ } from "mods/bindings";
import styles from "./topRow.module.scss";

const GLYPHS: Readonly<Record<ControlKind, string>> = { sort: sortGlyph, filter: filterGlyph, group: groupGlyph, view: viewGlyph };

/** The filters on now: the chips the filter panel shows as removable. */
export function useActiveFilterCount(): number {
  return removableChipCount(useFilterChips());
}

/** The four controls as this menu has them: each one's word, its value, every value it can show here, and whether it is set. */
export function useControlCells(): ControlCell[] {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const sort = useSortOptions();
  const group = useGroupOptions();
  const view = useViewOptions();
  const filters = useActiveFilterCount();
  // A menu's own GROUP is the one set away from how it opens: its default takes the pick away.
  const groupPicked = menuPickOf(useValue(AssetMenuGroups$), useValue(AssetMenu$)) !== "";
  const none = label("Tooltip.LABEL[BetterBuildingMenu.FilterNone]", "None");
  const filtersOn = (count: number) => label("Tooltip.LABEL[BetterBuildingMenu.FiltersOn]", "{0} on").replace("{0}", String(count));

  return [
    {
      kind: "sort",
      word: label("Tooltip.LABEL[BetterBuildingMenu.ControlSort]", "Sort"),
      value: sort.current,
      values: sort.options.map((option) => option.label),
      changed: isSortSet(sort.column),
    },
    {
      kind: "filter",
      word: label("Tooltip.LABEL[BetterBuildingMenu.ControlFilter]", "Filter"),
      value: filters === 0 ? none : filtersOn(filters),
      // Two digits' worth, so the slot holds any count a menu reaches.
      values: [none, filtersOn(99)],
      changed: filters > 0,
    },
    {
      kind: "group",
      word: label("Tooltip.LABEL[BetterBuildingMenu.ControlGroup]", "Group"),
      value: group.current,
      values: group.options.map((option) => option.label),
      changed: groupPicked,
    },
    {
      kind: "view",
      word: label("Tooltip.LABEL[BetterBuildingMenu.ControlView]", "View"),
      value: view.current,
      // The bodies' names: the value is always one of them, never the Default view row's.
      values: view.options.filter((option) => option.id !== "").map((option) => option.label),
      changed: view.changed,
    },
  ];
}

export interface ControlsStripProps {
  cells: readonly ControlCell[];
  /** Each cell's value slot, in rem, from the top row's plan. */
  slots: readonly number[];
  form: ControlForm;
  /** The control whose popover is open, if one is. */
  open: ControlKind | null;
  /** Opens, closes or switches to a control's popover, from the cell's drawn element where it has one. */
  onToggle: (kind: ControlKind, cell: HTMLElement | null) => void;
}

interface ControlButtonProps {
  cell: ControlCell;
  slot: number;
  form: ControlForm;
  open: boolean;
  divider: boolean;
  onToggle: (kind: ControlKind, cell: HTMLElement | null) => void;
}

/** One control: its word or glyph, its value in its slot, the caret, the dot while set; its label is the game's Tooltip. */
const ControlButton = ({ cell, slot, form, open, divider, onToggle }: ControlButtonProps) => {
  const box = useRef<HTMLDivElement>(null);
  const label = `${cell.word} · ${cell.value}`;

  return (
    <>
      {divider && <div className={styles.divider} />}
      <div ref={box} className={styles.cellBox}>
        <Tooltip tooltip={label}>
          <Button
            className={classNames(styles.cell, form === "glyphs" && styles.folded, open && styles.open)}
            variant="icon"
            focusKey={FOCUS_DISABLED}
            aria-label={label}
            aria-expanded={open}
            onSelect={() => onToggle(cell.kind, box.current)}
          >
            {form === "words"
              ? <span className={styles.word}>{cell.word}</span>
              : <img className={styles.controlGlyph} style={{ maskImage: `url(${GLYPHS[cell.kind]})` }} alt="" aria-hidden="true" />}
            <span className={classNames(styles.value, cell.changed && styles.set)} style={{ width: `${slot}rem` }}>{cell.value}</span>
            <img className={styles.caret} style={{ maskImage: "url(Media/Glyphs/StrokeArrowDown.svg)" }} alt="" aria-hidden="true" />
            {cell.changed && <span className={styles.dot} aria-hidden="true" />}
          </Button>
        </Tooltip>
      </div>
    </>
  );
};

/**
 * Sort, Filter, Group and View on the top row: each a word, or from 110% a glyph, then its value in
 * a slot of fixed width, then a caret. A press opens its popover. See docs/design-notes.md, "The top row".
 */
export const ControlsStrip = ({ cells, slots, form, open, onToggle }: ControlsStripProps) => (
  <div className={styles.strip} {...{ [CONTROLS_MARK]: "true" }}>
    {cells.map((cell, index) => (
      <ControlButton key={cell.kind} cell={cell} slot={slots[index]} form={form} open={open === cell.kind} divider={index > 0} onToggle={onToggle} />
    ))}
  </div>
);
