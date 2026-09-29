import type { Command } from "./command";

export type AssetMenuFacetTriggerCommand = Command;

export interface AssetMenuFacetOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface AssetMenuFacetGroup {
  id: string;
  label: string;
  options: AssetMenuFacetOption[];
  /** Whether this group's selection actually excludes anything in view. */
  narrowing?: boolean;
}

export interface AssetMenuFacetState {
  groups: AssetMenuFacetGroup[];
  hasSelection: boolean;
}

export const toggleAssetMenuFacetCommand = (facetId: string, optionId: string): AssetMenuFacetTriggerCommand => ({
  method: "ToggleAssetMenuFacet",
  args: [facetId, optionId],
});
