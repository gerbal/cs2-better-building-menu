import { setPointed } from "domain/assetMenuViewStore";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { remRect } from "domain/hoverCardPlace";

/**
 * The pointer entered a building's cell: it is the one pointed at, its cell read off the screen in rem,
 * for the hover card. A cell leaves through `clearPointed(id)`. Real input sends mouse events only, so the
 * bodies call these from their cells' mouse enter and leave.
 */
export function pointAt(entry: BuildingCatalogEntry, element: { getBoundingClientRect?: () => DOMRect } | null): void {
  setPointed({ entry, cell: remRect(element?.getBoundingClientRect?.(), typeof window === "undefined" ? 0 : window.innerHeight) });
}
