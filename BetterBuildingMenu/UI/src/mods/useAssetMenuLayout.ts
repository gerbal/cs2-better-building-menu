import { useValue } from "cs2/api";

import { ASSET_MENU_CHROME_WIDTH, assetMenuRowWidth, catalogMinWidth, resolveCatalogWidth } from "domain/assetMenuLayout";
import { AssetMenuCatalogWidth$, AssetMenuWidth$, ControlPaneShown$ } from "mods/bindings";
import { DEFAULT_VIEW_MODE } from "mods/GroupedResults/ViewModeBar";
import { useAssetMenuView } from "mods/useAssetMenuView";

/** The asset menu's widths as drawn now, in rem. */
export interface AssetMenuLayout {
  /** The band the row may fill: C#'s AssetMenuWidth and the UI's chrome. */
  bandWidth: number;
  /** The build menu: the player's width, or the room when it fills. */
  menuWidth: number;
  /** The row: the build menu and, while shown, the control pane beside it. */
  rowWidth: number;
  paneShown: boolean;
  /** The narrowest the build menu draws in the current view: the table needs more. */
  minWidth: number;
}

/**
 * One reading of the three bindings that decide the asset menu's widths. The
 * asset menu draws with it and the catalog budgets its table with it, so the
 * two cannot disagree mid-drag.
 */
export function useAssetMenuLayout(): AssetMenuLayout {
  const bandWidth = useValue(AssetMenuWidth$) + ASSET_MENU_CHROME_WIDTH;
  const chosenWidth = useValue(AssetMenuCatalogWidth$);
  const paneShown = useValue(ControlPaneShown$);
  const minWidth = catalogMinWidth(useAssetMenuView((view) => view.viewMode) || DEFAULT_VIEW_MODE);
  const menuWidth = resolveCatalogWidth(chosenWidth, bandWidth, paneShown, minWidth);

  return { bandWidth, menuWidth, rowWidth: assetMenuRowWidth(menuWidth, paneShown), paneShown, minWidth };
}
