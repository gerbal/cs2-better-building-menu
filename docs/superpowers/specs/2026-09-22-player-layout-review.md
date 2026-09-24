# Adversarial review of the player layout spec

Date: 2026-09-22. Spec: `2026-09-22-player-layout-design.md` (revised
version). Five independent reviewers, each with one lens: code claims,
player experience, failure modes, scope and value, engine feasibility. None
edited files; nothing was probed live. File:line references are the
reviewers' and point at the code as of commit `dc1beea`-era `main`.

## Where they converge

- **Cross-menu moves are far more expensive than the spec assumed.** Four
  independent findings meet here: menu membership comes from the game's menu
  walk, not the field the resolver would override; the Roads gathering adds
  a moved network back; zones live in a separate catalog; and the game's
  toolbar re-asserts an armed prefab's home menu every frame.
- **Hide and merge answer "tab clutter" at a fraction of the cost.** Scope
  and UX reviewers both propose shipping them first, with moves conditional.
- **Moving, rather than copying, has no written justification** against the
  prior-art digest, which ranks re-homing last.

## Blockers

1. **A cross-menu move makes the asset vanish.** Candidates come from
   `IsPlacedInMenu` over `_menuPlacements` (BuildingCatalogAdapter.cs:434-442,
   :492; PrefabIndexingSystem.cs:774-776), then `MatchesVanillaMenuTree`
   requires `entry.UiMenu == menu` (BuildingCatalogQueryEngine.cs:273-278).
   The new menu never has it as a candidate; the old one drops it. Needs a
   new membership gate covering `MenuHasAssets` (:458), `IsGatheredNetwork`
   (:504-511) and the unscoped path. [code]
2. **A network moved out of Roads comes back.** `IsExtraNetwork` keys on
   resolved `UiMenu != Roads` (NetworkMenuExtension.cs:66-70), and
   `GetExtraNetworkCategories` (PrefabIndexingSystem.cs:3226-3231) adds a
   Roads tab for it. [code, failure modes]
3. **Zones never move.** Zones are built from `_zoneCatalog`
   (PrefabIndexingSystem.cs:2855-2927) and pruned to what the game places
   there; the resolver in `AddPrefab` never touches them. [code]
4. **The toolbar re-asserts the home menu every frame.**
   `ToolbarUISystem.OnUpdate` (:189-198) calls `SelectAsset(..., false)`
   whenever the active prefab differs; `SelectAsset` sets menu and category
   from `UIObjectData.m_Group` (:769-776). The lens follows toolbar changes
   outside `MenuEchoGuard`'s two-frame window. The spec's "networks already
   work" has no verification record. Options: a C# latch treating the home
   menu as an echo while the lens-armed prefab holds (toolbar lights the home
   icon: known limitation), or a Harmony prefix on `SelectAsset` (conflicts
   with mods already patching `ToolbarUISystem`). A design decision, not a
   spike. [engine]
5. **Deleting a tab leaves merges dangling.** Tabs merged into a deleted tab
   resolve to nothing. Delete must unmerge them; the resolver must treat a
   missing, hidden, foreign or self target as absent. [failure modes]
6. **Layout edits don't invalidate caches.** Projections, `_byName` and the
   extension picker are keyed on `IndexGeneration`
   (BuildingCatalogAdapter.cs:540-551, :611; BuildingMenuUISystem.Methods.cs:171).
   Every apply (edit, undo, toggle, import, reset) must bump it and call
   `TriggerSearch`; the unlock path (:407-408) and placed-unique path (:3075)
   are precedents. [code, failure modes]
7. **The layout must apply on every indexing path**: every full pass
   (`OnGameLoaded`, city change, locale Immediate and Deferred) and the
   incremental changed-prefab pass. Test city reload and locale change with a
   non-empty layout. [failure modes]
8. **No trace where a moved asset came from** ("where did my bench go?").
   Needs a forwarding marker in the origin tab and search that always finds
   moved assets with their new location. [UX]
9. **Select all silently selects unseen assets**, saved immediately, with
   undo that dies at restart. Label with the real count, confirm past the
   page or a threshold, add "Return to vanilla home" for any selection. [UX]

## Major

Correctness:
- `UiCategoryPriority` is taken from the managed group only
  (PrefabIndexingSystem.cs:1124-1128) and grouping ranks by
  `(UiCategory, UiCategoryPriority)` (BuildingCatalogGrouping.cs:181), so a
  merged or moved tab's heading splits in two. [code]
- `DevTreeBranch` is computed from `UiMenuName` with ECS reads (:1149-1150,
  :2104-2107); an in-memory re-resolve leaves it stale and a root label leaks
  across menus. [code]
- Merging a menu down to one tab switches the strip to another axis
  (CatalogView.cs:184-187, :116); tab editing then disappears and the merge
  cannot be undone in the panel. [code]
- Density "Other" contradicts today's rule: one untiered entry collapses the
  row (`All(ZoneType != Any)`, BuildingCatalogAdapter.cs:159). A rule change,
  not "as today". [code]
