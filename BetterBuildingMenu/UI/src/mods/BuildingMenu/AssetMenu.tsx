import { useValue } from "cs2/api";
import classNames from "classnames";
import type { CSSProperties } from "react";

import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { ControlPane } from "mods/ControlPane/ControlPane";
import { TabRow } from "mods/TabRow/TabRow";
import { useAssetMenuHeight } from "mods/AssetMenuResizeHandle/AssetMenuResizeHandle";
import { TopEdge } from "mods/TopEdge/TopEdge";
import { TopRow } from "mods/TopRow/TopRow";
import { AssetMenuWidthHandle, AssetMenuWidthReach, useAssetMenuWidthDrag } from "mods/AssetMenuWidthHandle/AssetMenuWidthHandle";
import { useVanillaLayoutForAssetMenu } from "mods/BuildingMenu/vanillaLayout";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { AssetMenuTuning$ } from "mods/bindings";
import { ASSET_MENU_WIDTH_HANDLE_REACH, drawnBodyHeight, TOP_EDGE_HEIGHT } from "domain/assetMenuLayout";
import { WIDTH_STEP_VANILLA } from "domain/sharedContracts.generated";
import { boxPlacement, topRowRightInset } from "domain/widthSteps";
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
   * does not draw. See TopRow.
   */
  onClose?: () => void;
}

export const AssetMenu = ({ onClose }: AssetMenuProps) => {
  const { step, drawnStep, menuWidth, paneShown, snaps, screen } = useAssetMenuLayout();
  const { height: catalogHeight, isResizing, beginResize, blocker } = useAssetMenuHeight();
  const widthDrag = useAssetMenuWidthDrag({ menuWidth, step, drawnStep, snaps, screen });
  const transparency = useInterfaceTransparency();
  const tuning = useValue(AssetMenuTuning$);
  // The box follows a width drag, and keeps the snapped width until the stored step comes back.
  const shownWidth = widthDrag.liveWidth ?? menuWidth;
  // Where the box draws, from vanilla's slot. See docs/design-notes.md, "The box at its Width step, and the control pane".
  const placement = boxPlacement(shownWidth, screen);

  // The one patch on vanilla's own layout, the toolbar sunk beneath the box and the pane, lives
  // with its reason in vanillaLayout.ts.
  useVanillaLayoutForAssetMenu();

  return (
    <>
      {blocker}
      {widthDrag.blocker}
      {/* The row keeps vanilla's 706 layout width, so the game centres it where its own menu
          sits, and moves by the step's offset; the box and the pane overflow it to the right,
          which the slot's `overflow: visible` allows. Every step is at least 706, so no stretch
          of the row lies beside the box to take the mouse. */}
      <div className={styles.assetMenuRow} style={{ width: `${WIDTH_STEP_VANILLA}rem`, left: `${placement.offset}rem` }}>
        {/* The box carries the look: its tokens, the game's interface style followed, and its
            panels' alphas under the game's transparency. See docs/design-notes.md, "The looks' tokens". */}
        <div
          className={classNames(styles.toolContainer, looks.standard, tuning.interfaceStyles && looks.followStyle)}
          style={{ width: shownWidth + "rem", ...surfaceAlphaStyle(transparency) } as CSSProperties}
        >
          {/* The search field, the hosted tab-bar buttons and close, along the box's top edge. See
              docs/design-notes.md, "The top row". */}
          <TopRow width={shownWidth} rightInset={topRowRightInset(placement, shownWidth, screen.aspect)} onClose={onClose} />
          <div
            className={classNames(styles.content, AssetMenuTheme.assetPanel)}
            style={{ height: `${drawnBodyHeight(catalogHeight)}rem` }}
          >
            <BuildingCatalogComponent />
          </div>
          {/* The tabs, on the box's bottom edge next to the bar. The list above is the box less
              their band, so the box keeps its height. See docs/design-notes.md, "The tab row". */}
          <TabRow width={shownWidth} />
          {/* Down the box's right edge from under the top row to its bottom, past the tab row:
              a child of the box, not of the body, whose box would cut it. */}
          <AssetMenuWidthHandle
            active={widthDrag.isResizing}
            hovered={widthDrag.isHovered}
            hoverProps={widthDrag.hoverProps}
            onBeginResize={widthDrag.beginResize}
          />
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
          {/* Last, so it paints over the top row's upper edge, under the popovers. See
              docs/design-notes.md, "The top edge". */}
          <TopEdge active={isResizing} onBeginResize={(event) => beginResize(event, TOP_EDGE_HEIGHT)} />
        </div>
        {paneShown && <ControlPane />}
      </div>
    </>
  );
};
