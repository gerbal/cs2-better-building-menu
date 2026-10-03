import { useValue } from "cs2/api";

import { assetMenuBandWidth, assetMenuRowWidth, resolveCatalogWidth } from "domain/assetMenuLayout";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuCatalogWidth$, AssetMenuWidth$, ControlPaneShown$ } from "mods/bindings";

/** The asset menu's widths as drawn now, in rem. */
export interface AssetMenuLayout {
  /** The band the row may fill: C#'s AssetMenuWidth and the UI's chrome, less what the text scale takes. */
  bandWidth: number;
  /** The build menu: the player's width, or the room beside the pane by default. */
  menuWidth: number;
  /** The row: the build menu and, while shown, the control pane beside it. */
  rowWidth: number;
  paneShown: boolean;
}

/**
 * One reading of the bindings that decide the asset menu's widths. The asset
 * menu draws with it and the catalog budgets its table with it, so the two
 * cannot disagree mid-drag.
 */
export function useAssetMenuLayout(): AssetMenuLayout {
  const bandWidth = assetMenuBandWidth(useValue(AssetMenuWidth$), useTextScale());
  const chosenWidth = useValue(AssetMenuCatalogWidth$);
  const paneShown = useValue(ControlPaneShown$);
  const menuWidth = resolveCatalogWidth(chosenWidth, bandWidth, paneShown);

  return { bandWidth, menuWidth, rowWidth: assetMenuRowWidth(menuWidth, paneShown), paneShown };
}
