import { useValue } from "cs2/api";
import classNames from "classnames";

import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { ControlPane } from "mods/ControlPane/ControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { AssetMenuResizeHandle, useAssetMenuHeight } from "mods/AssetMenuResizeHandle/AssetMenuResizeHandle";
import { VanillaTabBarHost } from "mods/VanillaTabBarHost/VanillaTabBarHost";
import { useVanillaLayoutForAssetMenu } from "mods/BuildingMenu/vanillaLayout";
import { CONTROL_PANE_TOTAL, ASSET_MENU_CHROME_WIDTH } from "domain/assetMenuLayout";

import styles from "mods/BuildingMenu/assetMenu.module.scss";
import { AssetMenuWidth$ } from "mods/bindings";
import { gameClasses } from "mods/gameModules";

const AssetMenuTheme = gameClasses("game-ui/game/components/asset-menu/asset-menu.module.scss");

/**
 * The build menu, rendered from inside the game's own `AssetMenu` extension
 * point, so the GAME decides when it exists and no gap is left for the vanilla
 * grid. The slot's `overflow: visible` lets the row below state its own width.
 */
export interface AssetMenuProps {
  /**
   * The game's own menu close, from the AssetMenu extension point. Optional, so
   * the asset menu still renders if the game mounts it without one; the X then
   * does not draw. See BuildingMenuHeader.
   */
  onClose?: () => void;
}

export const AssetMenu = ({ onClose }: AssetMenuProps) => {
  const AssetMenuWidth = useValue(AssetMenuWidth$) + ASSET_MENU_CHROME_WIDTH;
  const { height: catalogHeight, isResizing, beginResize, blocker } = useAssetMenuHeight();

  // The two patches on vanilla's own layout — the column trio left-aligned,
  // the toolbar sunk beneath the control pane — live with their reasons in
  // vanillaLayout.ts.
  useVanillaLayoutForAssetMenu();

  return (
    <>
      {blocker}
      {/* The width is stated here rather than inherited: this row is wider
          than the slot, and the slot's `overflow: visible` is what allows it. */}
      <div className={classNames(styles.assetMenuRow)} style={{ width: AssetMenuWidth + "rem" }}>
        <div
          className={styles.toolContainer}
          style={{ width: AssetMenuWidth - CONTROL_PANE_TOTAL + "rem" }}
        >
          <AssetMenuResizeHandle active={isResizing} onBeginResize={beginResize} />
          <div className={styles.topBar}>
            <BuildingMenuHeader small={AssetMenuWidth <= 685} large={AssetMenuWidth >= 850} onClose={onClose} />
            <VanillaTabBarHost onClose={onClose} />
          </div>
          <div
            className={classNames(styles.content, AssetMenuTheme.assetPanel)}
            style={{ height: `${catalogHeight}rem` }}
          >
            <BuildingCatalogComponent />
          </div>
        </div>
        <ControlPane />
      </div>
    </>
  );
};
