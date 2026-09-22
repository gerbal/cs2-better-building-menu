import { bindValue, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import classNames from "classnames";

import mod from "../../../mod.json";
import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { LensControlPane, LENS_CONTROL_PANE_TOTAL } from "mods/LensControlPane/LensControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { LensResizeHandle, useLensPanelHeight } from "mods/LensResizeHandle/LensResizeHandle";
import { VanillaTabBarHost } from "mods/VanillaTabBarHost/VanillaTabBarHost";
import { useVanillaLayoutForLens } from "mods/BuildingMenu/vanillaLayout";

import styles from "mods/BuildingMenu/buildingMenuSurface.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);

const AssetMenuTheme: Theme | any = getModule("game-ui/game/components/asset-menu/asset-menu.module.scss", "classes");

/**
 * The build menu, rendered from inside the game's own `AssetMenu` extension
 * point, so the GAME decides when it exists and no gap is left for the vanilla
 * grid. The slot's `overflow: visible` lets the row below state its own width.
 */
export interface BuildingMenuSurfaceProps {
  /**
   * The game's own menu close, from the AssetMenu extension point. Optional, so
   * the surface still renders if the game mounts it without one; the X then
   * does not draw. See BuildingMenuHeader.
   */
  onClose?: () => void;
}

export const BuildingMenuSurface = ({ onClose }: BuildingMenuSurfaceProps) => {
  const PanelWidth = useValue(PanelWidth$) + 15 + 20;
  const { height: catalogHeight, isResizing, beginResize, blocker } = useLensPanelHeight();

  // The two patches on vanilla's own layout — the column trio left-aligned,
  // the toolbar sunk beneath the control pane — live with their reasons in
  // vanillaLayout.ts.
  useVanillaLayoutForLens();

  return (
    <>
      {blocker}
      {/* The width is stated here rather than inherited: this row is wider
          than the slot, and the slot's `overflow: visible` is what allows it. */}
      <div className={classNames(styles.lensRow)} style={{ width: PanelWidth + "rem" }}>
        <div
          className={styles.toolContainer}
          style={{ width: PanelWidth - LENS_CONTROL_PANE_TOTAL + "rem" }}
        >
          <LensResizeHandle active={isResizing} onBeginResize={beginResize} />
          <div className={styles.topBar}>
            <BuildingMenuHeader small={PanelWidth <= 685} large={PanelWidth >= 850} onClose={onClose} />
            <VanillaTabBarHost onClose={onClose} />
          </div>
          <div
            className={classNames(styles.content, AssetMenuTheme.assetPanel)}
            style={{ height: `${catalogHeight}rem` }}
          >
            <BuildingCatalogComponent />
          </div>
        </div>
        <LensControlPane />
      </div>
    </>
  );
};
