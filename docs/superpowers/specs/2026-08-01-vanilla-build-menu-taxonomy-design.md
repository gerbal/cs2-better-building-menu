# Vanilla Build Menu Taxonomy Design

## Goal

Make the successor Building Lens a faithful replacement for the vanilla
building-asset menus while preserving FindIt's complete asset browser as a
separate mode. The lens must never display a FindIt category selection that it
silently ignores.

## Context

The running vanilla UI organizes placeable assets by build workflow: zoning,
signature buildings, utilities, civic services, transportation, parks and
recreation, communications, and landscaping assets. FindIt's inherited top-level
categories (`Networks`, `Buildings`, `Service Buildings`, `Trees`, `Props`,
`Vehicles`, and `Favorite`) describe a broad asset browser instead. The current
successor adapter indexes only `Buildings` and `ServiceBuildings`, so an
unsupported inherited tab falls back to the unfiltered building catalog.

## Design

### Two explicit modes

1. **FindIt Asset Browser** (Building Lens off) keeps the existing complete
   FindIt category and subcategory controls. Its picker, random selection,
   favorites, and placement behavior remain unchanged.
2. **Vanilla Build Catalog** (Building Lens on) owns a separate category state
   and renders only categories that have defined build-menu semantics. It does
   not reuse `CurrentCategory` as an implicit query selector.

Switching into the lens normalizes an invalid lens category to `All Buildings`;
switching it off restores the FindIt browser category without mutating it.

### Lens taxonomy, first slice

The first slice covers vanilla building asset grids using the existing indexed
building/service records:

- `All Buildings`
- `Zones`: Residential, Commercial, Industrial, Office, Extractors
- `Signature Buildings`: Residential, Mixed, Commercial, Industrial, Office
- `Service Buildings`: Roads/Parking, Electricity, Water & Sewage,
  Healthcare/Deathcare, Police/Administration, Fire/Disaster Control,
  Education/Research, Garbage, Transportation, Communications, Parks &
  Recreation, Landscaping, and Miscellaneous
- `Favorites` is a secondary predicate available within the lens, not a peer
  top-level mode.

The resolver derives these values from the existing `PrefabCategory`,
`PrefabSubCategory`, and `ZoneType` fields. Signature classification uses the
existing `ZoneTypeFilter.Signature` value; no second ECS scan is introduced.

Road construction, Lot Tool, Terraforming, and other tool-first vanilla
surfaces are not coerced into building rows. They are recorded as a follow-up
surface with dedicated placement semantics.

### Typed contract

Add a pure resolver/contract that maps an indexed entry to a stable lens
section and subcategory. The query engine matches the resolved section before
facets, ranges, sorting, and paging. An unsupported section is represented as a
disabled/invalid lens selection, never as an empty category string that means
"all".

The existing analytical fields stay nullable. Missing metrics render as the
existing em dash and do not become fabricated zeroes. Search, typed facets,
parking, capacity, sorting, and page offsets apply identically after a lens
category change.

### UI behavior

When the lens is enabled, the top bar renders the vanilla-aligned lens sections
and subcategory tabs. The inherited FindIt tabs are not shown as if they were
lens filters. When the lens is disabled, the original FindIt tabs return.

The lens shows the selected section, selected subcategory, result count, and
page range from the same query result. A category with no indexed records shows
an explicit empty state; it never reuses the previous result page.

### Deferred expansion

After this first slice is stable, generalize the projection to a
`BuildCatalogEntry` for non-building vanilla asset grids (roads, vegetation,
props, and other placement kinds) and add dedicated tool views. Vehicles and
pure simulation assets remain outside the building-menu replacement unless a
vanilla placement workflow requires them.

## Testing and verification

- Backend resolver tests cover every inherited FindIt category, every first-slice
  vanilla section, signature classification, favorites, and unsupported-state
  normalization.
- Query tests prove section filtering changes total count and first rows before
  paging, while existing search/facet/range tests remain green.
- UI contract tests cover lens-mode category rendering, trigger payloads,
  preservation/restoration of the FindIt category, and invalid-state handling.
- Live Gameface verification checks All, Zones, Signature, each Service
  subcategory, Favorites, count/rows/page agreement, and mode switching with no
  console or mod-log exceptions.

## Non-goals for this slice

- Reimplementing road, terraforming, or lot placement tools inside the table.
- Removing or changing FindIt's legacy asset browser behavior.
- A second ECS/indexing pass.
- New publisher identity or release readiness.
