import { useEffect, useRef, useState } from "react";
import { bindValue, trigger, useValue } from "cs2/api";
import { getModule } from "cs2/modding";
import { Tooltip } from "cs2/ui";
import classNames from "classnames";
import mod from "../../../mod.json";
import { resolveAxis, type AxisCandidate } from "domain/menuAxisMap";
import {
  lensSectionCommand,
  lensSubCategoryCommand,
  type VanillaBuildMenuTab,
} from "domain/vanillaBuildMenuContracts";
import styles from "./tabStrip.module.scss";

// The game's own asset-category tab bar. Measured at 45rem tall with 39rem
// icons, which is the whole chrome budget vanilla spends above its grid.
const AssetCategoryTabTheme: any = getModule(
  "game-ui/game/components/asset-menu/asset-category-tab-bar/asset-category-tab-bar.module.scss",
  "classes"
);

const Section$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");
const SubCategory$ = bindValue<string>(mod.id, "BuildingLensSubCategory", "Any");
const SectionList$ = bindValue<VanillaBuildMenuTab[]>(mod.id, "BuildingLensSectionList", []);
const SubCategoryList$ = bindValue<VanillaBuildMenuTab[]>(mod.id, "BuildingLensSubCategoryList", []);
const MenuToolTip$ = bindValue<string>(mod.id, "BuildingLensMenuToolTip", "");

// The game's balloon tooltip has no delay prop of its own (see TooltipProps
// in types/ui.d.ts) — it just appears on hover, on whatever schedule the
// native implementation picks. On an icon-only strip that reads as slow, so
// we drive `forceVisible` on our own clock instead. 150ms is short enough
// that a deliberate pause on one icon feels immediate, long enough that
// sweeping the cursor across the row does not flash a tooltip per icon.
const HOVER_DELAY_MS = 150;

export const TabStrip = () => {
  const section = useValue(Section$);
  const subCategory = useValue(SubCategory$);
  const sections = useValue(SectionList$) ?? [];
  const subCategories = useValue(SubCategoryList$) ?? [];
  const menuToolTip = useValue(MenuToolTip$) ?? "";

  // Only one tab id at a time, so forcing tab A's tooltip visible always
  // implies every other tab's Tooltip gets forceVisible={false}.
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  // Closing the panel mid-hover unmounts this before the timer fires; without
  // this the callback would still land and call setState on a dead component.
  useEffect(() => clearHoverTimer, []);

  const candidates: AxisCandidate[] = [
    { id: "section", optionCount: sections.length },
    { id: "subCategory", optionCount: subCategories.length },
  ];
  const axis = resolveAxis(menuToolTip, candidates);

  // Zones does not render the catalog at all — MainContainer routes it to
  // ZoningHierarchy, which draws its own families. A strip here would be a
  // second, competing navigation for a view that is not on screen.
  if (axis === "zoneFamily") return null;

  const tabs = axis === "subCategory" ? subCategories : axis === "section" ? sections : [];
  const selected = axis === "subCategory" ? subCategory : section;
  const command = axis === "subCategory" ? lensSubCategoryCommand : lensSectionCommand;

  // One tab is not navigation, and no axis means no strip. Either way the
  // ChipRow identity beneath is left to say what is being looked at.
  if (tabs.length < 2) return null;

  return (
    <div className={classNames(AssetCategoryTabTheme.assetCategoryTabBar, styles.strip)}>
      <div className={AssetCategoryTabTheme.items}>
        {tabs.map((tab) => (
          <Tooltip key={tab.id} tooltip={tab.toolTip} forceVisible={hoveredTabId === tab.id}>
            <button
              className={classNames(
                AssetCategoryTabTheme.item,
                styles.tab,
                tab.id === selected && styles.tabSelected
              )}
              aria-label={tab.toolTip}
              onClick={() => {
                const c = command(tab.id);
                trigger(mod.id, c.method, ...c.args);
              }}
              onMouseEnter={() => {
                clearHoverTimer();
                hoverTimer.current = setTimeout(() => setHoveredTabId(tab.id), HOVER_DELAY_MS);
              }}
              onMouseLeave={() => {
                clearHoverTimer();
                setHoveredTabId(null);
              }}
            >
              <img src={tab.icon} className={styles.tabIcon} />
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
