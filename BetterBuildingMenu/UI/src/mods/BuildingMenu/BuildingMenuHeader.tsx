import { useValue } from "cs2/api";
import { Button, Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { FOCUS_DISABLED } from "cs2/input";
import classNames from "classnames";
import { memo, useRef } from "react";

import find from "images/find.svg";
import { searchChangedCommand } from "domain/buildingCatalogContracts";
import { MenuCategoryStrip } from "mods/MenuCategoryStrip/MenuCategoryStrip";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

import styles from "mods/BuildingMenu/buildingMenuHeader.module.scss";
import { noteSearchField } from "./searchField";
import { textInputText } from "domain/textInput";
import { CurrentSearch$, IsSearchLoading$, send } from "mods/bindings";
import { GameTextInput, gameClasses } from "mods/gameModules";

const TextInputTheme = gameClasses("game-ui/editor/widgets/item/editor-item.module.scss");

export interface BuildingMenuHeaderProps {
  /** Narrow asset menu: the strip and the field share a tighter row. */
  small?: boolean;
  /** Wide asset menu. */
  large?: boolean;
  /**
   * The game's own menu close, threaded from the AssetMenu extension point.
   * Absent means no X is drawn rather than an X that does nothing.
   */
  onClose?: () => void;
}

/**
 * The build menu's own header: the category strip, the search field and the
 * game's close X, on one row.
 */
export const BuildingMenuHeader = memo(function BuildingMenuHeader({ small, large, onClose }: BuildingMenuHeaderProps) {
  const { translate } = useLocalization();
  const searchRef = useRef(null);

  const IsSearchLoading = useValue(IsSearchLoading$);
  const CurrentSearch = useValue(CurrentSearch$);

  const localizedLabel = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;

  const setSearchText = (value: string) => {
    send(searchChangedCommand(value));
  };

  const handleInputChange = (value: Event) => {
    // So the catalog's Enter listener can tell this box from other text fields.
    noteSearchField(value?.target);
    const text = textInputText(value);
    if (text !== undefined) {
      setSearchText(text);
    }
  };

  return (
    <div className={classNames(large && styles.large, small && styles.small)}>
      <div className={styles.catalogStripRow}>
        {/* Wrapped rather than styled directly: MenuCategoryStrip owns its own
            class and sizes itself flex: 0 0 auto. The wrapper holds the tabs at
            the left and the search at the right even when the strip draws
            nothing, which a menu with fewer than two categories does. */}
        <div className={styles.catalogStripTabs}>
          <MenuCategoryStrip />
        </div>
        <div className={styles.catalogStripSearch}>
          {IsSearchLoading && (
            <img
              style={{ maskImage: "url(coui://betterbuildingmenu/Icons/Standard/HalfCircleProgress.svg)" }}
              className={styles.loadingIcon}
            alt="" aria-hidden="true" />
          )}
          {!IsSearchLoading && <img style={{ maskImage: `url(${find})` }} className={styles.searchIcon} alt="" aria-hidden="true" />}
          <div className={styles.searchArea}>
            <GameTextInput
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
              <Tooltip tooltip={localizedLabel("Tooltip.LABEL[BetterBuildingMenu.ClearSearch]", "Clear search")}>
                <Button
                  className={classNames(VanillaComponentResolver.instance.assetGridTheme.item, styles.clearIcon)}
                  variant="icon"
                  aria-label={localizedLabel("Tooltip.LABEL[BetterBuildingMenu.ClearSearch]", "Clear search")}
                  onSelect={() => setSearchText("")}
                >
                  <img src="coui://betterbuildingmenu/Icons/Standard/ArrowLeftClear.svg" alt="" aria-hidden="true" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
        {/* Vanilla closes its menus from an X here, so ours does too. Masked
            and tinted like .searchIcon because Close.svg carries no fill of its
            own; no assetGridTheme.item, which is the 48x48 TILE theme. */}
        {onClose && (
          <Tooltip tooltip={localizedLabel("Tooltip.LABEL[BetterBuildingMenu.CloseMenu]", "Close")}>
            <Button
              className={styles.menuClose}
              variant="icon"
              aria-label={localizedLabel("Tooltip.LABEL[BetterBuildingMenu.CloseMenu]", "Close")}
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
});
