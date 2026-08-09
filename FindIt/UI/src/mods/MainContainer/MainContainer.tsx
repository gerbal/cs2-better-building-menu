import { useValue, bindValue, trigger } from "cs2/api";
import { game, Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import mod from "../../../mod.json";
import { TopBarComponent } from "mods/TopBar/TopBar";
import { PrefabSelectionComponent } from "mods/PrefabSelection/PrefabSelection";
import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { ZoningHierarchyComponent } from "mods/ZoningHierarchy/ZoningHierarchy";
import { useState, useRef, useEffect } from "react";
import styles from "./mainContainer.module.scss";
import { OptionsPanelComponent } from "mods/OptionsPanel/OptionsPanel";
import { LensControlPane, LENS_CONTROL_PANE_TOTAL } from "mods/LensControlPane/LensControlPane";
import { OptionSection } from "domain/ContentViewType";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  clampBuildingLensHeight,
  draggedBuildingLensHeight,
} from "domain/buildingLensLayout";
import { findItSurfacePort } from "domain/findItSurfacePort";

// View contexts can be recreated before the first binding update is emitted.
// Safe fallbacks keep the shell hidden and prevent an early getValueUnsafe
// read from turning a normal reload into a Gameface exception.
const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
const IsExpanded$ = bindValue<boolean>(mod.id, "IsExpanded", false);
const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);
const AlignmentStyle$ = bindValue<string>(mod.id, "AlignmentStyle", "Center");
const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel", false);
const ShowZoningHierarchy$ = bindValue<boolean>(mod.id, "ShowZoningHierarchy", false);
const BuildingLensEnabled$ = bindValue<boolean>(mod.id, "BuildingLensEnabled", false);
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked", false);
const OptionsList$ = bindValue<OptionSection[]>(mod.id, "OptionsList", []);
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch", "");
const BuildingLensSection$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");

const GameMainScreneTheme: Theme | any = getModule("game-ui/game/components/game-main-screen.module.scss", "classes");

const PanelTheme: Theme | any = getModule("game-ui/common/panel/panel.module.scss", "classes");

const AssetMenuTheme: Theme | any = getModule("game-ui/game/components/asset-menu/asset-menu.module.scss", "classes");

const DefaultMainTheme: Theme | any = getModule("game-ui/common/panel/themes/default.module.scss", "classes");

