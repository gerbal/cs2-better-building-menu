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

// A facet group becomes its own scroll surface once its options no longer fit
// the compact drawer. The threshold lives here so the affordance is
// deterministic in Gameface and testable without a layout.
export const FACET_SCROLL_OPTION_THRESHOLD = 8;

export function facetGroupNeedsScroll(
  group: BuildingLensFacetGroup,
  maxVisibleOptions = FACET_SCROLL_OPTION_THRESHOLD
): boolean {
  return group.options.length > maxVisibleOptions;
}

export function hasScrollableFacetGroups(
  groups: BuildingLensFacetGroup[],
  maxVisibleOptions = FACET_SCROLL_OPTION_THRESHOLD
): boolean {
  return groups.some((group) => facetGroupNeedsScroll(group, maxVisibleOptions));
}

export function facetOptionMarker(selected: boolean): string {
  return selected ? "✓" : "○";
}

export const toggleBuildingLensFacetCommand = (facetId: string, optionId: string): BuildingLensFacetTriggerCommand => ({
  method: "ToggleBuildingLensFacet",
  args: [facetId, optionId],
});

export const clearBuildingLensFacetsCommand = (): BuildingLensFacetTriggerCommand => ({
  method: "ClearBuildingLensFacets",
  args: [],
});

export function hasSelectedBuildingLensFacets(state: BuildingLensFacetState | null | undefined): boolean {
  if (!state) {
    return false;
  }

  return state.hasSelection || state.groups.some((group) => group.options.some((option) => option.selected));
}
