import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Button, Scrollable, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useState } from "react";
import mod from "../../../mod.json";
import { lensSectionCommand, lensSubCategoryCommand, type VanillaBuildMenuTab } from "domain/vanillaBuildMenuContracts";
import { orderedCategories, type VanillaMenuCategory } from "domain/vanillaMenuCategories";
import { isScopedToMenu, lensScopeChipsFor } from "domain/lensScopeChips";
import {
  resolveVanillaLabel,
  vanillaCategoryNameKeys,
  vanillaMenuNameKeys,
} from "domain/vanillaServiceLabels";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "domain/buildingLensFilterSummary";
import styles from "./chipRow.module.scss";

/**
 * The single band that says how the result set has been narrowed.
 *
 * It replaces four stacked selector bands — mode, scope, category, family —
 * that together cost 142px of a 625px panel. Three of them were filters drawn
 * as tab strips, which meant a permanent band per dimension and no way to ask
 * for two values at once.
 *
 * What remains here is identity: which section, which type, which zone
 * families — "what am I looking at", which belongs beside the results.
 *
 * The narrowing controls and the chips that record them moved into the game's
 * own options bank, because that is where the game already puts filters. Theme
 * and Pack live there as a label and a row of icon buttons, and keeping a
 * second idiom for the same job taught the player two things where one would
 * do.
 */

const SUBCATEGORY_ANY = "Any";

const BuildingLensSection$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");
const BuildingLensSubCategory$ = bindValue<string>(mod.id, "BuildingLensSubCategory", "Any");
const BuildingLensSectionList$ = bindValue<VanillaBuildMenuTab[]>(mod.id, "BuildingLensSectionList", []);
const BuildingLensSubCategoryList$ = bindValue<VanillaBuildMenuTab[]>(mod.id, "BuildingLensSubCategoryList", []);
const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
const BuildingLensMenu$ = bindValue<string>(mod.id, "BuildingLensMenu", "");
const BuildingLensMenuCategory$ = bindValue<string>(mod.id, "BuildingLensMenuCategory", "");
const BuildingLensMenuCategories$ = bindValue<VanillaMenuCategory[]>(mod.id, "BuildingLensMenuCategories", []);
const BuildingLensMenus$ = bindValue<VanillaMenuCategory[]>(mod.id, "BuildingLensMenus", []);

const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState | null>(
  mod.id,
  "BuildingCatalogMetricRanges",
  null
);

type PickerId = "section" | "subCategory" | "menuCategory" | "menu" | null;

