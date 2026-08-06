# Building Lens Filter Facets Design

## Goal

Make the successor Building Lens useful for information-driven building
selection by adding a bounded, typed facet surface for the highest-value static
building dimensions: role/type, provenance, and placement/access. Existing
FindIt filters remain authoritative for the legacy grid and continue to flow
into the Lens adapter.

## Scope

The first facet slice exposes:

- Building role/type when `BuildingMarkerData` is present (for example School,
  Hospital, PowerPlant, TransportDepot, or ResidentialBuilding).
- Source/provenance already represented by the index: DLC, theme, and asset
  pack values, plus vanilla/custom status.
- Static placement/access flags from `BuildingData`: requires road, no road
  connection, left/right/back access, pedestrian/car/track restrictions,
  roadside/on-road placement, required access, parking restriction, and
  utility/resource-node flags.

Numeric ranges already present in `BuildingCatalogQuery` stay unchanged. Runtime
or map-context dimensions such as current coverage, utilization, budget,
terrain-at-cursor, and "placeable here" are explicitly deferred because they
require live city context rather than prefab metadata.

## Interaction semantics

- Each facet is categorical or boolean and has an explicit `Any` state.
- Multiple values within one categorical facet are ORed.
- Different facets are ANDed.
- A missing component remains missing; it does not become a false-positive or a
  numeric zero.
- Clearing the Lens facets returns the query to its unfiltered state without
  changing FindIt's legacy filter state.
- Facet options are bounded to distinct values found in the existing indexed
  building set; no second ECS scan is introduced.

## Architecture

`PrefabIndexingSystem` enriches the existing `PrefabIndex` records during the
same indexing pass. `BuildingCatalogAdapter` projects those values into the
stable `BuildingCatalogEntry` and computes a serializable facet-state binding.
The pure `BuildingCatalogQueryEngine` matches the selected facets before
paging, while `FindItUISystem` owns selection state and exposes two triggers:
`ToggleBuildingLensFacet(facet, value)` and `ClearBuildingLensFacets()`.

The React Lens receives `BuildingLensFacets` as a bounded binding and renders a
collapsible facet drawer inside the existing table panel. The drawer is
independent of `OptionsList`, so inherited FindIt option sections retain their
existing contracts and Clear Filters behavior.

## Data contract

Facet groups contain a stable key, label, and option records (`id`, `label`,
`selected`). Entry records carry the normalized role/source strings and a
nullable placement flag bitmask. The bitmask is serialized as an integer for a
small stable contract; the adapter exposes human-readable flag options from a
single known map.

## Error and compatibility behavior

- If the index is not ready, the page and facet state are empty and the UI
  remains usable.
- Unknown facet keys or values are ignored and do not throw from a Gameface
  trigger.
- The existing `SetCurrentPrefab`, search, paging, category, picker, and
  placement paths are untouched.
- Coherent-compatible flexbox and rem sizing are used; no CSS grid/table
  features are introduced.

## Verification

- Backend pure tests cover role/source/placement matching, OR-within and
  AND-across semantics, missing values, clearing, and JSON shape.
- UI contract tests cover facet trigger payloads, selection reduction, and
  clear-state behavior.
- Backend/UI builds and isolated package/deploy pass.
- A live Gameface check selects a role or placement facet, confirms a changed
  result count, clears it, and confirms no new exceptions.
