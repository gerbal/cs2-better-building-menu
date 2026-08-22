import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import {
  ALL_CATEGORIES_ID,
  allTabTotal,
  categoryCount,
  isCategorySelected,
  visibleCategories,
  shouldShowCategoryStrip,
  type MenuCategoryCount,
  type VanillaMenuCategory,
} from "domain/vanillaMenuCategories";
import {
  type MenuBranchCount,
  schoolTierTabs,
  romanNumeral,
} from "domain/menuProgression";
import { isEducationMenu, isSchoolCategory } from "domain/buildingGroups";
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
const BuildingLensMilestones$ = bindValue<string[]>(mod.id, "BuildingLensMilestones", []);
const BuildingLensMenuSchoolTierCounts$ = bindValue<MenuBranchCount[]>(
  mod.id,
  "BuildingLensMenuSchoolTierCounts",
  []
);
const BuildingLensMenuSchoolTier$ = bindValue<number>(mod.id, "BuildingLensMenuSchoolTier", -1);
const BuildingLensMenu$ = bindValue<string>(mod.id, "BuildingLensMenu", "");
const BuildingLensStripTabs$ = bindValue<MenuBranchCount[]>(mod.id, "BuildingLensStripTabs", []);
const BuildingLensStripTab$ = bindValue<string[]>(mod.id, "BuildingLensStripTab", []);
const BuildingLensStripAxis$ = bindValue<string>(mod.id, "BuildingLensStripAxis", "");
const BuildingLensExpandedCategory$ = bindValue<string>(mod.id, "BuildingLensExpandedCategory", "");
const BuildingLensExpandedTabs$ = bindValue<MenuBranchCount[]>(
  mod.id,
  "BuildingLensExpandedTabs",
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
  // ALL hooks belong above the early return below. This one was added under it
  // and crashed the UI with React #300 — "rendered fewer hooks than expected" —
  // on every menu the strip hides itself for. Electricity has one category, so
  // clicking it took the early return, ran two hooks where the previous render
  // had run three, and took the whole view down.
  const counts = useValue(BuildingLensMenuCategoryCounts$) ?? [];
  const schoolTierCounts = useValue(BuildingLensMenuSchoolTierCounts$) ?? [];
  const selectedSchoolTier = useValue(BuildingLensMenuSchoolTier$) ?? -1;
  const menu = useValue(BuildingLensMenu$) ?? "";
  const stripTabs = useValue(BuildingLensStripTabs$) ?? [];
  // A LIST, because the filter rail writes the same state and can hold
  // several. The row is still single-select; it just has to show what the rail
  // did rather than only what it set itself.
  const selectedStripTabs = useValue(BuildingLensStripTab$) ?? [];
  const noStripTab = selectedStripTabs.length === 0;
  const stripAxis = useValue(BuildingLensStripAxis$) ?? "";
  const expandedCategory = useValue(BuildingLensExpandedCategory$) ?? "";
  const expandedTabs = useValue(BuildingLensExpandedTabs$) ?? [];

  // Vanilla hides its own row below two categories, and a strip offering one
  // choice is not a choice. Water & Sewage and Zones each have exactly one.
  //
  // The fallback can carry the strip on its own, which is the point of it:
  // them: Electricity is a single category, so the strip drew nothing at all
  // and the menu arrived with no way to cut its 60 assets. Progression is an
  // axis every menu has.
  const showCategories = shouldShowCategoryStrip(categories);
  // Education navigates by LEVEL, not by the milestone a school unlocked at.
  // With several region packs there are dozens of schools per level, which is
  // the scale the strip exists to cut; the milestone they share is not.
  const schoolTiers = schoolTierTabs(schoolTierCounts);
  const showSchoolTiers = isEducationMenu(menu) && schoolTiers.length > 1;
  // The fallback, and the reason the strip exists on a service menu at all.
  // Vanilla splits Roads into nineteen categories and Electricity into one, so
  // the category strip drew nothing exactly where a 60-asset menu needed
  // cutting most. The development tree is the axis those menus DO have —
  // fossil against renewable, police against administration — so it stands in
  // when there are no categories, and stays out of the way when there are.
  const showBranches = !showCategories && stripTabs.length > 1;

  if (!showCategories && !showBranches && !showSchoolTiers) {
    return null;
  }

  const choose = (id: string) => trigger(mod.id, "SetBuildingLensMenuCategory", id);
  const chooseBranch = (id: string) => trigger(mod.id, "SetBuildingLensStripTab", id);
  const chooseSchoolTier = (level: number) =>
    trigger(mod.id, "SetBuildingLensMenuSchoolTier", level);

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
  // The row carries up to two segments and the second one's axis changes per
  // menu — progression on most, school level on Education. Without a word
  // saying which, the same screen position means a different question from one
  // menu to the next, and the row cannot be learned. One small label per
  // segment, not per tab: names on every tab were what made this row
  // unreadable the first time.
  // The count rides in the tooltip whatever the width, because a narrow strip
  // still leaves the player asking how much is behind a glyph.
  const withCount = (text: string, id: string) => {
    const n = categoryCount(counts, id);

    return n === null ? text : `${text} (${n})`;
  };
  // One number for "All" whichever axis the row draws — see allTabTotal for
  // why the branch tabs cannot supply it.
  const allTotal = allTabTotal(counts, stripTabs);
  const withBranchCount = (text: string, id: string) =>
    `${text} (${id === "" ? allTotal : categoryCount(stripTabs, id) ?? 0})`;

  const { ToolButton, toolButtonTheme, FOCUS_DISABLED } = VanillaComponentResolver.instance;

  return (
    <div className={styles.strip}>
      {showCategories && (
        <>
      {/* One more tab than vanilla has. Vanilla always opens on a category and
          offers no way back out to the whole menu; the lens can show the menu
          entire, which is the thing it can do that the vanilla menu cannot. */}
      {/* All means all: no category AND no level. Picking a level clears the
          category — they are alternatives in this row — so testing the
          category alone lit All up beside the level the player had just
          chosen. */}
      <ToolButton
        selected={
          isCategorySelected(ALL_CATEGORIES_ID, selected) &&
          selectedSchoolTier < 0 &&
          noStripTab
        }
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
          isCategorySelected(ALL_CATEGORIES_ID, selected) &&
            selectedSchoolTier < 0 &&
            noStripTab &&
            styles.tabSelected
        )}
        aria-label={withCount(allLabel, ALL_CATEGORIES_ID)}
      >
        {/* The menu's whole size, and the only always-visible statement of it.
            The footer says "Showing 100 of 368" but sits below the scroll, so
            on arrival the truncation is invisible; this is on screen before the
            player has moved anything. */}
        <span className={styles.allLabel}>
          {allLabel}
          {categoryCount(counts, ALL_CATEGORIES_ID) !== null && (
            <span className={styles.allCount}>{categoryCount(counts, ALL_CATEGORIES_ID)}</span>
          )}
        </span>
      </ToolButton>

      {/* The school levels stand in for the Education category, in ITS place
          and in the same row, so the menu reads as one list of choices:
          four ranks of school, then Research. They partition that category
          exactly — ten schools, 3/3/1/3 — so nothing is lost by drawing them
          instead of it, and a separate tier segment would have asked the
          player to combine two rows to reach what one row can say. */}
      {visibleCategories(categories, counts).flatMap((category) =>
        showSchoolTiers && isSchoolCategory(category.id)
          ? schoolTiers.map((tier) => (
              <ToolButton
                key={`tier-${tier.level}`}
                selected={selectedSchoolTier === tier.level}
                tooltip={`${tier.label} (${tier.count})`}
                onSelect={() => chooseSchoolTier(tier.level)}
                src={tier.icon || category.icon}
                focusKey={FOCUS_DISABLED}
                className={classNames(
                  toolButtonTheme.button,
                  styles.tab,
                  selectedSchoolTier === tier.level && styles.tabSelected
                )}
                aria-label={`${tier.label} (${tier.count})`}
              >
                <span className={styles.tierBadge}>
                  <span className={styles.tierNumeral}>{romanNumeral(tier.level)}</span>
                  <span className={styles.tabCount}>{tier.count}</span>
                </span>
              </ToolButton>
            ))
          : expandedTabs.length > 1 && category.id === expandedCategory
          ? expandedTabs.map((branch) => (
              <ToolButton
                key={`branch-${branch.id}`}
                selected={selectedStripTabs.includes(branch.id)}
                tooltip={`${branch.id} (${branch.count})`}
                onSelect={() => chooseBranch(branch.id)}
                src={branch.icon || category.icon}
                focusKey={FOCUS_DISABLED}
                className={classNames(
                  toolButtonTheme.button,
                  styles.tab,
                  selectedStripTabs.includes(branch.id) && styles.tabSelected
                )}
                aria-label={`${branch.id} (${branch.count})`}
              >
                {/* No numeral here, unlike the school levels. Each unlock
                    ships its own icon, so the tabs are already told apart by
                    what they are; a rank would be a second ordering the player
                    did not ask for. The levels need one because all four draw
                    the same mortarboard. */}
                <span className={styles.tabCount}>{branch.count}</span>
              </ToolButton>
            ))
          : [
        <ToolButton
          key={category.id}
          selected={
            isCategorySelected(category.id, selected) &&
            selectedSchoolTier < 0 &&
            noStripTab
          }
          tooltip={withCount(label(category), category.id)}
          onSelect={() => choose(category.id)}
          src={category.icon}
          focusKey={FOCUS_DISABLED}
          className={classNames(
            toolButtonTheme.button,
            styles.tab,
            isCategorySelected(category.id, selected) &&
              selectedSchoolTier < 0 &&
              noStripTab &&
              styles.tabSelected
          )}
          aria-label={withCount(label(category), category.id)}
        >
          {/* The count, not the name. Names on every tab were reported as
              disruptive, and they were: fourteen worded tabs wrapped a
              one-line strip to three rows and pushed the results down. The
              name lives in the tooltip, where vanilla puts it too.
              The number stays on the tab because it is what the strip could
              not say before — which of fourteen glyphs is worth opening —
              and two or three digits keeps the row one line. */}
          <span className={styles.tabCount}>{categoryCount(counts, category.id) ?? ""}</span>
        </ToolButton>,
            ]
      )}
        </>
      )}

      {showBranches && (
        <>
          <ToolButton
            selected={noStripTab}
            tooltip={withBranchCount(allLabel, "")}
            onSelect={() => chooseBranch("")}
            src=""
            focusKey={FOCUS_DISABLED}
            className={classNames(
              toolButtonTheme.button,
              styles.tab,
              styles.allTab,
              noStripTab && styles.tabSelected
            )}
            aria-label={withBranchCount(allLabel, "")}
          >
            <span className={styles.allLabel}>
              {allLabel}
              <span className={styles.allCount}>{allTotal}</span>
            </span>
          </ToolButton>

          {/* Iconed where the axis has icons, worded where it does not — see
              the tab body below. Either way there are only two or three per
              menu, so the row stays one line. */}
          {stripTabs.map((branch) => (
            <ToolButton
              key={branch.id}
              selected={selectedStripTabs.includes(branch.id)}
              tooltip={withBranchCount(branch.id, branch.id)}
              onSelect={() => chooseBranch(branch.id)}
              src={branch.icon || ""}
              focusKey={FOCUS_DISABLED}
              className={classNames(
                toolButtonTheme.button,
                styles.tab,

                selectedStripTabs.includes(branch.id) && styles.tabSelected
              )}
              aria-label={withBranchCount(branch.id, branch.id)}
            >
              {/* Glyph and count when there IS a glyph, which is the
                  treatment the category tabs use and why the dev tree's icons
                  were worth resolving. The asset-type axis has none — the game
                  ships no icon for "Buildings" or "Networks" — and an iconless
                  tab showing only a number is a tab with nothing on it, so
                  that axis falls back to its word. */}
              <span className={styles.tabCount}>{branch.count}</span>
            </ToolButton>
          ))}
        </>
      )}

    </div>
  );
};
