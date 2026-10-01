import classNames from "classnames";

import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { ControlPane } from "mods/ControlPane/ControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { AssetMenuResizeHandle, useAssetMenuHeight } from "mods/AssetMenuResizeHandle/AssetMenuResizeHandle";
import { AssetMenuWidthHandle, useAssetMenuWidthDrag } from "mods/AssetMenuWidthHandle/AssetMenuWidthHandle";
import { VanillaTabBarHost } from "mods/VanillaTabBarHost/VanillaTabBarHost";
import { useVanillaLayoutForAssetMenu } from "mods/BuildingMenu/vanillaLayout";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { catalogLayoutWidth } from "domain/assetMenuLayout";

import styles from "mods/BuildingMenu/assetMenu.module.scss";
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
  const { bandWidth, menuWidth, rowWidth, paneShown } = useAssetMenuLayout();
  const { height: catalogHeight, isResizing, beginResize, blocker } = useAssetMenuHeight();
  const widthDrag = useAssetMenuWidthDrag(menuWidth, bandWidth, paneShown);
  // The header's modes were tuned against the whole row, pane included, as the
  // table's were; at the default width this is the band, as before.
  const headerWidth = catalogLayoutWidth(menuWidth);

  // The two patches on vanilla's own layout — the column trio left-aligned,
  // the toolbar sunk beneath the control pane — live with their reasons in
  // vanillaLayout.ts.
  useVanillaLayoutForAssetMenu();

  return (
    <>
      {blocker}
      {widthDrag.blocker}
      {/* The width is stated here rather than inherited: this row is wider
          than the slot, and the slot's `overflow: visible` is what allows it.
          It is the build menu and the pane and nothing more, so no empty
          stretch of it is left to take the mouse. */}
      <div className={classNames(styles.assetMenuRow)} style={{ width: rowWidth + "rem" }}>
        <div className={styles.toolContainer} style={{ width: menuWidth + "rem" }}>
          <AssetMenuResizeHandle active={isResizing} onBeginResize={beginResize} />
          <div className={styles.topBar}>
            <BuildingMenuHeader small={headerWidth <= 685} large={headerWidth >= 850} onClose={onClose} />
            <VanillaTabBarHost onClose={onClose} />
          </div>
          <div
            className={classNames(styles.content, AssetMenuTheme.assetPanel)}
            style={{ height: `${catalogHeight}rem` }}
          >
            <BuildingCatalogComponent />
          </div>
          <AssetMenuWidthHandle active={widthDrag.isResizing} onBeginResize={widthDrag.beginResize} />
        </div>
        {paneShown && <ControlPane />}
      </div>
    </>
  );
};
