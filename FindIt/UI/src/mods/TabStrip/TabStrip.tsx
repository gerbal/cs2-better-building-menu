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

export const TabStrip = () => {
  const section = useValue(Section$);
  const subCategory = useValue(SubCategory$);
  const sections = useValue(SectionList$) ?? [];
  const subCategories = useValue(SubCategoryList$) ?? [];
  const menuToolTip = useValue(MenuToolTip$) ?? "";

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
      <div className={classNames(AssetCategoryTabTheme.items, styles.itemsRow)}>
        {tabs.map((tab) => (
          <Tooltip key={tab.id} tooltip={tab.toolTip}>
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
            >
              <img src={tab.icon} className={styles.tabIcon} />
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
