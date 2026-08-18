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
import shrink from "images/findit_shrink.svg";
import expand from "images/findit_expand.svg";
import filter from "images/findit_filter.svg";
import filterX from "images/findit_filterX.svg";
import lock from "images/findit_lock.svg";
import unlock from "images/findit_unlock.svg";
import { FOCUS_DISABLED } from "cs2/input";
import { searchChangedCommand } from "domain/buildingCatalogContracts";
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
}

const AccessibleLabel = ({ label }: { label: string }) => <span className={styles.accessibleLabel}>{label}</span>;

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");

const TextInputTheme: Theme | any = getModule("game-ui/editor/widgets/item/editor-item.module.scss", "classes");


// These establishes the binding with C# side.
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked");
const IsSearchLoading$ = bindValue<boolean>(mod.id, "IsSearchLoading");
const ClearSearchBar$ = bindValue<boolean>(mod.id, "ClearSearchBar");
const FocusSearchBar$ = bindValue<boolean>(mod.id, "FocusSearchBar");
const AreFiltersSet$ = bindValue<boolean>(mod.id, "AreFiltersSet");
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
const AlignmentStyle$ = bindValue<string>(mod.id, "AlignmentStyle");
// The lens navigation bindings can be read during a view recreation before
// the first C# refresh tick. Keep the React tree on a valid, inert shape until
// that update arrives instead of calling getValueUnsafe on an uninitialized
// binding (which otherwise leaves a Gameface exception in the console).
const BuildingCatalog$ = bindValue<{ totalCount?: number } | null>(mod.id, "BuildingCatalog", null);
// Section and subcategory now belong to the chip row, which owns both the
// breadcrumb and the picker that changes them.

