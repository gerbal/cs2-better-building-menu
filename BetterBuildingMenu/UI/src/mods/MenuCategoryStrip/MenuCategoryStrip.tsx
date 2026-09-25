import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import {
  ALL_CATEGORIES_ID,
  allTabTotal,
  categoryCount,
  isCategorySelected,
  visibleCategories,
  shouldShowCategoryStrip,
  isLensScoped,
  type VanillaMenuCategory,
} from "domain/vanillaMenuCategories";
import { expandedTabsFor, branchTabTooltip, schoolTierTabs, romanNumeral } from "domain/menuProgression";
import { isEducationMenu, isSchoolCategory } from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import styles from "./menuCategoryStrip.module.scss";
import {
  BuildingLensExpandedCategories$,
  BuildingLensMenu$,
  BuildingLensMenuCategories$,
  BuildingLensMenuCategory$,
  BuildingLensMenuCategoryCounts$,
  BuildingLensMenuSchoolTier$,
  BuildingLensMenuSchoolTierCounts$,
  BuildingLensStripTab$,
  BuildingLensStripTabs$,
  send,
} from "mods/bindings";

/**
 * Vanilla's second tier, rebuilt: the categories, tiers or branches that cut one
 * menu. Built from the game's own ToolButton rather than a lookalike, so the
 * tabs carry vanilla's sizing, hover and selected treatment for free.
 */
export const MenuCategoryStrip = () => {
  const { translate } = useLocalization();
  const categories = useValue(BuildingLensMenuCategories$);
  const selected = useValue(BuildingLensMenuCategory$);
  // ALL hooks belong above the early return below. One under it renders
  // conditionally, and React #300 takes the whole view down on any menu the
  // strip hides itself for. A test asserts the ordering on this file's source.
  const counts = useValue(BuildingLensMenuCategoryCounts$) ?? [];
  const schoolTierCounts = useValue(BuildingLensMenuSchoolTierCounts$) ?? [];
  const selectedSchoolTier = useValue(BuildingLensMenuSchoolTier$) ?? -1;
  const menu = useValue(BuildingLensMenu$) ?? "";
  const stripTabs = useValue(BuildingLensStripTabs$) ?? [];
  // A LIST, because the filter rail writes the same state and can hold several.
  // The row stays single-select but has to show what the rail did.
  const selectedStripTabs = useValue(BuildingLensStripTab$) ?? [];
  const noStripTab = selectedStripTabs.length === 0;
  const expandedCategories = useValue(BuildingLensExpandedCategories$) ?? [];

  // Vanilla hides its own row below two categories, and a strip offering one
  // choice is not a choice. The branch fallback below carries the strip on the
  // single-category menus, so they are not left with no way to cut themselves.
  const showCategories = shouldShowCategoryStrip(categories, menu);
  // Every segment obeys the scope, not only the categories: the all-menus scope
  // has branches too, and the fallback below would otherwise draw them.
  const scoped = isLensScoped(menu);
  // Education navigates by LEVEL, not by the milestone a school unlocked at:
  // with several region packs the level is what has dozens behind it, and the
  // milestone they share cuts nothing.
  const schoolTiers = schoolTierTabs(schoolTierCounts, translate);
  const showSchoolTiers = scoped && isEducationMenu(menu) && schoolTiers.length > 1;
  // The fallback, and why the strip exists on a service menu at all: vanilla
  // gives some menus one category and no way to cut them. The development tree
  // is the axis those menus do have, so it stands in where categories cannot.
  const showBranches = scoped && !showCategories && stripTabs.length > 1;

  if (!showCategories && !showBranches && !showSchoolTiers) {
    return null;
  }

  const choose = (id: string) => send({ method: "SetBuildingLensMenuCategory", args: [id] });
  const chooseBranch = (id: string) => send({ method: "SetBuildingLensStripTab", args: [id] });
  const chooseSchoolTier = (level: number) =>
    send({ method: "SetBuildingLensMenuSchoolTier", args: [level] });

  // The category prefab's own name is the id, and the game ships a localized
  // string under exactly that id, so a tab reads as the game words it rather
  // than as a raw prefab name. See vanillaServiceLabels.ts.
  const label = (category: VanillaMenuCategory) =>
    resolveVanillaLabel(
      vanillaCategoryNameKeys(category.id),
      (key) => translate(key, null),
      category.name
    );

  const allLabel = translate("Tooltip.LABEL[BetterBuildingMenu.AllCategories]", "All") ?? "All";
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
      {/* One more tab than vanilla has: it always opens on a category and
          offers no way back out to the whole menu. */}
      {/* All means all — no category AND no level. They are alternatives in
          this row, so testing the category alone would light All up beside
          the level the player just chose. */}
      <ToolButton
        selected={
          isCategorySelected(ALL_CATEGORIES_ID, selected) &&
          selectedSchoolTier < 0 &&
          noStripTab
        }
        tooltip={withCount(allLabel, ALL_CATEGORIES_ID)}
        onSelect={() => choose(ALL_CATEGORIES_ID)}
        // Required by the component, and there is no icon for "all", so the
        // tab carries a word instead.
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
        {/* The menu's whole size, and the only always-visible statement of it:
            the footer's count sits below the scroll, so on arrival the
            truncation is otherwise invisible. */}
        <span className={styles.allLabel}>
          {allLabel}
          {categoryCount(counts, ALL_CATEGORIES_ID) !== null && (
            <span className={styles.allCount}>{categoryCount(counts, ALL_CATEGORIES_ID)}</span>
          )}
        </span>
      </ToolButton>

      {/* The school levels stand in for the Education category, in ITS place,
          so the menu stays one row of choices. They partition that category
          exactly, so nothing is lost by drawing them instead of it. */}
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
          : expandedTabsFor(expandedCategories, category.id).length > 1
          ? expandedTabsFor(expandedCategories, category.id).map((branch) => (
              <ToolButton
                key={`branch-${branch.id}`}
                selected={selectedStripTabs.includes(branch.id)}
                tooltip={`${branchTabTooltip(branch, label(category))} (${branch.count})`}
                onSelect={() => chooseBranch(branch.id)}
                src={branch.icon || category.icon}
                focusKey={FOCUS_DISABLED}
                className={classNames(
                  toolButtonTheme.button,
                  styles.tab,
                  selectedStripTabs.includes(branch.id) && styles.tabSelected
                )}
                aria-label={`${branchTabTooltip(branch, label(category))} (${branch.count})`}
              >
                {/* No numeral here, unlike the school levels: each unlock
                    ships its own icon, so the tabs are already told apart and
                    a rank would be an ordering nobody asked for. */}
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
          {/* The count, not the name: worded tabs wrap the strip to three rows
              and push the results down, while two or three digits keep it one
              line. The name lives in the tooltip, where vanilla puts it. */}
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
              the tab body below. Either way there are only a few per menu. */}
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
              {/* Glyph and count where there IS a glyph, as the category tabs
                  do. The asset-type axis has none, and a tab showing only a
                  number has nothing on it, so that axis falls back to a word. */}
              <span className={styles.tabCount}>{branch.count}</span>
            </ToolButton>
          ))}
        </>
      )}

    </div>
  );
};
