import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";

import { setAssetMenuView } from "domain/assetMenuViewStore";
import { chooseViewMode, DEFAULT_VIEW_MODE, VIEW_MODES, type ViewModeKind } from "domain/viewModeChoice";
import { AssetMenuViewMode$, send } from "mods/bindings";
import { useAssetMenuView } from "mods/useAssetMenuView";

export interface ViewOption {
  id: ViewModeKind;
  label: string;
  selected: boolean;
}

/**
 * The views, the one drawn lit, and the pick: the store first, so it redraws now, then C#, which
 * keeps it for the next session. Only from a click: an effect would answer C#'s own echo.
 */
export function useViewOptions(): { current: string; options: ViewOption[]; pick: (view: ViewModeKind) => void } {
  const { translate } = useLocalization();
  const chosen = chooseViewMode(useAssetMenuView((view) => view.viewMode), useValue(AssetMenuViewMode$), DEFAULT_VIEW_MODE);
  const options = VIEW_MODES.map((mode) => ({
    id: mode.id,
    label: translate(mode.localizationKey, mode.fallback) ?? mode.fallback,
    selected: mode.id === chosen,
  }));

  return {
    current: options.find((option) => option.selected)?.label ?? options[0].label,
    options,
    pick: (view) => {
      setAssetMenuView({ viewMode: view });
      send({ method: "SetAssetMenuViewMode", args: [view] });
    },
  };
}
