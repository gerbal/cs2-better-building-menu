import { bindValue, trigger, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import { Button, Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { FOCUS_DISABLED } from "cs2/input";
import classNames from "classnames";
import { useEffect, useRef } from "react";

import mod from "../../../mod.json";
import find from "images/findit_find.svg";
import { searchChangedCommand } from "domain/buildingCatalogContracts";
import { MenuCategoryStrip } from "mods/MenuCategoryStrip/MenuCategoryStrip";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

// Shared with TopBar until step 4 finishes and that file goes. One stylesheet
// for one row: these rules describe the same header whichever component is
// still rendering it, and a copy would drift the moment either was touched.
import styles from "mods/BuildingMenu/buildingMenuHeader.module.scss";

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");
const TextInputTheme: Theme | any = getModule("game-ui/editor/widgets/item/editor-item.module.scss", "classes");

const IsSearchLoading$ = bindValue<boolean>(mod.id, "IsSearchLoading", false);
const ClearSearchBar$ = bindValue<boolean>(mod.id, "ClearSearchBar", false);
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch", "");

export interface BuildingMenuHeaderProps {
  /** Narrow panel: the strip and the field share a tighter row. */
  small?: boolean;
  /** Wide panel. */
  large?: boolean;
  /**
   * The game's own menu close, threaded from the AssetMenu extension point.
   *
   * Absent means no X is drawn rather than an X that does nothing: a dead
   * control in the corner vanilla puts a live one in is worse than none.
   */
  onClose?: () => void;
}

/**
 * The build menu's own header: the category strip, and search.
 *
 * Lifted out of FindIt's TopBar, which was two products sharing one file —
 * eleven `BuildingLensEnabled ? … : …` branches deciding, control by control,
 * whether each belonged to the lens or to the legacy asset grid. Everything
 * below is the lens half; the legacy half stays behind in TopBar until the
 * panel that renders it goes.
 *
 * What did NOT come across, and why:
 *
 * - The whole top bar row — search, lock, filters, sort, random, the result
 *   count, the close X. `showTopBarRow` was already `!BuildingLensEnabled`, so
 *   none of it drew in this mode. The controls worth keeping moved to the
 *   control plane; the close came back with the game's own `onClose`.
 * - The legacy category and subcategory strips. They were filters drawn as
 *   navigation, cost 27rem each, and could not express more than one value.
 * - `FocusSearchBar`. Its only writer was the Ctrl+F hot-key, removed in
 *   44eeab0 because it collided with vanilla's "Toggle Follow Selected Citizen"
 *   AND with FindIt's own shortcut. A binding no one writes cannot focus
 *   anything, so carrying its read across would have been carrying a no-op.
 *
 * Measured layout, from the commit that built this row: on Transportation the
 * seven tabs take 403..957 and the field 957..1121, inside a 718px row.
 */
export const BuildingMenuHeader = ({ small, large, onClose }: BuildingMenuHeaderProps) => {
  const { translate } = useLocalization();
  const searchRef = useRef(null);

  const IsSearchLoading = useValue(IsSearchLoading$);
  const ClearSearchBar = useValue(ClearSearchBar$);
  const CurrentSearch = useValue(CurrentSearch$);

  const localizedLabel = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;

  const setSearchText = (value: string) => {
    const command = searchChangedCommand(value);
    trigger(mod.id, command.method, ...command.args);
  };

  const handleInputChange = (value: Event) => {
    if (value?.target instanceof HTMLTextAreaElement) {
      setSearchText(value.target.value);
    }
  };

  // TopBar did this during render, which fired a trigger as a side effect of
  // drawing and could run twice for one request. The backend still expects the
  // acknowledgement — OnSearchCleared is what sets the flag back — so the
  // behaviour is unchanged; only when it happens is.
  useEffect(() => {
    if (!ClearSearchBar) return;

    trigger(mod.id, "OnSearchCleared");
    setSearchText("");
  }, [ClearSearchBar]);

  return (
    <div className={classNames(large && styles.large, small && styles.small)}>
      <div className={styles.catalogStripRow}>
        {/* Wrapped rather than styled directly: MenuCategoryStrip owns its own
            class and sizes itself flex: 0 0 auto, which on this shared row
            parked it against the search field with 354px of empty row to its
            left. The wrapper also holds the search at the right edge when the
            strip renders nothing at all — a menu with fewer than two
            categories, which is Water & Sewage and Zones. */}
        <div className={styles.catalogStripTabs}>
          <MenuCategoryStrip />
        </div>
        <div className={styles.catalogStripSearch}>
          {IsSearchLoading && (
            <img
              style={{ maskImage: "url(coui://finditbuildingmenu/Icons/Standard/HalfCircleProgress.svg)" }}
              className={styles.loadingIcon}
            />
          )}
          {!IsSearchLoading && <img style={{ maskImage: `url(${find})` }} className={styles.searchIcon} />}
          <div className={styles.searchArea}>
            <TextInput
              ref={searchRef}
              multiline={1}
              value={CurrentSearch}
              disabled={false}
              type="text"
              className={classNames(TextInputTheme.input, styles.stripTextBox)}
              focusKey={FOCUS_DISABLED}
              onChange={handleInputChange}
              placeholder={translate("Editor.SEARCH_PLACEHOLDER", "Search...")}
            />

            {CurrentSearch.trim() !== "" && (
              <Tooltip tooltip={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearSearch]", "Clear search")}>
                <Button
                  className={classNames(VanillaComponentResolver.instance.assetGridTheme.item, styles.clearIcon)}
                  variant="icon"
                  aria-label={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearSearch]", "Clear search")}
                  onSelect={() => setSearchText("")}
                >
                  <img src="coui://finditbuildingmenu/Icons/Standard/ArrowLeftClear.svg" alt="" aria-hidden="true" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
        {/* Vanilla's zoning and building menus close from an X in this corner,
            so ours does too — the panel stands in for that menu, and a player
            should not have to learn a second way out of it.

            Masked and tinted exactly like .searchIcon two elements to the
            left, because the game's Close.svg carries no fill of its own and
            renders black on a dark panel otherwise. That is a vector under a
            compositing effect, which this engine draws badly at scale (see
            SilhouetteIcons) — tolerated here because it is ONE static glyph in
            the chrome, the same bet the search and loading icons already make,
            rather than one per row of a scrolling grid, which is what actually
            broke. If it ever flickers, bake the colour into an asset instead.

            No assetGridTheme.item: that is the TILE theme, and wearing it made
            this a 48x48 control next to a 24rem icon.

            Last in the row, so it lands at the right edge after the search
            field, and rendered only when the close is real. */}
        {onClose && (
          <Tooltip tooltip={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.CloseMenu]", "Close")}>
            <Button
              className={styles.menuClose}
              variant="icon"
              aria-label={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.CloseMenu]", "Close")}
              onSelect={onClose}
            >
              <img
                className={styles.menuCloseGlyph}
                style={{ maskImage: "url(Media/Glyphs/Close.svg)" }}
                alt=""
                aria-hidden="true"
              />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
