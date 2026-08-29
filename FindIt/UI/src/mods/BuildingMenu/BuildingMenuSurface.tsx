import { bindValue, trigger, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { useLocalization } from "cs2/l10n";

import mod from "../../../mod.json";
import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { LensControlPane, LENS_CONTROL_PANE_TOTAL } from "mods/LensControlPane/LensControlPane";
import { BuildingMenuHeader } from "mods/BuildingMenu/BuildingMenuHeader";
import { clampBuildingLensHeight, draggedBuildingLensHeight } from "domain/buildingLensLayout";

// Was shared with MainContainer, which mounted the same panel from the other
// side; step 4 deleted that component, so the stylesheet moved here to sit
// beside its only remaining consumer.
import styles from "mods/BuildingMenu/buildingMenuSurface.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);

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
      // Restoring "" — which is what the game leaves here, since it styles this
      // from its stylesheet rather than inline — makes Cohtml log
      // "Trying to set justifyContent property to invalid value!" on every menu
      // close. A browser reads the empty string as "unset the inline value";
      // this engine reads it as a value and rejects it.
      if (previous) {
        layout.style.justifyContent = previous;
        return;
      }

      layout.style.removeProperty("justify-content");
    };
  }, []);

  /**
   * Puts the build menu above the Chirper, which was reported covering the
   * control pane.
   *
   * The chirper was never winning on z-index — it has none. It wins on document
   * order: under `game-main-screen` the children are [main-container, toolbar,
   * pause-overlay, tutorial-renderer], the chirper hangs off `toolbar` and we
   * hang off `main-container`, and positioned elements at `z-index: auto` paint
   * in tree order.
   *
   * A z-index on anything of OURS cannot fix that, and this was measured rather
   * than assumed: `lensRow` at `z-index: 40` changed nothing, verified against a
   * stand-in toast injected into the chirper's own parent. The comparison that
   * decides the result happens between `main-container` and `toolbar`, because
   * those are the siblings — the same lesson already written at
   * mainContainer.module.scss:309.
   *
   * So it has to be one of those two, and it is the TOOLBAR that moves, down,
   * rather than main-container up.
   *
   * Raising main-container to 1 was the first attempt and it broke the game's
   * own dropdowns. Vanilla portals a popup — the Locked/Unlocked selector among
   * them — to `game-main-screen` as the LAST child at `z-index: auto`, and
   * counts on tree order to put it above everything. An explicit 1 on an
   * earlier sibling beats auto whatever the order, so the popup opened behind
   * our control pane and only the sliver above the pane's top edge was visible.
   * It also forced `pause-overlay` and `tutorial-renderer` up to 2 to keep them
   * over the HUD, which is three of vanilla's elements restyled to fix one
   * relationship.
   *
   * Lowering the toolbar changes exactly the one pair we came for and leaves
   * every other element at the value the game shipped: main-container stays
   * auto, so the portalled popup still wins on tree order, and pause-overlay
   * and tutorial-renderer still sit above main-container because they already
   * come after it. One element instead of three.
   *
   * Verified live at 1280x720, all four things that could break:
   *   - a stand-in toast in the chirper's own parent is completely hidden by
   *     the pane, which is what we came for;
   *   - the Locked/Unlocked popup draws in full over the pane;
   *   - the bottom toolbar still renders — `game-main-screen` paints no
   *     background, so a negative z-index does not sink it out of view;
   *   - the toolbar is still hit-testable. `elementFromPoint` at the Roads
   *     button's centre returns `item-inner_*` inside `toolbar`. (Read this
   *     with no dropdown open: while one is, the game parks its own
   *     `pointer-barrier` over the screen to catch the dismissing click, and
   *     every hit test returns that instead.)
   *
   * Imperative and scoped to the mount for the same reason as the block above:
   * this is vanilla's element, and a stylesheet rule would restyle the game's
   * UI for the whole session — including while our panel is closed and for
   * whatever other mod is looking at the same node.
   *
   * Still a stopgap. It trades an unreadable toast for a usable control
   * surface; the real fix is moving the toast lane so the two do not share the
   * space at all.
   */
  useEffect(() => {
    // Found as a CHILD of game-main-screen rather than by a document-wide
    // `[class*="toolbar_"]`, which also matches our own panel's toolbars and
    // would hand back whichever DOM order happened to put first. The pair whose
    // paint order we are changing is defined by being siblings, so selecting on
    // that relationship is the honest way to say it.
    const screen = document.querySelector<HTMLElement>('[class*="game-main-screen"]');
    const toolbar = screen
      ? Array.from(screen.children).find((child) =>
          String(child.className).startsWith("toolbar_")
        )
      : undefined;

    const applied = (toolbar instanceof HTMLElement ? [toolbar] : []).map((element) => {
      const previous = element.style.zIndex;
      element.style.zIndex = "-1";
      return { element, previous };
    });

    return () => {
      for (const { element, previous } of applied) {
        // Same empty-string trap as justify-content above: the game sets these
        // from its stylesheet, so the inline value has to be removed rather
        // than assigned back as "".
        if (previous) {
          element.style.zIndex = previous;
          continue;
        }

        element.style.removeProperty("z-index");
      }
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
