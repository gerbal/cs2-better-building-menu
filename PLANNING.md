# Better Building Menu (formerly the FindIt successor) — Implementation Plan

The successor is being developed as a separate project so the existing
`cs2-building-menu-overhaul/` implementation remains available for comparison
and rollback.

1. Preserve the FindIt indexing, categories, search, picker, placement, and
   settings foundation under the `BetterBuildingMenu` runtime identity.
2. Project the indexed building records through a bounded query/page contract;
   do not add a second ECS prefab scan.
3. Add common and category-specific analytical attributes with pure catalog
   tests for filters, sorting, and paging. The current slice projects nullable
   construction, upkeep, workers, capacity, utility, and pollution metrics in
   the single FindIt index pass and exposes a bounded Education & Research
   capacity-floor control that is cleared when leaving that subcategory.
4. Add the building lens UI, a visible bounded three-building compare tray,
   and Place actions while preserving FindIt's existing placement and picker
   behavior. The result list is constrained to a scroll region so the tray
   remains on-screen.
5. Validate build, tests, isolated deployment, and a live developed-save parity
   run before considering any migration from the older BMO project. The
   2026-07-26 run covered close/reopen, category and parking filters, search,
   sort/paging, compare/place, picker continuity, and OnlyPlaced locate while
   preserving the panel. The evidence is archived in `docs/verification.md`.
6. Keep this successor isolated until the upstream license is confirmed and a
   new PDX publisher identity is assigned. Only then execute the documented
   cutover from `cs2-building-menu-overhaul/` and prepare a public package.

See [docs/roadmap.md](docs/roadmap.md) for retained capabilities and
[docs/layout-concept.md](docs/layout-concept.md) for the Building Lens layout
contract, and [docs/verification.md](docs/verification.md) for release gates.