export const FindItMainContainerComponent = () => {
  const isPhotoMode = useValue(game.activeGamePanel$)?.__Type == game.GamePanelType.PhotoMode;
  const { translate } = useLocalization();

  const containerRef = useRef(null);

  const [sortingOpen, setSortingOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [containerLeft, setContainerLeft] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef({ active: false, startY: 0, startHeight: 0 });

  // These get the value of the bindings. Without C# side game ui will crash. Or they will when we have bindings.
  const ShowFindItPanel = useValue(ShowFindItPanel$);
  const ShowZoningHierarchy = useValue(ShowZoningHierarchy$);
  const BuildingLensEnabled = useValue(BuildingLensEnabled$);
  const IsWindowLocked = useValue(IsWindowLocked$);
  const IsExpanded = useValue(IsExpanded$);
  const PanelWidth = useValue(PanelWidth$) + 15 + 20;
  const OptionsList = useValue(OptionsList$);
  const AlignmentStyle = useValue(AlignmentStyle$);
  const BuildingLensSection = useValue(BuildingLensSection$);

  // One height, set by dragging the panel's top edge and then kept.
  //
  // It replaces a binary and the two mechanisms that fought it: a 200rem strip
  // toggling to a near-full-screen "expanded", an automatic floor that raised
  // it whenever the results were unscoped, and the content sizing it in
  // between. The same menu measured 163px, 425px and 529px inside one session
  // depending on what was in it — no use for something you aim a mouse at, and
  // the reason this is now a single number the player owns.
  //
  // It also leaked: the catalog forced grid mode whenever the panel was not
  // expanded, so at the resting height the view-mode control lit up and did
  // nothing.
  const catalogHeight = clampBuildingLensHeight(useValue(BuildingLensPanelHeight$));

  const optionsOverflow = () => AlignmentStyle !== "Center" || window.innerWidth < containerLeft + ((PanelWidth + 300) * window.innerHeight) / 1080;

  useEffect(() => {
    var newLeft = (containerRef.current as any)?.getBoundingClientRect().left ?? 0;

    if (newLeft !== 0) setContainerLeft(newLeft);
  });

  /**
   * Stop vanilla centring its column trio while the lens is open.
   *
   * The build menu's left edge is not ours: it is vanilla's 475rem
   * tool-main-column, and tool-layout centres side + main + side (253 + 475 +
   * 253 = 990px) inside 1267px, which is what puts everything at x=145 and the
   * menu at x=403. Left-aligning that trio moves the options column to the
   * screen edge and frees the 253px it was holding in the middle, which the
   * panel then takes (see BuildingLensWidth.Max).
   *
   * Done imperatively because vanilla renders this element and we do not. The
   * class comes from the game's own stylesheet rather than a guessed selector,
   * and the effect restores whatever was there on the way out, so turning the
   * lens off — or unmounting — leaves vanilla's layout exactly as found. Only
   * justifyContent is touched: React does not set it inline, so there is
   * nothing for a re-render to fight over.
   */
  useEffect(() => {
    const layout = document.querySelector<HTMLElement>(
      GameMainScreneTheme?.toolLayout ? `.${GameMainScreneTheme.toolLayout}` : ".__no_such_class"
    );

    if (!layout) return;

    const previous = layout.style.justifyContent;
    layout.style.justifyContent = BuildingLensEnabled && AlignmentStyle === "Center" ? "flex-start" : previous;

    return () => {
      layout.style.justifyContent = previous;
    };
  }, [BuildingLensEnabled, AlignmentStyle]);

  if (isPhotoMode || !(ShowFindItPanel || IsWindowLocked)) return null;

  function onOptionClicked(x: number, y: number, z: number): void {
    findItSurfacePort.findItOption({ sectionId: x, optionId: y, value: z });
  }

  function toggleSortingOpen(): void {
    setSortingOpen(!sortingOpen);
    setOptionsOpen(false);
  }

  function toggleOptionsOpen(): void {
    setOptionsOpen(!optionsOpen);
    setSortingOpen(false);
  }

  function toggleEnlarge(): void {
    trigger(mod.id, "SetIsExpanded", !IsExpanded);
  }

  function beginResize(event: any): void {
    if (!BuildingLensEnabled) return;

    event.preventDefault?.();
    event.stopPropagation?.();
    resizeState.current = { active: true, startY: event.clientY, startHeight: catalogHeight };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;

    // The width is no longer draggable: with vanilla's column trio left-aligned
    // the band has one correct width, and dragging it narrower only gives back
    // the space that change reclaimed.
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
    // Only the release writes the settings file; the drag itself runs through
    // the live binding.
    trigger(mod.id, "CommitBuildingLensPanelHeight");
  }

  return (
    <div className={classNames(styles.findItMainContainer, styles["align" + AlignmentStyle])}>
      {BuildingLensEnabled && isResizing && <div className={styles.resizeBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />}
      <div className={classNames(styles.toolLayout, BuildingLensEnabled && styles.lensLeftAligned)}>
        <div
          className={AlignmentStyle !== "Center" ? styles.toolMainColumn : GameMainScreneTheme.toolMainColumn}
          style={AlignmentStyle === "Center" ? undefined : { width: PanelWidth + "rem" }}
        >
          <div
            className={classNames(GameMainScreneTheme.toolPanel, BuildingLensEnabled && styles.lensRow)}
            ref={containerRef}
            style={AlignmentStyle !== "Center" ? undefined : { width: PanelWidth + "rem" }}
          >
            {/* The pane is carved OUT of the panel's own width rather than
                added beside it. The assembly's left edge is fixed by vanilla
                centring a 475px column, and its right edge by the social
                column at 1248px — so growing rightward runs off the band, and
                widening the column to re-centre slides the panel underneath
                vanilla's Filters box instead of shifting it along. Both were
                measured; see the design doc. */}
            <div
              className={styles.toolContainer}
              style={BuildingLensEnabled ? { width: (PanelWidth - LENS_CONTROL_PANE_TOTAL) + "rem" } : undefined}
            >
              {(optionsOpen || sortingOpen) && optionsOverflow() && (
                <div className={styles.topPanel}>
                  <div>
                    <div>
                      <div className={styles.title}>
                        {optionsOpen ? translate("Tooltip.LABEL[FindItBuildingMenu.Filters]", "Filters") : translate("Tooltip.LABEL[FindItBuildingMenu.Sorting]", "Sorting")}
                      </div>
                      <OptionsPanelComponent
                        options={OptionsList.filter((x) => x.id < 0 !== optionsOpen)}
                        OnChange={onOptionClicked}
                      ></OptionsPanelComponent>
                    </div>
                  </div>
                </div>
              )}
              {/* On the panel's top edge, overlaying it rather than sitting in
                  the flow. In the flow it landed between the tab strip and the
                  catalog and read as a divider between the controls and the
                  results — a strip of chrome, not the edge of the window. The
                  panel is bottom-anchored, so the top edge is the one that
                  moves, and grabbing an edge is what this is. */}
              {BuildingLensEnabled && (
                <div
                  className={styles.resizeHandle}
                  onMouseDown={beginResize}
                  title={translate("Tooltip.LABEL[FindItBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize"}
                >
                  <div className={classNames(styles.resizeGrip, isResizing && styles.resizeGripActive)} />
                </div>
              )}
              <div className={styles.topBar}>
                <TopBarComponent
                  sortingOpen={sortingOpen}
                  optionsOpen={optionsOpen}
                  expanded={IsExpanded}
                  small={PanelWidth <= 685}
                  large={PanelWidth >= 850}
                  toggleSortingOpen={toggleSortingOpen}
                  toggleOptionsOpen={toggleOptionsOpen}
                  toggleEnlarge={toggleEnlarge}
                ></TopBarComponent>
              </div>
              <div
                className={classNames(styles.content, AssetMenuTheme.assetPanel)}
                // The height is stated rather than left to the content, which
                // is the whole point: a menu that resizes itself around however
                // many results came back is one you cannot learn the shape of.
                style={BuildingLensEnabled ? { height: `${catalogHeight}rem` } : undefined}
              >
                {BuildingLensEnabled
                  ? ShowZoningHierarchy
                    // Zones are assignment tools, not buildings, so the Zones
                    // menu gets the zoning hierarchy rather than a table of
                    // building rows filtered to nothing.
                    ? <ZoningHierarchyComponent />
                    : <BuildingCatalogComponent />
                  : <PrefabSelectionComponent expanded={IsExpanded}></PrefabSelectionComponent>}
              </div>
            </div>
            {BuildingLensEnabled && <LensControlPane />}
            {(optionsOpen || sortingOpen) && !optionsOverflow() && (
              <div className={styles.rightPanel} style={{ left: PanelWidth + "rem" }}>
                <div>
                  <div className={styles.title}>
                    {optionsOpen ? translate("Tooltip.LABEL[FindItBuildingMenu.Filters]", "Filters") : translate("Tooltip.LABEL[FindItBuildingMenu.Sorting]", "Sorting")}
                  </div>
                  <OptionsPanelComponent
                    options={OptionsList.filter((x) => x.id < 0 !== optionsOpen)}
                    OnChange={onOptionClicked}
                  ></OptionsPanelComponent>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
