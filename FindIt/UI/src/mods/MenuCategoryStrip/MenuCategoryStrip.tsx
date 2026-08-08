import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import {
  ALL_CATEGORIES_ID,
  isCategorySelected,
  orderedCategories,
  shouldShowCategoryStrip,
  type VanillaMenuCategory,
} from "domain/vanillaMenuCategories";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import styles from "./menuCategoryStrip.module.scss";

const BuildingLensMenuCategories$ = bindValue<VanillaMenuCategory[]>(
  mod.id,
  "BuildingLensMenuCategories",
  []
);
const BuildingLensMenuCategory$ = bindValue<string>(mod.id, "BuildingLensMenuCategory", "");

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
  // string under exactly that id — Services.NAME[TransportationRoad] is "Road".
  //
  // This asked for Assets.SUB_SERVICE_NAME and Assets.NAME first, and neither
  // is a key family the game has: measured against Locale.cok there are 67
  // Services.NAME entries covering menus AND categories together, and zero of
  // either of the others. So every tab in this strip has been falling back to
  // the raw prefab name in every language.
  const label = (category: VanillaMenuCategory) =>
    translate(`Services.NAME[${category.id}]`, null) ?? category.name;

  const allLabel = translate("Tooltip.LABEL[FindItBuildingMenu.AllCategories]", "All") ?? "All";
  const { ToolButton, toolButtonTheme, FOCUS_DISABLED } = VanillaComponentResolver.instance;

  return (
    <div className={styles.strip}>
      {/* One more tab than vanilla has. Vanilla always opens on a category and
          offers no way back out to the whole menu; the lens can show the menu
          entire, which is the thing it can do that the vanilla menu cannot. */}
      <ToolButton
        selected={isCategorySelected(ALL_CATEGORIES_ID, selected)}
        tooltip={allLabel}
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
        aria-label={allLabel}
      >
        <span className={styles.allLabel}>{allLabel}</span>
      </ToolButton>

      {orderedCategories(categories).map((category) => (
        <ToolButton
          key={category.id}
          selected={isCategorySelected(category.id, selected)}
          tooltip={label(category)}
          onSelect={() => choose(category.id)}
          src={category.icon}
          focusKey={FOCUS_DISABLED}
          className={classNames(
            toolButtonTheme.button,
            styles.tab,
            isCategorySelected(category.id, selected) && styles.tabSelected
          )}
          aria-label={label(category)}
        >
          <span />
        </ToolButton>
      ))}
    </div>
  );
};
