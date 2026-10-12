import { useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import { getAssetMenuView, setAssetMenuView } from "domain/assetMenuViewStore";
import { sessionPickAfterStored } from "domain/viewModeChoice";
import { AssetMenuViewMode$ } from "mods/bindings";

/**
 * Renders nothing. Drops this session's view pick when a reset empties the stored view, so the
 * menu opens in the view the reset put back. Mounted for the whole session, because Options,
 * where the reset is, opens while the build menu is closed.
 *
 * The slot exists only inside a city, so a reset made at the main menu happens while this is
 * unmounted. A pick always reaches the stored view, so the first answer after mounting counts:
 * it starts out compared with the pick, and an empty answer beside a pick is a reset.
 */
export const StoredViewWatcher = () => {
  const stored = useValue(AssetMenuViewMode$);
  const previous = useRef<string | null | undefined>(getAssetMenuView().viewMode);

  useEffect(() => {
    const viewMode = sessionPickAfterStored(previous.current, stored, getAssetMenuView().viewMode);
    previous.current = stored;
    setAssetMenuView({ viewMode });
  }, [stored]);

  return null;
};
