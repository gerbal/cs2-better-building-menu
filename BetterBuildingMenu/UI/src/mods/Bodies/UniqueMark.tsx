import type { BuildingCatalogEntry } from "domain/buildingCatalog";

/**
 * The game's own mark on a unique building's picture, or its already-built mark once the city holds
 * one, as 0.2.x drew them; nothing on any other building. The body sizes and shows it by its classes.
 */
export const UniqueMark = ({ entry, built, className }: { entry: BuildingCatalogEntry; built: boolean; className: string }) =>
  entry.isUnique === true
    ? <img className={className} src={built ? "Media/Game/Icons/AlreadyBuilt.svg" : "Media/Game/Icons/Unique.svg"} alt="" aria-hidden="true" />
    : null;