export const ChipRow = () => {
  const { translate } = useLocalization();
  const [picker, setPicker] = useState<PickerId>(null);

  const section = useValue(BuildingLensSection$);
  const subCategory = useValue(BuildingLensSubCategory$);
  const sectionList = useValue(BuildingLensSectionList$) ?? [];
  const subCategoryList = useValue(BuildingLensSubCategoryList$) ?? [];
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const menu = useValue(BuildingLensMenu$) ?? "";
  const menuCategory = useValue(BuildingLensMenuCategory$) ?? "";
  const menuCategories = useValue(BuildingLensMenuCategories$) ?? [];
  const menus = useValue(BuildingLensMenus$) ?? [];

  const scopedToMenu = isScopedToMenu(menu);

  // One rule, in its own module so it can be tested: a chip is drawn only when
  // the state it writes is applied to the result. See lensScopeChips.ts.
  const chips = lensScopeChipsFor({
    menu,
    menuCategory,
    menuCategoryCount: menuCategories.length,
    showZoning: false,
    subCategoryCount: subCategoryList.length,
  });

  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const tabLabel = (list: readonly VanillaBuildMenuTab[], id: string) =>
    list.find((tab) => tab.id === id)?.toolTip ?? id;

  // The game's own word for a menu or a category. Two key families, not one —
  // see vanillaServiceLabels.ts for what the running game actually answers.
  const lookup = (key: string) => translate(key, null);
  const menuLabel = (id: string) => resolveVanillaLabel(vanillaMenuNameKeys(id), lookup, id);
  const categoryLabel = (id: string) => resolveVanillaLabel(vanillaCategoryNameKeys(id), lookup, id);

  // readonly, because TriggerCommand declares its args that way and the facet
  // and chip commands do not.
  const fire = (command: { method: string; args: readonly any[] }) =>
    trigger(mod.id, command.method, ...command.args);

  const togglePicker = (id: Exclude<PickerId, null>) =>
    setPicker((current) => (current === id ? null : id));

  const renderBreadcrumb = (
    id: Exclude<PickerId, null>,
    text: string,
    active: boolean,
    onClear: (() => void) | null
  ) => (
    <div className={classNames(styles.chip, styles.breadcrumb, active && styles.breadcrumbActive)} key={id}>
      <Button
        className={styles.breadcrumbLabel}
        variant="icon"
        onSelect={() => togglePicker(id)}
        aria-label={text}
        title={text}
      >
        <span className={styles.chipText}>{text}</span>
        {/* U+25BC, not the small U+25BE — the game's font stack has no small
            triangles, so the breadcrumb carets drew as notdef boxes. */}
        <span className={styles.caret} aria-hidden="true">▼</span>
      </Button>
      {onClear && (
        <Button
          className={styles.chipRemove}
          variant="icon"
          onSelect={onClear}
          aria-label={`${label("Tooltip.LABEL[FindItBuildingMenu.Remove]", "Remove")} ${text}`}
        >
          ×
        </Button>
      )}
    </div>
  );

  const menuTabs: VanillaBuildMenuTab[] = orderedCategories(menus).map((entry) => ({
    id: entry.id,
    icon: entry.icon,
    toolTip: menuLabel(entry.id),
  }));

  const categoryTabs: VanillaBuildMenuTab[] = orderedCategories(menuCategories).map((category) => ({
    id: category.id,
    icon: category.icon,
    toolTip: categoryLabel(category.id),
  }));

  const openList = picker === "section"
    ? sectionList
    : picker === "subCategory"
      ? subCategoryList
      : picker === "menuCategory"
          ? categoryTabs
          : picker === "menu"
            ? menuTabs
            : null;

  const isChosen = (id: string) =>
    picker === "section" ? id === section
      : picker === "subCategory" ? id === subCategory
        : picker === "menuCategory" ? id === menuCategory
          : id === menu;

  const choose = (id: string) => {
    if (picker === "menuCategory") {
      fire({ method: "SetBuildingLensMenuCategory", args: [id] });
      setPicker(null);
      return;
    }

    if (picker === "menu") {
      fire({ method: "SetBuildingLensMenu", args: [id] });
      setPicker(null);
      return;
    }

    fire(picker === "section" ? lensSectionCommand(id) : lensSubCategoryCommand(id));
    setPicker(null);
  };

  const allTypesLabel = label("Tooltip.LABEL[FindItBuildingMenu.AllTypes]", "All types");
  // The same word the strip's extra tab carries, because they are the same
  // choice reached two ways.
  const allCategoriesLabel = label("Tooltip.LABEL[FindItBuildingMenu.AllCategories]", "All");
  const allMenusLabel = label("Tooltip.LABEL[FindItBuildingMenu.AllMenus]", "All menus");

  return (
    <div className={styles.chipRow}>
      <div className={styles.chips}>
        {/* The menu the bottom-bar icon opened, as a chip you can drop.
            A toolbar icon is a shortcut to a preconfigured view, not a box the
            player is shut inside, and until now the scope it applied was
            invisible: nothing on screen said the catalog had been cut to eight
            buildings, and the only way back out was to close the panel. */}
        {chips.menu
          && renderBreadcrumb(
            "menu",
            scopedToMenu ? menuLabel(menu) : allMenusLabel,
            picker === "menu",
            scopedToMenu ? () => fire({ method: "ClearBuildingLensMenuScope", args: [] }) : null
          )}

        {/* The category within it, which the strip also picks. Two ways to the
            same state on purpose: the strip is the fast one, and the chip is
            what makes the row a complete account of why these rows and not
            others. */}
        {chips.menuCategory
          && renderBreadcrumb(
            "menuCategory",
            menuCategory === "" ? allCategoriesLabel : categoryLabel(menuCategory),
            picker === "menuCategory",
            menuCategory === "" ? null : () => fire({ method: "SetBuildingLensMenuCategory", args: [""] })
          )}

        {/* The section and type breadcrumbs describe the building catalog. In
            the zoning view that catalog is not on screen, so showing "Networks"
            over a list of zones names something the player cannot see.

            They are also gone while a menu is scoped, because that is exactly
            when the query stops applying them (BuildingCatalogQueryEngine.cs:95
            skips MatchesBuildMenu for a menu-tree query). They stayed on screen
            through all of it — clickable, restyling themselves on selection,
            and changing nothing. */}
        {chips.section
          && renderBreadcrumb("section", tabLabel(sectionList, section), picker === "section", null)}

        {/* Always offered when the section has types, even at "Any": without
            it the only way back to a type would be the vanilla toolbar. */}
        {chips.subCategory
          && renderBreadcrumb(
            "subCategory",
            subCategory === SUBCATEGORY_ANY ? allTypesLabel : tabLabel(subCategoryList, subCategory),
            picker === "subCategory",
            subCategory === SUBCATEGORY_ANY ? null : () => fire(lensSubCategoryCommand(SUBCATEGORY_ANY))
          )}

        {/* The zoning view has no chip of its own. Its families ARE the Zones
            menu's categories, so the category chip above names them and the
            icon strip picks them — one control, in the same place it sits for
            every other menu.

            There used to be a second, multi-select picker here. It was not
            merely redundant: selecting two families through it produced a state
            the category chip and the strip could not express, and both reported
            it as "All" while the results were filtered to two. The active-filter
            chips in the options bank still list what is selected and still
            remove it, which is the record every other facet gets. */}
      </div>

      {openList && (
        // Absolutely positioned, so an open picker costs nothing in layout —
        // the same reason the rail's popovers replaced the drawers.
        <div className={styles.picker}>
          <Scrollable className={styles.pickerList} vertical trackVisibility="scrollable">
            {openList.map((tab) => (
              <Button
                key={tab.id}
                className={classNames(styles.pickerItem, isChosen(tab.id) && styles.pickerItemSelected)}
                variant="icon"
                onSelect={() => choose(tab.id)}
                aria-label={tab.toolTip}
              >
                <img className={styles.pickerIcon} src={tab.icon} alt="" aria-hidden="true" />
                <span className={styles.pickerLabel}>{tab.toolTip}</span>
              </Button>
            ))}
          </Scrollable>
        </div>
      )}
    </div>
  );
};