export const TopBarComponent = (props: TopBarProps) => {
  // These get the value of the bindings. Or they will when we have bindings.
  const IsWindowLocked = useValue(IsWindowLocked$);
  const IsSearchLoading = useValue(IsSearchLoading$);
  const AreFiltersSet = useValue(AreFiltersSet$);
  const CurrentSearch = useValue(CurrentSearch$);
  const ClearSearchBar = useValue(ClearSearchBar$);
  const FocusSearchBar = useValue(FocusSearchBar$);
  const AlignmentStyle = useValue(AlignmentStyle$);
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

  function RenderButtonSection(): JSX.Element {
    const enlargeLabel = localizedLabel(
      props.expanded ? "Tooltip.LABEL[FindItBuildingMenu.Shrink]" : "Tooltip.LABEL[FindItBuildingMenu.Expand]",
      props.expanded ? "Shrink" : "Expand"
    );
    const lockLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.LockWindow]", "Lock Window Open");
    const filtersLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ToggleFilters]", "Filters");
    const clearFilterLabel = localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearFilter]", "Clear Filters");

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

        <BasicButton
          tooltip={filtersLabel}
          onClick={props.toggleOptionsOpen}
          mask={filter}
          className={props.optionsOpen && styles.selected}
        >
          <AccessibleLabel label={filtersLabel} />
        </BasicButton>

        {/* No lens toggle. It sent SetBuildingLensEnabled, a trigger that no
            longer exists — the lens replaces vanilla's build menu rather than
            being a mode you switch into, so there is nothing for it to toggle
            and a click would have gone to a binding that was not there. */}

        <BasicButton
          tooltip={clearFilterLabel}
          disabled={!AreFiltersSet}
          onClick={() => trigger(mod.id, "ClearFilters")}
          mask={filterX}
        >
          <AccessibleLabel label={clearFilterLabel} />
        </BasicButton>

        {AlignmentStyle === "Center" && <div className={styles.seperator} />}

        {/* One count. The legacy PrefabCount described the grid result, and
            the grid is not a thing this bar can be sitting on any more. */}
        <div className={styles.itemCount}>
          <span>{String(BuildingCatalogTotal)}</span>
        </div>
      </div>
    );
  }

  // In lens catalog mode this row is 42rem of chrome — search, the icon
  // buttons, the lens toggle, the result count, the CATALOG/TOOLS tabs, and
  // close — duplicating controls the chip row and toolbar icon already
  // provide. It stays for the legacy panel (upstream's UI, not ours to
  // redesign) and for tools mode, where the CATALOG/TOOLS tabs are the only
  // way back to catalog: ToolSurfaceBar has no back control of its own.
  // Closing the panel without this row's button still works — the game
  // toolbar's FindIt icon toggles it closed the same way it opened it.
  // No top bar row at all. It was gated on the lens being off, and the lens is
  // what this panel holds now — the search it carried lives on the strip row
  // below, which is why CurrentSearch, setSearchText, handleInputChange,
  // IsSearchLoading and searchRef are all still live.

  return (
    <>
      <div className={classNames(props.large && styles.large, props.small && styles.small)}>

        {AlignmentStyle !== "Center" && <div className={styles.lowerButtonSection}>{RenderButtonSection()}</div>}

        {/* No scope or type strips. They were upstream's, and they were
            filters drawn as navigation — 27rem each, unable to express more
            than one value at a time. */}

          {/* Commit 834f72d dropped the whole top bar row in this mode to
              buy back its 30px, which took search off screen along with it
              — a conditional render, not a deletion, so CurrentSearch,
              setSearchText, handleInputChange, IsSearchLoading and
              searchRef below are all still live. An earlier attempt to
              reunite search with the strip (46106a5) was reverted (7458a02)
              because back then the strip shared its row with that whole top
              bar — search, lock/filter/lens-toggle/sort/random, the result
              count and the CATALOG/TOOLS tabs — leaving the tabs 27px of a
              718px row. With the row gone, the strip and a compact field
              fit together with room to spare: measured on Transportation,
              seven tabs take 403..957 and the field 957..1121. */}
          <div className={styles.catalogStripRow}>
            {/* Wrapped rather than styled directly: MenuCategoryStrip owns
                its own class and sizes itself flex: 0 0 auto, which on this
                shared row parked it against the search field with 354px of
                empty row to its left. The wrapper is also what holds the
                search at the right edge when the strip renders nothing at
                all — a menu with fewer than two categories, which is
                Water & Sewage and Zones. */}
            <div className={styles.catalogStripTabs}>
              <MenuCategoryStrip />
            </div>
            <div className={styles.catalogStripSearch}>
              {IsSearchLoading && (
                <img
                  style={{ maskImage: "url(coui://finditbuildingmenu/Icons/Standard/HalfCircleProgress.svg)" }}
                  className={styles.loadingIcon}
                ></img>
              )}
              {!IsSearchLoading && <img style={{ maskImage: `url(${find})` }} className={styles.searchIcon}></img>}
              <div className={styles.searchArea}>
                <TextInput
                  ref={searchRef}
                  multiline={1}
                  value={CurrentSearch}
                  disabled={false}
                  type="text"
                  className={classNames(TextInputTheme.input, styles.stripTextBox)}
                  focusKey={FOCUS_DISABLED}
                  onChange={handleInputChange}
                  placeholder={translate("Editor.SEARCH_PLACEHOLDER", "Search...")}
                ></TextInput>

                {CurrentSearch.trim() !== "" && (
                  <Tooltip tooltip={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearSearch]", "Clear search")}>
                    <Button
                      className={classNames(VanillaComponentResolver.instance.assetGridTheme.item, styles.clearIcon)}
                      variant="icon"
                      aria-label={localizedLabel("Tooltip.LABEL[FindItBuildingMenu.ClearSearch]", "Clear search")}
                      onSelect={() => {
                        setSearchText("");
                      }}
                    >
                      <img src="coui://finditbuildingmenu/Icons/Standard/ArrowLeftClear.svg" alt="" aria-hidden="true"></img>
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* The scope chips used to sit here, behind `expanded`, which
              meant the one line saying what you were looking at was missing
              at exactly the height the lens rests at. They are in the
              control plane now, which is always visible and costs the panel
              no row at all. */}
      </div>
    </>
  );
};
