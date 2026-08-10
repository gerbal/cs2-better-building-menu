import { bindValue, trigger, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { useLocalization } from "cs2/l10n";

import mod from "../../../mod.json";
import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { ZoningHierarchyComponent } from "mods/ZoningHierarchy/ZoningHierarchy";
import { LensControlPane, LENS_CONTROL_PANE_TOTAL } from "mods/LensControlPane/LensControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { clampBuildingLensHeight, draggedBuildingLensHeight } from "domain/buildingLensLayout";

// Shared with MainContainer until phase 2 step 4 deletes it. One stylesheet for
// one panel: the rules below describe the same window whichever component is
// currently mounting it, and a copy would drift the moment either was touched.
import styles from "mods/MainContainer/mainContainer.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);
const ShowZoningHierarchy$ = bindValue<boolean>(mod.id, "ShowZoningHierarchy", false);

const GameMainScreneTheme: Theme | any = getModule("game-ui/game/components/game-main-screen.module.scss", "classes");
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
 * That is the whole point of the phase. `ToggleFindItPanel(false)` — FindIt's
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
 */
export interface BuildingMenuSurfaceProps {
  /**
   * The game's own close, from the `AssetMenu` extension point's props.
   *
   * Optional only because the prop is vanilla's and we do not control its
   * contract. Absent, the close control below hides rather than drawing a
   * button that does nothing.
   */
  onClose?: () => void;
}

export const BuildingMenuSurface = ({ onClose }: BuildingMenuSurfaceProps) => {
  const { translate } = useLocalization();

  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef({ active: false, startY: 0, startHeight: 0 });

  const PanelWidth = useValue(PanelWidth$) + 15 + 20;
  const ShowZoningHierarchy = useValue(ShowZoningHierarchy$);
  const catalogHeight = clampBuildingLensHeight(useValue(BuildingLensPanelHeight$));

  /**
   * Stop vanilla centring its column trio while the menu is open.
   *
   * Carried over from MainContainer unchanged, because the reason survives the
   * move: vanilla centres side + main + side (253 + 475 + 253 = 990px) inside
   * 1267px, which puts the trio at x=145 and the menu at x=403. Left-aligning
   * it moves the options column to the screen edge and frees the 253px it held
   * in the middle, which the panel then takes.
   *
   * It matters more here, not less. This panel is 727px wide starting at the
   * main column's left edge, so centred it would run 403 -> 1130 and put the
   * control plane at 1136 -> 1389 — a third of it off the right of a 1280px
   * screen.
   *
   * Imperative because vanilla renders this element and we do not. The class
   * comes from the game's own stylesheet rather than a guessed selector, and
   * the cleanup restores whatever was there, so unmounting leaves vanilla's
   * layout exactly as found.
   */
  useEffect(() => {
    const layout = document.querySelector<HTMLElement>(
      GameMainScreneTheme?.toolLayout ? `.${GameMainScreneTheme.toolLayout}` : ".__no_such_class"
    );

    if (!layout) return;

    const previous = layout.style.justifyContent;
    layout.style.justifyContent = "flex-start";

    return () => {
      layout.style.justifyContent = previous;
    };
  }, []);

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
            <BuildingMenuHeader small={PanelWidth <= 685} large={PanelWidth >= 850} />
          </div>
          <div
            className={classNames(styles.content, AssetMenuTheme.assetPanel)}
            style={{ height: `${catalogHeight}rem` }}
          >
            {/* Zones are assignment tools, not buildings, so the Zones menu
                gets the zoning hierarchy rather than a table of building rows
                filtered to nothing. */}
            {ShowZoningHierarchy ? <ZoningHierarchyComponent /> : <BuildingCatalogComponent />}
          </div>
        </div>
        {/* The pane holds the panel-level controls, so it is where a close
            belongs. It is handed the game's own close rather than one of ours:
            that is the route that clears the toolbar selection, and clearing it
            is what makes the panel go away with nothing drawn behind it. Any
            close we wrote ourselves would leave the menu selected and the
            vanilla grid would arrive in our place. */}
        <LensControlPane onCloseMenu={onClose} />
      </div>
    </>
  );
};
