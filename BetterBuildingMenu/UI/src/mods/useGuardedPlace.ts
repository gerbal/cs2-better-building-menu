import { useCallback, useRef } from "react";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { canPlace } from "domain/buildingLockState";

/**
 * One place callback for a view's lifetime, reading the newest onPlace through a
 * ref, so a row's props hold still between renders and the row skips its own.
 * Vanilla refuses a locked or already-built selection rather than hiding it.
 */
export function useGuardedPlace(onPlace: (entry: BuildingCatalogEntry) => void): (entry: BuildingCatalogEntry) => void {
  const latestOnPlace = useRef(onPlace);
  latestOnPlace.current = onPlace;

  return useCallback((entry: BuildingCatalogEntry) => {
    if (!canPlace(entry)) return;

    latestOnPlace.current(entry);
  }, []);
}
