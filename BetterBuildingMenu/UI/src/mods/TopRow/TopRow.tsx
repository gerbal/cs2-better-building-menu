import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { memo, useRef } from "react";

import enterMark from "images/enter.svg";
import find from "images/find.svg";
import { CLOSE_GAP, CLOSE_SIZE, TOP_ROW_INSET } from "domain/assetMenuLayout";
import { searchChangedCommand } from "domain/buildingCatalogContracts";
import { textInputText } from "domain/textInput";
import { useTextScale } from "domain/textScaleSetting";
import { enterTarget, fieldNeeds, planControls, planField, type ControlKind } from "domain/topRow";
import { resolveVanillaLabel, vanillaMenuNameKeys } from "domain/vanillaServiceLabels";
import { AssetMenu$, BuildingCatalog$, CurrentSearch$, IsSearchLoading$, send } from "mods/bindings";
import { GameTextInput } from "mods/gameModules";
import { VanillaTabBarHost } from "mods/VanillaTabBarHost/VanillaTabBarHost";
import { ControlsStrip, useControlCells } from "./ControlsStrip";
import { noteSearchField } from "./searchField";
import styles from "./topRow.module.scss";

export interface TopRowProps {
  /** The box's width as drawn, in rem. */
  width: number;
  /** How far in from the box's right edge the row ends: 4, or more where the box runs over the chirper. */
  rightInset: number;
  /** The control whose popover is open, if one is. */
  open: ControlKind | null;
  /** Opens, closes or switches a control's popover. */
  onToggle: (kind: ControlKind, cell: HTMLElement | null) => void;
  /** The game's own menu close; absent, no close draws rather than one that does nothing. */
  onClose?: () => void;
}

/**
 * The box's top row: the search field, Sort, Filter, Group and View, whatever other mods add to the
 * game's tab bar, and close. See docs/design-notes.md, "The top row".
 */
export const TopRow = memo(function TopRow({ width, rightInset, open, onToggle, onClose }: TopRowProps) {
  const { translate } = useLocalization();
  const searchRef = useRef(null);
  const loading = useValue(IsSearchLoading$);
  const query = useValue(CurrentSearch$) ?? "";
  const menu = useValue(AssetMenu$) ?? "";
  const page = useValue(BuildingCatalog$);
  const scale = useTextScale();
  const cells = useControlCells();

  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const target = enterTarget(page, query);
  const targetText = target === null
    ? null
    : target.kind === "match" ? target.name : label("Tooltip.LABEL[BetterBuildingMenu.AllMatchesLocked]", "All matches locked");
  // The field first: the controls fold to keep its floor, and its whole Enter target while a query is
  // typed. Close's room only while close draws.
  const controls = planControls({
    row: width - TOP_ROW_INSET - rightInset - (onClose ? CLOSE_GAP + CLOSE_SIZE : 0),
    scale,
    cells,
    fieldNeeds: fieldNeeds(query, targetText, scale),
  });
  const plan = planField({
    field: controls.field,
    scale,
    menuLabel: resolveVanillaLabel(vanillaMenuNameKeys(menu), (key) => translate(key, null), menu),
    // Null in a language with no string of ours, where the game's own word serves.
    template: translate("Tooltip.LABEL[BetterBuildingMenu.SearchMenu]"),
    gameFallback: label("Editor.SEARCH_PLACEHOLDER", "Search..."),
    query,
    target: targetText,
  });
  const clearLabel = label("Tooltip.LABEL[BetterBuildingMenu.ClearSearch]", "Clear search");
  const closeLabel = label("Tooltip.LABEL[BetterBuildingMenu.CloseMenu]", "Close");

  const onChange = (event: Event) => {
    // So the catalog's Enter listener can tell this box from other text fields.
    noteSearchField(event?.target);
    const text = textInputText(event);
    if (text !== undefined) send(searchChangedCommand(text));
  };

  return (
    <div className={styles.topBand}>
      <div className={styles.topRow} style={{ marginRight: `${rightInset}rem` }}>
        <div className={styles.field}>
          <img
            className={classNames(styles.glyph, loading && styles.spinning)}
            style={{ maskImage: loading ? "url(coui://uil/Standard/HalfCircleProgress.svg)" : `url(${find})` }}
            alt=""
            aria-hidden="true"
          />
          <GameTextInput
            ref={searchRef}
            multiline={1}
            value={query}
            disabled={false}
            type="text"
            className={styles.input}
            focusKey={FOCUS_DISABLED}
            onChange={onChange}
            placeholder={plan.placeholder}
          />
          {plan.target !== null && (
            <div className={styles.target}>
              {target?.kind === "match" && (
                <img className={styles.enterMark} style={{ maskImage: `url(${enterMark})` }} alt="" aria-hidden="true" />
              )}
              <span className={styles.targetName}>{plan.target}</span>
            </div>
          )}
          {query.trim() !== "" && (
            <Tooltip tooltip={clearLabel}>
              <Button className={styles.clear} variant="icon" focusKey={FOCUS_DISABLED} aria-label={clearLabel} onSelect={() => send(searchChangedCommand(""))}>
                <img className={styles.clearGlyph} style={{ maskImage: "url(Media/Glyphs/Close.svg)" }} alt="" aria-hidden="true" />
              </Button>
            </Tooltip>
          )}
        </div>
        <ControlsStrip cells={cells} slots={controls.slots} form={controls.form} open={open} onToggle={onToggle} />
        {/* What other mods add to the game's tab bar: nothing wide when empty, and the field gives up the room. */}
        <VanillaTabBarHost onClose={onClose} />
        {onClose && (
          <Tooltip tooltip={closeLabel}>
            <Button className={styles.menuClose} variant="round" aria-label={closeLabel} onSelect={onClose}>
              <img className={styles.menuCloseGlyph} style={{ maskImage: "url(Media/Glyphs/Close.svg)" }} alt="" aria-hidden="true" />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
});
