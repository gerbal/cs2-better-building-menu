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
import { clampBuildingLensHeight, draggedBuildingLensHeight } from "domain/buildingLensLayout";
import { useVanillaLayoutForLens } from "mods/BuildingMenu/vanillaLayout";

// Was shared with MainContainer, which mounted the same panel from the other
// side; step 4 deleted that component, so the stylesheet moved here to sit
// beside its only remaining consumer.
import styles from "mods/BuildingMenu/buildingMenuSurface.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);

const AssetMenuTheme: Theme | any = getModule("game-ui/game/components/asset-menu/asset-menu.module.scss", "classes");

/**
 * The build menu, mounted in the game's own asset-menu slot.
 *
 * This is the phase 2 shell (see the design doc). The difference from
 * MainContainer is not what it draws — the tree below is the same panel — but
 * who decides it exists. MainContainer is appended to `Game` and shows itself
 * from a `ShowFindItPanel` binding we maintain; this renders from inside the
 * `AssetMenu` extension point, so the game mounts and unmounts it on its own
 * menu lifecycle.
 *
 * That is the whole point of the phase. `SetLensMenuOpen(false)` — FindIt's
 * "another surface wants the screen, so get out of the way" reflex — appears
 * eleven times in the backend and is correct for a floating asset finder. For a
 * menu it is wrong: the toolbar button is still lit, so the game draws its own
 * grid into the space the instant we vacate it. Three guards now carve
 * exceptions out of that reflex. When the game owns the mount there is no gap
 * to draw into, and the guards have nothing left to guard.
 *
 * GEOMETRY, measured live at 1280x720. The slot is `tool-main-column`:
 * x=264, an explicit `width: 474.666px`, `flex: 0 0 auto`, `overflow: visible`,
 * `flex-direction: column`, `justify-content: flex-end`. The last two already
 * match how this panel behaves — bottom-anchored, growing upward — and the
 * `overflow: visible` is what lets the panel keep its own width: a 727px probe
 * inside that 475px column drew at full width, unclipped, with the column
 * unchanged. So the width below is stated on our own row and vanilla's CSS is
 * never touched.
 *
 * ONE PROP. The `AssetMenu` extension point hands its children an `onClose` —
 * the route that clears the toolbar selection, and the only close that makes
 * the panel go away with nothing drawn behind it. It was dropped when the
 * legacy top bar row retired and is threaded again for the header's X, which
 * vanilla's own zoning and building menus put in the same corner.
 */
export interface BuildingMenuSurfaceProps {
  /**
   * The game's own menu close, from the AssetMenu extension point.
   *
   * Optional because the surface must still render if the game ever mounts it
   * without one; the X simply does not draw. See BuildingMenuHeader.
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
      {/* The width is stated here rather than inherited. The slot is 475px and
          this is 727px; `overflow: visible` on the slot is what makes that
          legal, and it is measured rather than assumed. */}
      <div className={classNames(styles.lensRow)} style={{ width: PanelWidth + "rem" }}>
        <div
          className={styles.toolContainer}
          style={{ width: PanelWidth - LENS_CONTROL_PANE_TOTAL + "rem" }}
        >
          <div
            className={styles.resizeHandle}
            onMouseDown={beginResize}
            title={translate("Tooltip.LABEL[FindItBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize"}
          >
            <div className={classNames(styles.resizeGrip, isResizing && styles.resizeGripActive)} />
          </div>
          <div className={styles.topBar}>
            <BuildingMenuHeader small={PanelWidth <= 685} large={PanelWidth >= 850} onClose={onClose} />
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
