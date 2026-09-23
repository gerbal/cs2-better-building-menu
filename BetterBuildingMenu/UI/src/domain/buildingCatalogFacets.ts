import type { Command } from "./command";

export type BuildingLensFacetTriggerCommand = Command;

export interface BuildingLensFacetOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface BuildingLensFacetGroup {
  id: string;
  label: string;
  options: BuildingLensFacetOption[];
  /** Whether this group's selection actually excludes anything in view. */
  narrowing?: boolean;
}

export interface BuildingLensFacetState {
  groups: BuildingLensFacetGroup[];
  hasSelection: boolean;
}

export const toggleBuildingLensFacetCommand = (facetId: string, optionId: string): BuildingLensFacetTriggerCommand => ({
  method: "ToggleBuildingLensFacet",
  args: [facetId, optionId],
});
