import classNames from "classnames";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { Notch } from "mods/Notch/Notch";
import { ControlPane } from "mods/ControlPane/ControlPane";
import { ControlPopover } from "mods/ControlPopover/ControlPopover";
import { HoverCard } from "mods/HoverCard/HoverCard";
import { TabRow } from "mods/TabRow/TabRow";
import { useAssetMenuHeight } from "mods/AssetMenuResizeHandle/AssetMenuResizeHandle";
import { TopEdge } from "mods/TopEdge/TopEdge";
import { TopRow } from "mods/TopRow/TopRow";
import { AssetMenuWidthHandle, AssetMenuWidthReach, useAssetMenuWidthDrag } from "mods/AssetMenuWidthHandle/AssetMenuWidthHandle";
import { useGameSlotLeft } from "mods/BuildingMenu/useGameSlotLeft";
import { useVanillaLayoutForAssetMenu } from "mods/BuildingMenu/vanillaLayout";
import { setOpenListCloser } from "mods/BuildingMenu/openListCloser";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useLookRoot } from "mods/useLookRoot";
import { ASSET_MENU_WIDTH_HANDLE_REACH, drawnBodyHeight, drawnBoxHeight, TOP_EDGE_HEIGHT } from "domain/assetMenuLayout";
import { WIDTH_STEP_VANILLA } from "domain/sharedContracts.generated";
import { controlLeftRem, popoverAnchor, toggleList, type ControlKind, type OpenList } from "domain/topRow";
import { boxPlacement, popoverRightLimit, toolOptionsShift, topRowRightInset } from "domain/widthSteps";

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
  const { step, drawnStep, menuWidth, paneShown, snaps, screen: unmeasured } = useAssetMenuLayout();
  // The box draws from the game's slot as the row reads it, and from the centred fallback until it does.
  const row = useRef<HTMLDivElement>(null);
  const slotLeft = useGameSlotLeft(row, unmeasured.textScale);
  const screen = slotLeft === undefined ? unmeasured : { ...unmeasured, slotLeft };
  // The top edge drags from the body as drawn, which a tall stored height exceeds under the top HUD.
  const { height: catalogHeight, isResizing, beginResize, blocker } = useAssetMenuHeight(drawnBodyHeight);
  const widthDrag = useAssetMenuWidthDrag({ menuWidth, step, drawnStep, snaps, screen });
  const look = useLookRoot();
  // The box follows a width drag, and keeps the snapped width until the stored step comes back.
  const shownWidth = widthDrag.liveWidth ?? menuWidth;
  // Where the box draws, from vanilla's slot. See docs/design-notes.md, "The box at its Width step, and the control pane".
  const placement = boxPlacement(shownWidth, screen);

  // One list open at a time, in the top row's popover, under its control's drawn left edge, or
  // over the pane. See docs/design-notes.md, "The top row".
  const root = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<OpenList | null>(null);
  const togglePopover = useCallback((kind: ControlKind, cell: HTMLElement | null) => {
    const left = controlLeftRem(
      cell?.getBoundingClientRect?.().left,
      root.current?.getBoundingClientRect?.().left,
      typeof window === "undefined" ? 0 : window.innerHeight
    );
    setList((open) => toggleList(open, { home: "popover", kind, left }));
  }, []);
  const togglePaneList = useCallback((kind: ControlKind) => setList((open) => toggleList(open, { home: "pane", kind })), []);
  const closeList = useCallback(() => setList(null), []);
  const popover = list?.home === "popover" ? list : null;
  // Escape from the search field closes the open list first, from the watcher beside the box. See
  // docs/design-notes.md, "Escape".
  useEffect(() => {
    if (list === null) return undefined;
    setOpenListCloser(closeList);
    return () => setOpenListCloser(null);
  }, [list, closeList]);

  // The patches on vanilla's own layout, the toolbar sunk beneath the box and the pane and the tool
  // options moved clear of a box that reaches left of the slot, live with their reason in vanillaLayout.ts.
  useVanillaLayoutForAssetMenu(toolOptionsShift(placement, screen));

  return (
    <>
      {blocker}
      {widthDrag.blocker}
      {/* The row keeps a 706 layout width at the left of the game's slot, where its own menu
          sits, and moves by the step's offset; the box and the pane overflow it to the right,
          which the slot's `overflow: visible` allows. Every step is at least 706, so no stretch
          of the row lies beside the box to take the mouse. */}
      <div ref={row} className={styles.assetMenuRow} style={{ width: `${WIDTH_STEP_VANILLA}rem`, left: `${placement.offset}rem` }}>
        {/* The box carries the look: its tokens, the game's interface style followed, and its
            panels' alphas under the game's transparency; its marker names the look for the live check.
            See docs/design-notes.md, "The looks' tokens". */}
        <div
          ref={root}
          className={classNames(styles.toolContainer, look.className)}
          style={{ width: `${shownWidth}rem`, ...look.style } as CSSProperties}
          data-bbm-look={look.id}
        >
          {/* The search field, the controls, the hosted tab-bar buttons and close, along the box's
              top edge. See docs/design-notes.md, "The top row". */}
          <TopRow
            width={shownWidth}
            rightInset={topRowRightInset(placement, shownWidth, screen.aspect)}
            open={popover?.kind ?? null}
            onToggle={togglePopover}
            onClose={onClose}
          />
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
          {/* Under the box's bottom edge, over the lit bar button. See docs/design-notes.md, "The notch". */}
          <Notch boxRef={root} boxWidth={shownWidth} offset={placement.offset} />
          {/* The open control's popover, above the box or, for a tall box, under the top row,
              inside its root so it takes the look. */}
          <ControlPopover
            open={popover}
            limit={popoverRightLimit(placement, shownWidth, screen.aspect)}
            anchor={popoverAnchor(drawnBoxHeight(catalogHeight))}
            onClose={closeList}
          />
          {/* The building pointed at, above the box, inside its root so it takes the look, hidden while a
              list is open. See docs/design-notes.md, "The hover card". */}
          <HoverCard boxRef={root} hidden={list !== null} />
          {/* Last, so it paints over the top row's upper edge, under the popovers. See
              docs/design-notes.md, "The top edge". */}
          <TopEdge active={isResizing} onBeginResize={(event) => beginResize(event, TOP_EDGE_HEIGHT)} />
        </div>
        {paneShown && <ControlPane open={list?.home === "pane" ? list.kind : null} onToggle={togglePaneList} onClose={closeList} />}
      </div>
    </>
  );
};
