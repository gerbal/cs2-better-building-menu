import { useValue } from "cs2/api";
import classNames from "classnames";
import type { CSSProperties } from "react";

import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { ControlPane } from "mods/ControlPane/ControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { TabRow } from "mods/TabRow/TabRow";
import { AssetMenuResizeHandle, useAssetMenuHeight } from "mods/AssetMenuResizeHandle/AssetMenuResizeHandle";
import { AssetMenuWidthHandle, AssetMenuWidthReach, useAssetMenuWidthDrag } from "mods/AssetMenuWidthHandle/AssetMenuWidthHandle";
import { VanillaTabBarHost } from "mods/VanillaTabBarHost/VanillaTabBarHost";
import { useVanillaLayoutForAssetMenu } from "mods/BuildingMenu/vanillaLayout";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { AssetMenuTuning$ } from "mods/bindings";
import { ASSET_MENU_WIDTH_HANDLE_REACH, assetMenuRowWidth, catalogLayoutWidth, drawnBodyHeight } from "domain/assetMenuLayout";
import { surfaceAlphaStyle } from "domain/looks";
import { useInterfaceTransparency } from "domain/interfaceTransparencySetting";
import looks from "looks/looks.module.scss";

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
  const { step, menuWidth, paneShown, snaps } = useAssetMenuLayout();
  const { height: catalogHeight, isResizing, beginResize, blocker } = useAssetMenuHeight();
  const widthDrag = useAssetMenuWidthDrag({ menuWidth, step, snaps });
  const transparency = useInterfaceTransparency();
  const tuning = useValue(AssetMenuTuning$);
  // The box follows a width drag, and keeps the snapped width until the stored step comes back.
  const shownWidth = widthDrag.liveWidth ?? menuWidth;
  const rowWidth = assetMenuRowWidth(shownWidth, paneShown);
  // The header's small and large modes, judged against the menu plus the pane.
  // Their classes carry no rules, so neither changes what is drawn.
  const headerWidth = catalogLayoutWidth(shownWidth);

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
        {/* The box carries the look: its tokens, the game's interface style followed, and its
            panels' alphas under the game's transparency. See docs/design-notes.md, "The looks' tokens". */}
        <div
          className={classNames(styles.toolContainer, looks.standard, tuning.interfaceStyles && looks.followStyle)}
          style={{ width: shownWidth + "rem", ...surfaceAlphaStyle(transparency) } as CSSProperties}
        >
          <AssetMenuResizeHandle active={isResizing} onBeginResize={beginResize} />
          <div className={styles.topBar}>
            <BuildingMenuHeader small={headerWidth <= 685} large={headerWidth >= 850} onClose={onClose} />
            <VanillaTabBarHost onClose={onClose} />
          </div>
          <div
            className={classNames(styles.content, AssetMenuTheme.assetPanel)}
            style={{ height: `${drawnBodyHeight(catalogHeight)}rem` }}
          >
            <BuildingCatalogComponent />
            <AssetMenuWidthHandle
              active={widthDrag.isResizing}
              hovered={widthDrag.isHovered}
              hoverProps={widthDrag.hoverProps}
              onBeginResize={widthDrag.beginResize}
            />
          </div>
          {/* The tabs, on the box's bottom edge next to the bar. The list above is the box less
              their band, so the box keeps its height. See docs/design-notes.md, "The tab row". */}
          <TabRow width={shownWidth} />
          {/* Only beside the pane: with it hidden the menu may reach the room's
              edge, and nothing may go past that over the social icons. */}
          {paneShown && (
            <AssetMenuWidthReach
              active={widthDrag.isResizing}
              hovered={widthDrag.isHovered}
              hoverProps={widthDrag.hoverProps}
              onBeginResize={(event) => widthDrag.beginResize(event, ASSET_MENU_WIDTH_HANDLE_REACH)}
            />
          )}
        </div>
        {paneShown && <ControlPane />}
      </div>
    </>
  );
};