- Education does draw its categories; school tiers replace only the school
  tab (MenuCategoryStrip.tsx:93, 180-182), and tier counts run over the whole
  menu (CatalogView.cs:73, 355-357). The spec misdescribes it. [code]
- No area kind exists: surfaces and terraforming are `Props`, transport lines
  are `Networks_Routes` (Domain/Enums/PrefabCategory.cs; processors). The
  kind rule as written lets surfaces move anywhere props go. [code]
- Prefab name is not unique; key by `<PrefabType>:<name>`; ambiguous keys
  move nothing. [failure modes]
- Validation of hand-edited and imported entries is undefined; define
  "valid" in the resolver, anything else dormant and counted. [failure modes]
- Newer-version file plus save-as-you-go silently drops edits; go read-only
  with a notice; keep `layout.v<N>.json` before the first write of a new
  version. [failure modes]
- Imports need caps (size, entries, name length) and icons restricted to the
  index's icon set. [failure modes]
- Atomic write on net48: `File.Replace` once the file exists, `File.Move`
  first time, recover from `.tmp`; unit tests run on net10, so keep the live
  restart check. [failure modes, engine]
- Save-per-edit at scale: debounce, write off the main thread, flush on Done
  and close; cap undo. [failure modes]
- Orphan entries grow forever and can be miscounted before assets finish
  loading: `lastSeen`, count only after the full pass, a confirmed "Forget"
  action. [failure modes]

Experience:
- Edited and vanilla state indistinguishable later: badges in edit mode, tab
  tooltips for merges, a "show only what I changed" filter. [UX]
- The one-click vanilla view lives in Options; add a panel toggle. [UX]
- Resets belong in the panel (reset tab, reset this menu); Options keeps
  reset everything, import, export. [UX]
- Mode errors: tint the catalog in edit mode, define behaviour on menu
  switch, a notice on first tile click. [UX]
- Keyboard and gamepad: tab "Move left/right", a keyboard path for
  selection. [UX]
- Vanilla tabs emptied by moves stay in the strip; hide them in play mode.
  [UX]
- Cognitive load: state "fewer tabs in play mode" as the success test. [UX]

Engine:
- Drag and drop: no native DnD or Pointer Events; mouse events plus a
  blocker mounted after a movement threshold, suppress the click that
  follows, hit-test against tab rects cached at drag start (the strip wraps,
  so they hold). Same for tab reorder. [engine]
- Escape during rename: the capture-phase Escape handler
  (VanillaMenuWatcher.tsx:47-66) closes the panel before blur; keep the draft
  in C# on every change and commit on close. [engine]
- Enter in the rename field arms the top result (BuildingGrid.tsx:133-145);
  gate the handler in edit mode and for inputs. [engine]
- Dimming: no opacity or filter on SVG icons (design-notes.md:24-35); dim the
  tab ground or border, add a badge. [engine]
- Options: runtime summary feasible via `SettingsUIMultilineText` +
  `SettingsUIDisplayName` getter (confirm live); dropdowns refresh only when a
  `SettingsUIValueVersion` getter changes; confirmation text is constant, so
  dynamic counts go in the button's label or description. [engine]

## Scope and value

- The evidence is one sentence from one player; nobody has measured his
  setup. Take a census first (tabs per menu, entries per tab) before sizing
  the first slice.
- Cost concentrates in asset moves (per-asset state, a tax on every future
  feature, the largest unknowns). Tab editing is per-tab state and answers
  "tab clutter" directly.
- Proposed order: hide and merge with a minimal core; then rename, reorder,
  custom tabs; then within-menu moves with bulk select; cross-menu moves
  only after the toolbar question is designed; export and import only on
  request.
- Candidates to cut: export and import, the icon picker, range selection,
  per-menu reset by destination.
- Must not cut: the declarative overlay, panel-only effect, hiding keeps
  entries reachable, file safety, nothing in save files.
- Success: fewer tabs in play mode on the requester's playset, recorded in
  `docs/verification.md`; no lost-asset report in two releases. Kill or
  stop-expanding: no moves without a second request or "hide and merge was
  not enough"; drop cross-menu moves if the toolbar question has no clean
  answer; freeze scope if layout bugs exceed about a third of a cycle's
  issues.

## Verified correct

- `Resolve` is the single live-placement override point in `AddPrefab`
  (PrefabIndexingSystem.cs:1120); nothing else assigns `UiMenuName` or
  `UiCategoryName`.
- Vanilla tab ids equal `UiCategory` strings (:2649-2651;
  BuildingCatalogAdapter.cs:673-674).
- `ShouldYield` is fed `MenuHasAssets`, which already reads the game's own
  placement (Bindings.cs:197-200).
- An override into Roads replaces the gathered appearance.
- Sub-tabs are computed after resolution; at most one category expands.
- Upgrades are excluded from every menu (QueryEngine.cs:283).
- In-place index mutation plus republish without a re-index has precedent.
- Runtime text on the Options screen is feasible in principle.
- `ModsData` is outside the mod file watcher.
