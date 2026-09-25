import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { useState } from "react";
import { visibleCategories } from "domain/vanillaMenuCategories";
import { isScopedToMenu, lensScopeChipsFor } from "domain/lensScopeChips";
import {
  resolveVanillaLabel,
  vanillaCategoryNameKeys,
  vanillaMenuNameKeys,
} from "domain/vanillaServiceLabels";
import styles from "./chipRow.module.scss";
import {
  BuildingLensMenu$,
  BuildingLensMenuCategories$,
  BuildingLensMenuCategory$,
  BuildingLensMenuCategoryCounts$,
  BuildingLensMenus$,
  send,
} from "mods/bindings";

/** One row of a picker: an id to fire, an icon to draw, a name to read. */
interface VanillaBuildMenuTab {
  id: string;
  icon: string;
  toolTip: string;
}

/**
 * The band that says what the player is looking at: which menu, and which
 * category within it. Identity only — the narrowing controls and the chips
 * that record them live in the control pane beside the results.
 */

type PickerId = "menuCategory" | "menu" | null;

export const ChipRow = () => {
  const { translate } = useLocalization();
  const [picker, setPicker] = useState<PickerId>(null);

  const menu = useValue(BuildingLensMenu$) ?? "";
  const menuCategory = useValue(BuildingLensMenuCategory$) ?? "";
  const menuCategories = useValue(BuildingLensMenuCategories$) ?? [];
  const menuCategoryCounts = useValue(BuildingLensMenuCategoryCounts$) ?? [];
  const menus = useValue(BuildingLensMenus$) ?? [];

  const scopedToMenu = isScopedToMenu(menu);

  // One rule, in its own module so it can be tested: a chip is drawn only when
  // the state it writes is applied to the result. See lensScopeChips.ts.
  const chips = lensScopeChipsFor({
    menu,
    menuCategory,
    menuCategoryCount: menuCategories.length,
  });

  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  // The game's own word for a menu or a category. Two key families, not one —
  // see vanillaServiceLabels.ts.
  const lookup = (key: string) => translate(key, null);
  const menuLabel = (id: string) => resolveVanillaLabel(vanillaMenuNameKeys(id), lookup, id);
  const categoryLabel = (id: string) => resolveVanillaLabel(vanillaCategoryNameKeys(id), lookup, id);

  const fire = send;

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
          aria-label={`${label("Tooltip.LABEL[BetterBuildingMenu.Remove]", "Remove")} ${text}`}
        >
          ×
        </Button>
      )}
    </div>
  );

  // In the order the index sends them, which is the bottom bar's: toolbar group
  // first, then priority. A re-sort by priority alone would undo the groups.
  const menuTabs: VanillaBuildMenuTab[] = menus.map((entry) => ({
    id: entry.id,
    icon: entry.icon,
    toolTip: menuLabel(entry.id),
  }));

  // The categories the strip shows. It hides one with nothing behind it, and
  // this is the same choice reached another way, so it is left out here too.
  const categoryTabs: VanillaBuildMenuTab[] = visibleCategories(menuCategories, menuCategoryCounts).map((category) => ({
    id: category.id,
    icon: category.icon,
    toolTip: categoryLabel(category.id),
  }));

  const openList = picker === "menuCategory"
    ? categoryTabs
    : picker === "menu"
      ? menuTabs
      : null;

  const isChosen = (id: string) => (picker === "menuCategory" ? id === menuCategory : id === menu);

  const choose = (id: string) => {
    fire(
      picker === "menuCategory"
        ? { method: "SetBuildingLensMenuCategory", args: [id] }
        : { method: "SetBuildingLensMenu", args: [id] }
    );
    setPicker(null);
  };

  // The same word the strip's extra tab carries, because they are the same
  // choice reached two ways.
  const allCategoriesLabel = label("Tooltip.LABEL[BetterBuildingMenu.AllCategories]", "All");
  const allMenusLabel = label("Tooltip.LABEL[BetterBuildingMenu.AllMenus]", "All menus");

  return (
    <div className={styles.chipRow}>
      <div className={styles.chips}>
        {/* The menu the bottom-bar icon opened, as a chip you can drop: a
            toolbar icon is a shortcut to a preconfigured view, not a box the
            player is shut inside, and the scope it applies is otherwise
            invisible. */}
        {chips.menu
          && renderBreadcrumb(
            "menu",
            scopedToMenu ? menuLabel(menu) : allMenusLabel,
            picker === "menu",
            scopedToMenu ? () => fire({ method: "ClearBuildingLensMenuScope", args: [] }) : null
          )}

        {/* The category within it, which the strip also picks. Two ways to one
            state on purpose: the strip is the fast one, and the chip is what
            makes this row a complete account of the scope. */}
        {chips.menuCategory
          && renderBreadcrumb(
            "menuCategory",
            menuCategory === "" ? allCategoriesLabel : categoryLabel(menuCategory),
            picker === "menuCategory",
            menuCategory === "" ? null : () => fire({ method: "SetBuildingLensMenuCategory", args: [""] })
          )}

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
