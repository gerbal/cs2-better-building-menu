import type { TriggerCommand } from "./buildingCatalogContracts";

export interface VanillaBuildMenuTab {
  id: string;
  icon: string;
  toolTip: string;
}

export const lensSectionCommand = (id: string): TriggerCommand => ({
  method: "SetBuildingLensSection",
  args: [id],
});

export const lensSubCategoryCommand = (id: string): TriggerCommand => ({
  method: "SetBuildingLensSubCategory",
  args: [id],
});

export const lensRoleCommand = (id: string): TriggerCommand => ({
  method: "SetBuildingLensRole",
  args: [id],
});

export const selectedNavigationId = (buildingLensEnabled: boolean, legacyId: number, lensId: string): number | string =>
  buildingLensEnabled ? lensId : legacyId;
