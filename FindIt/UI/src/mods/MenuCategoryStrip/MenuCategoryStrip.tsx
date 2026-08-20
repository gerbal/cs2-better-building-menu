import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import {
  ALL_CATEGORIES_ID,
  categoryCount,
  isCategorySelected,
  visibleCategories,
  shouldShowCategoryStrip,
  type MenuCategoryCount,
  type VanillaMenuCategory,
} from "domain/vanillaMenuCategories";
import {
  ANY_MILESTONE,
  type MenuBranchCount,
  isMilestoneSelected,
  milestoneTabs,
  shouldShowMilestoneTabs,
  type MenuMilestoneCount,
} from "domain/menuProgression";
import { milestoneLabel } from "domain/buildingGroups";
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
const BuildingLensMenuMilestoneCounts$ = bindValue<MenuMilestoneCount[]>(
  mod.id,
  "BuildingLensMenuMilestoneCounts",
  []
);
const BuildingLensMenuMilestone$ = bindValue<number>(
  mod.id,
  "BuildingLensMenuMilestone",
  ANY_MILESTONE
);
const BuildingLensMilestones$ = bindValue<string[]>(mod.id, "BuildingLensMilestones", []);
const BuildingLensMilestoneIcons$ = bindValue<string[]>(mod.id, "BuildingLensMilestoneIcons", []);
const BuildingLensMenuBranchCounts$ = bindValue<MenuBranchCount[]>(
  mod.id,
  "BuildingLensMenuBranchCounts",
  []
);
const BuildingLensMenuBranch$ = bindValue<string>(mod.id, "BuildingLensMenuBranch", "");

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
  const milestoneCounts = useValue(BuildingLensMenuMilestoneCounts$) ?? [];
  const selectedMilestone = useValue(BuildingLensMenuMilestone$) ?? ANY_MILESTONE;
  const milestoneNames = useValue(BuildingLensMilestones$) ?? [];
  const milestoneIcons = useValue(BuildingLensMilestoneIcons$) ?? [];
  const branchCounts = useValue(BuildingLensMenuBranchCounts$) ?? [];
  const selectedBranch = useValue(BuildingLensMenuBranch$) ?? "";

  const tiers = milestoneTabs(milestoneCounts, (milestone) =>
    milestoneLabel(milestone, milestoneNames)
  );
  // Vanilla hides its own row below two categories, and a strip offering one
  // choice is not a choice. Water & Sewage and Zones each have exactly one.
  //
  // The tiers can carry the strip on their own, which is the point of adding
  // them: Electricity is a single category, so the strip drew nothing at all
  // and the menu arrived with no way to cut its 60 assets. Progression is an
  // axis every menu has.
  const showCategories = shouldShowCategoryStrip(categories);
  const showTiers = shouldShowMilestoneTabs(tiers);
  // The fallback, and the reason the strip exists on a service menu at all.
  // Vanilla splits Roads into nineteen categories and Electricity into one, so
  // the category strip drew nothing exactly where a 60-asset menu needed
  // cutting most. The development tree is the axis those menus DO have —
  // fossil against renewable, police against administration — so it stands in
  // when there are no categories, and stays out of the way when there are.
  const showBranches = !showCategories && branchCounts.length > 1;

  if (!showCategories && !showBranches && !showTiers) {
    return null;
  }

  const choose = (id: string) => trigger(mod.id, "SetBuildingLensMenuCategory", id);
  const chooseBranch = (id: string) => trigger(mod.id, "SetBuildingLensMenuBranch", id);
  const chooseTier = (milestone: number) =>
    trigger(mod.id, "SetBuildingLensMenuMilestone", milestone);

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
  const anyTierLabel =
    translate("Tooltip.LABEL[FindItBuildingMenu.AllProgressionTiers]", "All tiers") ?? "All tiers";
  const totalTierCount = tiers.reduce((total, tier) => total + tier.count, 0);
  const tierTooltip = (text: string, n: number) => `${text} (${n})`;
  const branchTotal = branchCounts.reduce((total, branch) => total + branch.count, 0);
  const withBranchCount = (text: string, id: string) =>
    `${text} (${id === "" ? branchTotal : categoryCount(branchCounts, id) ?? 0})`;
  // The count rides in the tooltip whatever the width, because a narrow strip
  // still leaves the player asking how much is behind a glyph.
  const withCount = (text: string, id: string) => {
    const n = categoryCount(counts, id);

    return n === null ? text : `${text} (${n})`;
  };
  const { ToolButton, toolButtonTheme, FOCUS_DISABLED } = VanillaComponentResolver.instance;

  return (
    <div className={styles.strip}>
      {showCategories && (
        <>
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
          {categoryCount(counts, ALL_CATEGORIES_ID) !== null && (
            <span className={styles.tabCount}>{categoryCount(counts, ALL_CATEGORIES_ID)}</span>
          )}
        </span>
      </ToolButton>

      {visibleCategories(categories, counts).map((category) => (
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
            isCategorySelected(category.id, selected) && styles.tabSelected
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
        </ToolButton>
      ))}
        </>
      )}

      {showBranches && (
        <>
          <ToolButton
            selected={selectedBranch === ""}
            tooltip={withBranchCount(allLabel, "")}
            onSelect={() => chooseBranch("")}
            src=""
            focusKey={FOCUS_DISABLED}
            className={classNames(
              toolButtonTheme.button,
              styles.tab,
              styles.allTab,
              selectedBranch === "" && styles.tabSelected
            )}
            aria-label={withBranchCount(allLabel, "")}
          >
            <span className={styles.allLabel}>
              {allLabel}
              <span className={styles.tabCount}>{branchTotal}</span>
            </span>
          </ToolButton>

          {/* Worded, like the tier tabs and for the same reason: the game ships
              no icon for a development-tree branch. There are two or three per
              service and the names are short ("Hospital", "Police
              Headquarters"), so the row still reads as one line. */}
          {branchCounts.map((branch) => (
            <ToolButton
              key={branch.id}
              selected={selectedBranch === branch.id}
              tooltip={withBranchCount(branch.id, branch.id)}
              onSelect={() => chooseBranch(branch.id)}
              src={branch.icon || ""}
              focusKey={FOCUS_DISABLED}
              className={classNames(
                toolButtonTheme.button,
                styles.tab,
                branch.icon ? undefined : styles.tierTab,
                selectedBranch === branch.id && styles.tabSelected
              )}
              aria-label={withBranchCount(branch.id, branch.id)}
            >
              {/* Glyph and count, name in the tooltip — the treatment the
                  category tabs already use, and the reason the icons were
                  worth resolving: worded tabs on this row were reported as
                  disruptive, and the dev tree ships an icon per node. */}
              <span className={styles.tabCount}>{branch.count}</span>
            </ToolButton>
          ))}
        </>
      )}

      {/* The progression segment, in the same row and after a rule, because the
          two are not alternatives: a tier narrows whatever category is showing.
          The backend counts them that way too — pick Vegetation and the tiers
          count Vegetation only.

          Worded like the All tab rather than glyphed like the categories,
          because the game ships no icon for a milestone — and unlike the
          category tabs, whose names were reported as disruptive, a tier has
          nothing else to show. The bare index was tried first and is not a
          label: "0" and "1" name nothing a player recognises, while the game's
          own HUD says "Founding" two inches away. Milestone names are short
          and a menu spans a handful of tiers, so the row still reads. */}
      {showTiers && (
        <>
          {(showCategories || showBranches) && <div className={styles.segmentRule} />}
          <ToolButton
            selected={isMilestoneSelected(ANY_MILESTONE, selectedMilestone)}
            tooltip={tierTooltip(anyTierLabel, totalTierCount)}
            onSelect={() => chooseTier(ANY_MILESTONE)}
            src=""
            focusKey={FOCUS_DISABLED}
            className={classNames(
              toolButtonTheme.button,
              styles.tab,
              styles.allTab,
              isMilestoneSelected(ANY_MILESTONE, selectedMilestone) && styles.tabSelected
            )}
            aria-label={tierTooltip(anyTierLabel, totalTierCount)}
          >
            <span className={styles.allLabel}>{anyTierLabel}</span>
          </ToolButton>

          {tiers.map((tier) => (
            <ToolButton
              key={tier.milestone}
              selected={isMilestoneSelected(tier.milestone, selectedMilestone)}
              tooltip={tierTooltip(tier.label, tier.count)}
              onSelect={() => chooseTier(tier.milestone)}
              src={milestoneIcons[tier.milestone] || ""}
              focusKey={FOCUS_DISABLED}
              className={classNames(
                toolButtonTheme.button,
                styles.tab,
                milestoneIcons[tier.milestone] ? undefined : styles.tierTab,
                isMilestoneSelected(tier.milestone, selectedMilestone) && styles.tabSelected
              )}
              aria-label={tierTooltip(tier.label, tier.count)}
            >
              {milestoneIcons[tier.milestone] ? (
                <span className={styles.tabCount}>{tier.count}</span>
              ) : (
                <span className={styles.tierLabel}>
                  {tier.label}
                  <span className={styles.tierCount}>{tier.count}</span>
                </span>
              )}
            </ToolButton>
          ))}
        </>
      )}
    </div>
  );
};
