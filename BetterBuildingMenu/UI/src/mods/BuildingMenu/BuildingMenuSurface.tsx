import { bindValue, trigger, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import classNames from "classnames";
import { useRef, useState } from "react";
import { useLocalization } from "cs2/l10n";

import mod from "../../../mod.json";
import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { LensControlPane, LENS_CONTROL_PANE_TOTAL } from "mods/LensControlPane/LensControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { VanillaTabBarHost } from "mods/VanillaTabBarHost/VanillaTabBarHost";
import { clampBuildingLensHeight, draggedBuildingLensHeight } from "domain/buildingLensLayout";
import { useVanillaLayoutForLens } from "mods/BuildingMenu/vanillaLayout";

import styles from "mods/BuildingMenu/buildingMenuSurface.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);

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
  const { translate } = useLocalization();

  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef({ active: false, startY: 0, startHeight: 0 });

  const PanelWidth = useValue(PanelWidth$) + 15 + 20;
  const catalogHeight = clampBuildingLensHeight(useValue(BuildingLensPanelHeight$));

  // The two patches on vanilla's own layout — the column trio left-aligned,
  // the toolbar sunk beneath the control pane — live with their reasons in
  // vanillaLayout.ts.
  useVanillaLayoutForLens();

  function beginResize(event: any): void {
    event.preventDefault?.();
    event.stopPropagation?.();
    resizeState.current = { active: true, startY: event.clientY, startHeight: catalogHeight };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;

    trigger(
      mod.id,
      "SetBuildingLensPanelHeight",
      draggedBuildingLensHeight(state.startHeight, state.startY, event.clientY)
    );
  }

  function endResize(): void {
    if (!resizeState.current.active) return;

    resizeState.current.active = false;
    setIsResizing(false);
    // Only the release writes the settings file; the drag runs through the
    // live binding.
    trigger(mod.id, "CommitBuildingLensPanelHeight");
  }

  return (
    <>
      {isResizing && (
        <div
          className={styles.resizeBlocker}
          onMouseMove={moveResize}
          onMouseUp={endResize}
          onMouseLeave={endResize}
        />
      )}
      {/* The width is stated here rather than inherited: this row is wider
          than the slot, and the slot's `overflow: visible` is what allows it. */}
      <div className={classNames(styles.lensRow)} style={{ width: PanelWidth + "rem" }}>
        <div
          className={styles.toolContainer}
          style={{ width: PanelWidth - LENS_CONTROL_PANE_TOTAL + "rem" }}
        >
          <div
            className={styles.resizeHandle}
            onMouseDown={beginResize}
            title={translate("Tooltip.LABEL[BetterBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize"}
          >
            <div className={classNames(styles.resizeGrip, isResizing && styles.resizeGripActive)} />
          </div>
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
