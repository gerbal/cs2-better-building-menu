import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import {
  ALL_CATEGORIES_ID,
  categoryCount,
  isCategorySelected,
  orderedCategories,
  shouldShowCategoryStrip,
  shouldWidenCategoryStrip,
  type MenuCategoryCount,
  type VanillaMenuCategory,
} from "domain/vanillaMenuCategories";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import styles from "./menuCategoryStrip.module.scss";

const BuildingLensMenuCategories$ = bindValue<VanillaMenuCategory[]>(
  mod.id,
  "BuildingLensMenuCategories",
  []
);
const BuildingLensMenuCategory$ = bindValue<string>(mod.id, "BuildingLensMenuCategory", "");
const BuildingLensMenuCategoryCounts$ = bindValue<MenuCategoryCount[]>(
  mod.id,
  "BuildingLensMenuCategoryCounts",
  []
);

/**
 * Vanilla's second tier, rebuilt.
 *
 * Clicking a vanilla toolbar icon scopes the lens to that menu, which is right
 * but not sufficient: vanilla then splits the menu into categories, and we drew
 * all of them as one list. Transportation is six modes shown as 53
 * undifferentiated rows.
 *
 * Built from the game's own ToolButton rather than a hand-styled lookalike, so
 * the tabs carry vanilla's sizing, hover and selected treatment for free — the
 * same reasoning that put the filter rail on ToolButton. The strip is chrome,
 * and chrome should be the game's.
 */
export const MenuCategoryStrip = () => {
  const { translate } = useLocalization();
  const categories = useValue(BuildingLensMenuCategories$);
  const selected = useValue(BuildingLensMenuCategory$);

  // Vanilla hides its own row below two categories, and a strip offering one
  // choice is not a choice. Water & Sewage and Zones each have exactly one.
  if (!shouldShowCategoryStrip(categories)) {
    return null;
  }

  const choose = (id: string) => trigger(mod.id, "SetBuildingLensMenuCategory", id);

  // The category prefab's own name is the id, and the game ships a localized
  // string under exactly that id — SubServices.NAME[TransportationRoad] is
  // "Road". This asked for Assets.SUB_SERVICE_NAME then Assets.NAME, neither of
  // which is a key family CS2 has, so every tab here fell back to the raw
  // prefab name in every language. See vanillaServiceLabels.ts.
  const label = (category: VanillaMenuCategory) =>
    resolveVanillaLabel(
      vanillaCategoryNameKeys(category.id),
      (key) => translate(key, null),
      category.name
    );

  const allLabel = translate("Tooltip.LABEL[FindItBuildingMenu.AllCategories]", "All") ?? "All";
  const counts = useValue(BuildingLensMenuCategoryCounts$) ?? [];
  // Above six tabs the row stops being scannable as glyphs — see
  // CATEGORY_STRIP_WIDE_THRESHOLD. Wide tabs carry the name and the count.
  const wide = shouldWidenCategoryStrip(categories);
  // The count rides in the tooltip whatever the width, because a narrow strip
  // still leaves the player asking how much is behind a glyph.
  const withCount = (text: string, id: string) => {
    const n = categoryCount(counts, id);

    return n === null ? text : `${text} (${n})`;
  };
  const { ToolButton, toolButtonTheme, FOCUS_DISABLED } = VanillaComponentResolver.instance;

  return (
    <div className={styles.strip}>
      {/* One more tab than vanilla has. Vanilla always opens on a category and
          offers no way back out to the whole menu; the lens can show the menu
          entire, which is the thing it can do that the vanilla menu cannot. */}
      <ToolButton
        selected={isCategorySelected(ALL_CATEGORIES_ID, selected)}
        tooltip={withCount(allLabel, ALL_CATEGORIES_ID)}
        onSelect={() => choose(ALL_CATEGORIES_ID)}
        // Required by the component, and there is no icon for "all" — the tab
        // carries a word instead. Same as the filter rail does for a dimension
        // with no glyph.
        src=""
        focusKey={FOCUS_DISABLED}
        className={classNames(
          toolButtonTheme.button,
          styles.tab,
          styles.allTab,
          isCategorySelected(ALL_CATEGORIES_ID, selected) && styles.tabSelected
        )}
        aria-label={withCount(allLabel, ALL_CATEGORIES_ID)}
      >
        {/* The menu's whole size, and the only always-visible statement of it.
            The footer says "Showing 100 of 368" but sits below the scroll, so
            on arrival the truncation is invisible; this is on screen before the
            player has moved anything. */}
        <span className={styles.allLabel}>
          {allLabel}
          {wide && categoryCount(counts, ALL_CATEGORIES_ID) !== null && (
            <span className={styles.tabCount}>{categoryCount(counts, ALL_CATEGORIES_ID)}</span>
          )}
        </span>
      </ToolButton>

      {orderedCategories(categories).map((category) => (
        <ToolButton
          key={category.id}
          selected={isCategorySelected(category.id, selected)}
          tooltip={withCount(label(category), category.id)}
          onSelect={() => choose(category.id)}
          src={category.icon}
          focusKey={FOCUS_DISABLED}
          className={classNames(
            toolButtonTheme.button,
            styles.tab,
            wide && styles.tabWide,
            isCategorySelected(category.id, selected) && styles.tabSelected
          )}
          aria-label={withCount(label(category), category.id)}
        >
          {wide
            ? (
              <span className={styles.tabLabel}>
                {label(category)}
                <span className={styles.tabCount}>{categoryCount(counts, category.id) ?? ""}</span>
              </span>
            )
            : <span />}
        </ToolButton>
      ))}
    </div>
  );
};
