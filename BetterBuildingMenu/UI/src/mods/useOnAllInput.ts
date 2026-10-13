import { useValue } from "cs2/api";
import { useMemo } from "react";

import type { OnAllInput } from "domain/opensOnAll";
import {
  AssetMenuAtLargeText$,
  AssetMenuDefaultView$,
  AssetMenuTileSize$,
  AssetMenuTuning$,
  AssetMenuViews$,
  MenuShares$,
  SHIPPED_TUNING,
} from "mods/bindings";

/** What the small-menu rules read, as the bindings say it: C#'s counts, the views and the knobs resolved to their shipped values. */
export function useOnAllInput(): OnAllInput {
  const shares = useValue(MenuShares$);
  const views = useValue(AssetMenuViews$);
  const defaultView = useValue(AssetMenuDefaultView$);
  const tuning = useValue(AssetMenuTuning$);
  const tileSize = useValue(AssetMenuTileSize$);
  const atLargeText = useValue(AssetMenuAtLargeText$);

  return useMemo<OnAllInput>(
    () => ({ shares: shares ?? [], views: views ?? [], defaultView, tuning: { ...SHIPPED_TUNING, ...tuning }, tileSize, atLargeText }),
    [shares, views, defaultView, tuning, tileSize, atLargeText]
  );
}
