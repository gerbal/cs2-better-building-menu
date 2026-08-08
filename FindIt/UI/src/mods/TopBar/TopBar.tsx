import { bindValue, trigger, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import mod from "../../../mod.json";
import { Button, Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { getModule } from "cs2/modding";
import { FocusKey } from "cs2/bindings";
import styles from "./topBar.module.scss";
import { useEffect, useRef, useState } from "react";
import { PrefabCategory } from "../../domain/category";
import { PrefabSubCategory } from "../../domain/subCategory";
import { VanillaComponentResolver } from "../VanillaComponentResolver/VanillaComponentResolver";
import classNames from "classnames";
import { BasicButton } from "mods/BasicButton/BasicButton";
import find from "images/findit_find.svg";
import random from "images/findit_random.svg";
import shrink from "images/findit_shrink.svg";
import expand from "images/findit_expand.svg";
import filter from "images/findit_filter.svg";
import filterX from "images/findit_filterX.svg";
import lock from "images/findit_lock.svg";
import unlock from "images/findit_unlock.svg";
import sort from "images/findit_sort.svg";
import { FOCUS_DISABLED } from "cs2/input";
import { searchChangedCommand, setCurrentCategoryCommand, setCurrentSubCategoryCommand } from "domain/buildingCatalogContracts";
import type { BuildingLensMode } from "domain/buildingLensMode";
import { ChipRow } from "mods/ChipRow/ChipRow";
import { MenuCategoryStrip } from "mods/MenuCategoryStrip/MenuCategoryStrip";

export interface TopBarProps {
  sortingOpen: any;
  optionsOpen: boolean;
  expanded: boolean;
  small: boolean;
  large: boolean;
  toggleOptionsOpen: () => void;
  toggleSortingOpen: () => void;
  toggleEnlarge: () => void;
  buildingLensMode: BuildingLensMode;
  onBuildingLensModeChange: (mode: BuildingLensMode) => void;
}

const AccessibleLabel = ({ label }: { label: string }) => <span className={styles.accessibleLabel}>{label}</span>;

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");

const TextInputTheme: Theme | any = getModule("game-ui/editor/widgets/item/editor-item.module.scss", "classes");

const AssetCategoryTabTheme: Theme | any = getModule(
  "game-ui/game/components/asset-menu/asset-category-tab-bar/asset-category-tab-bar.module.scss",
  "classes"
);

// These establishes the binding with C# side.
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked");
const IsSearchLoading$ = bindValue<boolean>(mod.id, "IsSearchLoading");
const ClearSearchBar$ = bindValue<boolean>(mod.id, "ClearSearchBar");
const FocusSearchBar$ = bindValue<boolean>(mod.id, "FocusSearchBar");
const AreFiltersSet$ = bindValue<boolean>(mod.id, "AreFiltersSet");
const CurrentCategory$ = bindValue<number>(mod.id, "CurrentCategory");
const PrefabCount$ = bindValue<string>(mod.id, "PrefabCount");
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
const CurrentSubCategory$ = bindValue<number>(mod.id, "CurrentSubCategory");
const CategoryList$ = bindValue<PrefabCategory[]>(mod.id, "CategoryList");
const SubCategoryList$ = bindValue<PrefabSubCategory[]>(mod.id, "SubCategoryList");
const AlignmentStyle$ = bindValue<string>(mod.id, "AlignmentStyle");
// The lens navigation bindings can be read during a view recreation before
// the first C# refresh tick. Keep the React tree on a valid, inert shape until
// that update arrives instead of calling getValueUnsafe on an uninitialized
// binding (which otherwise leaves a Gameface exception in the console).
const BuildingLensEnabled$ = bindValue<boolean>(mod.id, "BuildingLensEnabled", false);
const BuildingCatalog$ = bindValue<{ totalCount?: number } | null>(mod.id, "BuildingCatalog", null);
// Section and subcategory now belong to the chip row, which owns both the
// breadcrumb and the picker that changes them.

export const TopBarComponent = (props: TopBarProps) => {
  // These get the value of the bindings. Or they will when we have bindings.
  const IsWindowLocked = useValue(IsWindowLocked$);
  const CurrentCategory = useValue(CurrentCategory$);
  const PrefabCount = useValue(PrefabCount$);
  const CurrentSubCategory = useValue(CurrentSubCategory$);
  const CategoryList = useValue(CategoryList$);
  const SubCategoryList = useValue(SubCategoryList$);
  const IsSearchLoading = useValue(IsSearchLoading$);
  const AreFiltersSet = useValue(AreFiltersSet$);
  const CurrentSearch = useValue(CurrentSearch$);
  const ClearSearchBar = useValue(ClearSearchBar$);
  const FocusSearchBar = useValue(FocusSearchBar$);
  const AlignmentStyle = useValue(AlignmentStyle$);
  const BuildingLensEnabled = useValue(BuildingLensEnabled$);
  const BuildingCatalogTotal = useValue(BuildingCatalog$)?.totalCount ?? 0;
  const searchRef = useRef(null);
  // translation handling. Translates using locale keys that are defined in C# or fallback string here.
  const { translate } = useLocalization();

  const localizedLabel = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;

  const handleInputChange = (value: Event) => {
    if (value?.target instanceof HTMLTextAreaElement) {
      setSearchText(value.target.value);
    }
  };

  const setSearchText = (value: string) => {
    const command = searchChangedCommand(value);
    trigger(mod.id, command.method, ...command.args);
  };

  const setCurrentCategory = (id: number) => {
    const command = setCurrentCategoryCommand(id);
    trigger(mod.id, command.method, ...command.args);
  };

  const setCurrentSubCategory = (id: number) => {
    const command = setCurrentSubCategoryCommand(id);
    trigger(mod.id, command.method, ...command.args);
  };

  const setFocus = () => {
    if (searchRef === null || searchRef.current === null) return;
    (searchRef.current as any).focus();
    (searchRef.current as any).select();
  };

  if (FocusSearchBar) {
    trigger(mod.id, "OnSearchFocused");
    setFocus();
  }

  if (ClearSearchBar) {
    trigger(mod.id, "OnSearchCleared");
    setSearchText("");
  }

  function RenderLegacyCategoryList(): JSX.Element {
    return (
      <div className={styles.categorySection}>
        {CategoryList.map((element) => (
          <>
            {element.id == 0 && <span style={{ flex: 1 }} />}
            <BasicButton
              tooltip={element.toolTip}
              src={element.icon}
              onClick={element.id == CurrentCategory ? undefined : () => setCurrentCategory(element.id)}
              className={classNames(VanillaComponentResolver.instance.toolButtonTheme.button, element.id == CurrentCategory && styles.selected)}
            >
              <AccessibleLabel label={element.toolTip} />
              <span />
            </BasicButton>
          </>
        ))}
      </div>
    );
  }

  function RenderLensModeList(): JSX.Element {
    // Folded into the top bar rather than owning a band. Catalog|Tools is
    // 128rem of controls; giving it a full-width 25rem row of its own was
    // 4% of the panel spent on two buttons.
    //
    // Built from the game's own TabBar/Tab rather than two hand-padded
    // lightButtons. This is exactly the control the game uses for a small
    // set of mutually exclusive views, so it already carries the right
    // padding, the selected treatment, and the legacy-interface variant that
    // our hand-styled version had to reproduce by eye and got subtly wrong.
    // TabNav adds gamepad and keyboard "Switch Tab", which the buttons never
    // had.
    const { TabBar, Tab, TabNav } = VanillaComponentResolver.instance;
    const modes: BuildingLensMode[] = ["catalog", "tools"];
    const modeLabels: Record<BuildingLensMode, { long: string; short: string }> = {
      catalog: {
        long: localizedLabel("Tooltip.LABEL[FindItBuildingMenu.CatalogMode]", "Building catalog"),
        short: localizedLabel("Tooltip.LABEL[FindItBuildingMenu.CatalogModeShort]", "Catalog"),
      },
      tools: {
        long: localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ToolsMode]", "Construction tools"),
        short: localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ToolsModeShort]", "Tools"),
      },
    };

    return (
      <TabNav
        tabs={modes}
        selectedTab={props.buildingLensMode}
        onSelect={(id) => props.onBuildingLensModeChange(id as BuildingLensMode)}
      >
        <TabBar className={styles.lensModeTabBar}>
          {modes.map((mode) => (
            <Tab
              key={mode}
              id={mode}
              selectedId={props.buildingLensMode}
              className={styles.lensModeTab}
              onSelect={(id) => props.onBuildingLensModeChange(id as BuildingLensMode)}
            >
              {modeLabels[mode].short}
              <AccessibleLabel label={modeLabels[mode].long} />
            </Tab>
          ))}
        </TabBar>
      </TabNav>
    );
  }

  function RenderSubCategoryList(): JSX.Element {
    return (
      <>
        {SubCategoryList.map((element) => (
          <BasicButton
            key={element.id}
            tooltip={element.toolTip}
            onClick={element.id == CurrentSubCategory ? undefined : () => setCurrentSubCategory(element.id)}
            className={classNames(
              VanillaComponentResolver.instance.assetGridTheme.item,
              styles.tabButton,
              element.id == CurrentSubCategory && styles.selected
            )}
          >
            <AccessibleLabel label={element.toolTip} />
            <img src={element.icon} className={VanillaComponentResolver.instance.assetGridTheme.thumbnail + " " + styles.gridThumbnail}></img>
          </BasicButton>
        ))}
      </>
    );
  }

  function RenderButtonSection(): JSX.Element {
    const enlargeLabel = localizedLabel(
      props.expanded ? "Tooltip.LABEL[FindItBuildingMenu.Shrink]" : "Tooltip.LABEL[FindItBuildingMenu.Expand]",
      props.expanded ? "Shrink" : "Expand"
    );
    const lockLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.LockWindow]", "Lock Window Open");
    const sortingLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ToggleSorting]", "Sorting");
    const filtersLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ToggleFilters]", "Filters");
    const buildingLensLabel = localizedLabel(
      BuildingLensEnabled
        ? "Tooltip.LABEL[FindItBuildingMenu.DisableBuildingLens]"
        : "Tooltip.LABEL[FindItBuildingMenu.EnableBuildingLens]",
      BuildingLensEnabled ? "Disable building lens" : "Enable building lens"
    );
    const clearFilterLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearFilter]", "Clear Filters");
    const randomLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.Random]", "Random");

    return (
      <div className={styles.buttonsSection}>
        {AlignmentStyle === "Center" && (
          <BasicButton
            tooltip={enlargeLabel}
            onClick={props.toggleEnlarge}
            mask={props.expanded ? shrink : expand}
            className={props.expanded && styles.selected}
          >
            <AccessibleLabel label={enlargeLabel} />
          </BasicButton>
        )}

        <BasicButton
          tooltip={lockLabel}
          onClick={() => trigger(mod.id, "ToggleLock")}
          mask={!IsWindowLocked ? unlock : lock}
          className={IsWindowLocked && styles.selected}
        >
          <AccessibleLabel label={lockLabel} />
        </BasicButton>

        {/* The legacy sort applies to the grid, not to the lens table, which
            sorts through its own column headers. Leaving it visible in lens
            mode offered a control that silently did nothing. */}
        {!BuildingLensEnabled && (
          <BasicButton
            tooltip={sortingLabel}
            onClick={props.toggleSortingOpen}
            mask={sort}
            className={props.sortingOpen && styles.selected}
          >
            <AccessibleLabel label={sortingLabel} />
          </BasicButton>
        )}

        <BasicButton
          tooltip={filtersLabel}
          onClick={props.toggleOptionsOpen}
          mask={filter}
          className={props.optionsOpen && styles.selected}
        >
          <AccessibleLabel label={filtersLabel} />
        </BasicButton>

        {/* The lens is a mode switch, not another filter toggle, but it read as
            one more unlabelled icon in a row of nine. A visible word makes the
            entry point findable without hovering every icon in turn. */}
        <BasicButton
          tooltip={buildingLensLabel}
          onClick={() => trigger(mod.id, "SetBuildingLensEnabled", !BuildingLensEnabled)}
          src="coui://finditbuildingmenu/Icons/Colored/BuildingZoneSignature.svg"
          className={BuildingLensEnabled
            ? `${styles.buildingLensToggle} ${styles.selected}`
            : styles.buildingLensToggle}
        >
          <span className={styles.buildingLensToggleLabel}>
            {localizedLabel("Tooltip.LABEL[FindItBuildingMenu.BuildingLens]", "Buildings")}
          </span>
          <AccessibleLabel label={buildingLensLabel} />
        </BasicButton>

        <div className={styles.seperator} />

        <BasicButton
          tooltip={clearFilterLabel}
          disabled={!AreFiltersSet}
          onClick={() => trigger(mod.id, "ClearFilters")}
          mask={filterX}
        >
          <AccessibleLabel label={clearFilterLabel} />
        </BasicButton>

        {/* Random picks from the legacy grid result and ignores every lens
            facet and metric range, so in lens mode it would hand back a
            building the player's own filters had excluded. */}
        {!BuildingLensEnabled && (
          <BasicButton
            tooltip={randomLabel}
            onClick={() => trigger(mod.id, "OnRandomButtonClicked")}
            mask={random}
          >
            <AccessibleLabel label={randomLabel} />
          </BasicButton>
        )}

        {AlignmentStyle === "Center" && <div className={styles.seperator} />}

        {/* One count, not two. The legacy PrefabCount describes the grid
            result; in lens mode the visible table is the bounded catalog, and
            showing the grid's number beside it invited the player to trust a
            total that did not describe anything on screen. */}
        <div className={styles.itemCount}>
          <span>{BuildingLensEnabled ? String(BuildingCatalogTotal) : PrefabCount}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={classNames(props.large && styles.large, props.small && styles.small)}>
        <div className={styles.topBar}>
          <div className={classNames(styles.topBarSection, styles.topBarSearchSection, AlignmentStyle !== "Center" && styles.expandedSearchArea)}>
            {IsSearchLoading && <img style={{ maskImage: "url(coui://finditbuildingmenu/Icons/Standard/HalfCircleProgress.svg)" }} className={styles.loadingIcon}></img>}
            {!IsSearchLoading && <img style={{ maskImage: `url(${find})` }} className={styles.searchIcon}></img>}
            <div className={styles.searchArea}>
              <TextInput
                ref={searchRef}
                multiline={1}
                value={CurrentSearch}
                disabled={false}
                type="text"
                className={classNames(TextInputTheme.input, styles.textBox)}
                focusKey={FOCUS_DISABLED}
                onChange={handleInputChange}
                placeholder={translate("Editor.SEARCH_PLACEHOLDER", "Search...")}
              ></TextInput>

              {CurrentSearch.trim() !== "" && (
                <Button
                  className={classNames(VanillaComponentResolver.instance.assetGridTheme.item, styles.clearIcon)}
                  variant="icon"
                  aria-label={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearSearch]", "Clear search")}
                  title={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearSearch]", "Clear search")}
                  onSelect={() => {
                    setSearchText("");
                  }}
                >
                  <img src="coui://finditbuildingmenu/Icons/Standard/ArrowLeftClear.svg" alt="" aria-hidden="true"></img>
                </Button>
              )}
            </div>

            {AlignmentStyle === "Center" && RenderButtonSection()}
          </div>

          <div className={classNames(styles.topBarSection, styles.topBarControlsSection)}>
            {BuildingLensEnabled && RenderLensModeList()}

            <Tooltip tooltip={translate("Tooltip.LABEL[FindItBuildingMenu.ClosePanel]", "Close Panel")}>
              <Button
                className={VanillaComponentResolver.instance.assetGridTheme.item + " " + styles.closeIcon}
                variant="icon"
                aria-label={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClosePanel]", "Close Panel")}
                title={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClosePanel]", "Close Panel")}
                onSelect={() => trigger(mod.id, "FindItCloseToggled")}
              >
                <img src="coui://finditbuildingmenu/Icons/Standard/XClose.svg" alt="" aria-hidden="true"></img>
              </Button>
            </Tooltip>
          </div>
        </div>

        {AlignmentStyle !== "Center" && <div className={styles.lowerButtonSection}>{RenderButtonSection()}</div>}

        {/* Legacy Find It keeps its own strips — it is upstream's UI, not ours
            to redesign. In lens mode the scope and type strips are gone: they
            were filters drawn as navigation, costing 27rem each and unable to
            express more than one value at a time. */}
        {!BuildingLensEnabled && (
          <>
            <div className={styles.rowCategoryBar}>{RenderLegacyCategoryList()}</div>

            <div className={classNames(AssetCategoryTabTheme.assetCategoryTabBar, styles.subCategoryContainer)}>
              <div className={AssetCategoryTabTheme.items}>
                {RenderSubCategoryList()}
              </div>
            </div>
          </>
        )}

        {BuildingLensEnabled && props.buildingLensMode === "catalog" && <ChipRow />}
        {/* Below the chips, above the results: the chips say what the whole
            result is scoped to, the strip narrows within it. It renders
            nothing at all unless the scoped menu has two or more categories,
            so an unscoped lens and a single-category menu both cost no row. */}
        {BuildingLensEnabled && props.buildingLensMode === "catalog" && <MenuCategoryStrip />}
      </div>
    </>
  );
};
