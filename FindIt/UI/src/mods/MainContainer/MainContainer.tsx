import { useValue, bindValue, trigger } from "cs2/api";
import { game, Theme } from "cs2/bindings";
import { getModule } from "cs2/modding";
import mod from "../../../mod.json";
import { TopBarComponent } from "mods/TopBar/TopBar";
import { PrefabSelectionComponent } from "mods/PrefabSelection/PrefabSelection";
import { BuildingCatalogComponent } from "mods/BuildingCatalog/BuildingCatalog";
import { useState, useRef, useEffect } from "react";
import styles from "./mainContainer.module.scss";
import { OptionsPanelComponent } from "mods/OptionsPanel/OptionsPanel";
import { OptionSection } from "domain/ContentViewType";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  resizedBuildingLensWidth,
} from "domain/buildingLensLayout";
import { findItSurfacePort } from "domain/findItSurfacePort";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth");
const IsExpanded$ = bindValue<boolean>(mod.id, "IsExpanded");
const AlignmentStyle$ = bindValue<string>(mod.id, "AlignmentStyle");
const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel");
const BuildingLensEnabled$ = bindValue<boolean>(mod.id, "BuildingLensEnabled");
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked");
const OptionsList$ = bindValue<OptionSection[]>(mod.id, "OptionsList");

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
  const BuildingLensEnabled = useValue(BuildingLensEnabled$);
  const IsWindowLocked = useValue(IsWindowLocked$);
  const IsExpanded = useValue(IsExpanded$);
  const PanelWidth = useValue(PanelWidth$) + 15 + 20;
  const OptionsList = useValue(OptionsList$);
  const AlignmentStyle = useValue(AlignmentStyle$);

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
            className={GameMainScreneTheme.toolPanel}
            ref={containerRef}
            style={AlignmentStyle !== "Center" ? undefined : { width: PanelWidth + "rem" }}
          >
            <div className={styles.toolContainer}>
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
              <div className={styles.content + " " + AssetMenuTheme.assetPanel}>
                {BuildingLensEnabled ? <BuildingCatalogComponent /> : <PrefabSelectionComponent expanded={IsExpanded}></PrefabSelectionComponent>}
              </div>
              {BuildingLensEnabled && <div className={styles.resizeHandle} onMouseDown={beginResize} title="Resize building lens" />}
            </div>
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
