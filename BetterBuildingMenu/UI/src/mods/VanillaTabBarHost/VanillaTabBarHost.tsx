import { getModule } from "cs2/modding";
import { useMemo } from "react";
import styles from "./vanillaTabBarHost.module.scss";

const TAB_BAR = "game-ui/game/components/asset-menu/asset-category-tab-bar/asset-category-tab-bar.tsx";

type TabBarProps = {
  categories: unknown[];
  selectedCategory: unknown;
  onChange: (entity: unknown) => void;
  onClose?: () => void;
};

/**
 * A home for whatever other mods add to the game's asset category tab bar.
 *
 * Their buttons ride on that component, which the asset menu stands in for, so
 * without this they have nowhere to draw. It is mounted with no categories of
 * its own and the vanilla bar inside it is hidden; only the additions show.
 */
export const VanillaTabBarHost = ({ onClose }: { onClose?: () => void }) => {
  const TabBar = useMemo(() => {
    try {
      return getModule(TAB_BAR, "AssetCategoryTabBar") as ((props: TabBarProps) => JSX.Element) | undefined;
    } catch {
      return undefined;
    }
  }, []);

  if (!TabBar) {
    return null;
  }

  return (
    <div className={styles.host}>
      <TabBar categories={[]} selectedCategory={null} onChange={() => {}} onClose={onClose} />
    </div>
  );
};
