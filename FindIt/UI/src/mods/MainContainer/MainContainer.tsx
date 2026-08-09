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
  isBuildingLensUnscoped,
  resizedBuildingLensWidth,
} from "domain/buildingLensLayout";
import { findItSurfacePort } from "domain/findItSurfacePort";

// View contexts can be recreated before the first binding update is emitted.
// Safe fallbacks keep the shell hidden and prevent an early getValueUnsafe
// read from turning a normal reload into a Gameface exception.
const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
const IsExpanded$ = bindValue<boolean>(mod.id, "IsExpanded", false);
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
  const resizeState = useRef({ active: false, startX: 0, startWidth: 0 });

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

  // Height follows the task. Search and the unscoped "All buildings"/
  // "Favorites" browses are cross-scope and cannot be read two rows at a
  // time; a menu-scoped browse can. This only applies to the Building Lens
  // — the legacy panel has no scope concept and BuildingLensSection defaults
  // to "AllBuildings" on both sides regardless of whether the lens is even
  // on, so gating on BuildingLensEnabled keeps this from firing there.
  // A manual expand always wins — this raises the floor, it does not seize the
  // control.
  //
  // The rule itself lives in buildingLensLayout because the control plane needs
  // the same answer to draw the expand control, and it is a sibling of this
  // component rather than a descendant. Two copies is how the pane would come
  // to report "strip" over a panel that is plainly tall.
  const searchText = useValue(CurrentSearch$) ?? "";
  const unscoped = BuildingLensEnabled && isBuildingLensUnscoped({ section: BuildingLensSection, searchText });
  const effectiveExpanded = IsExpanded || unscoped;
  // Strip height is a Building Lens concept only; the legacy panel keeps
  // whatever height behaviour it always had.
  const restingAsStrip = BuildingLensEnabled && !effectiveExpanded;

  const optionsOverflow = () => AlignmentStyle !== "Center" || window.innerWidth < containerLeft + ((PanelWidth + 300) * window.innerHeight) / 1080;

  useEffect(() => {
    var newLeft = (containerRef.current as any)?.getBoundingClientRect().left ?? 0;

    if (newLeft !== 0) setContainerLeft(newLeft);
  });

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
    resizeState.current = { active: true, startX: event.clientX, startWidth: PanelWidth };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;

    const nextWidth = resizedBuildingLensWidth(state.startWidth, state.startX, event.clientX, AlignmentStyle);
    trigger(mod.id, "SetBuildingLensPanelWidth", nextWidth - BUILDING_LENS_PANEL_CHROME_WIDTH);
  }

  function endResize(): void {
    if (!resizeState.current.active) return;

    resizeState.current.active = false;
    setIsResizing(false);
    trigger(mod.id, "CommitBuildingLensPanelWidth");
  }

  return (
    <div className={classNames(styles.findItMainContainer, styles["align" + AlignmentStyle])}>
      {BuildingLensEnabled && isResizing && <div className={styles.resizeBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />}
      <div className={styles.toolLayout}>
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
                className={classNames(
                  styles.content,
                  restingAsStrip && styles.contentStrip,
                  BuildingLensEnabled && effectiveExpanded && styles.contentExpanded,
                  AssetMenuTheme.assetPanel
                )}
              >
                {BuildingLensEnabled
                  ? ShowZoningHierarchy
                    // Zones are assignment tools, not buildings, so the Zones
                    // menu gets the zoning hierarchy rather than a table of
                    // building rows filtered to nothing.
                    ? <ZoningHierarchyComponent />
                    : <BuildingCatalogComponent expanded={effectiveExpanded} />
                  : <PrefabSelectionComponent expanded={IsExpanded}></PrefabSelectionComponent>}
              </div>
              {BuildingLensEnabled && <div className={styles.resizeHandle} onMouseDown={beginResize} title="Resize building lens" />}
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
