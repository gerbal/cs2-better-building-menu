# Implementation Plan: FindIt-led vanilla surface boundary

**Goal:** Make the FindIt successor's vanilla interaction handoffs explicit and
typed, while leaving the existing index, picker, placement tool, and old BMO
rollback reference unchanged.

**Design:** `docs/superpowers/specs/2026-08-01-findit-vanilla-surface-boundary-design.md`

**Branch/worktree:** `feature/findit-vanilla-surface-boundary` in
`/var/home/gerbal/Games/CS-Modding-worktrees/findit-vanilla-surface-boundary`

## Global constraints

- The successor identity remains `FindItBuildingMenu`; do not introduce the
  upstream `FindIt`/`77240` identity or co-install the old BMO.
- `FindItUtil.CategorizedPrefabs`/the existing FindIt index is the sole source
  for catalog records. No second ECS scan, unbounded catalog binding, or
  duplicate record model is allowed.
- Preserve the exact existing C# trigger names and payload order at the
  backend boundary: `SetCurrentPrefab(int)`,
  `OnLocateButtonClicked(int)`, `OptionClicked(int,int,int)`, and
  `PickerOptionClicked(int,int,int)`.
- The Building Lens and legacy grid must continue to use the normal
  `ToolSystem` placement handoff; picker and tool-options ownership stays in
  their existing systems.
- Keep the legacy grid behavior intact when the lens is disabled. Do not
  change persisted settings, publisher metadata, deploy paths, or the old BMO
  project.
- C# remains `net48`/C# 11 with the existing `IsExternalInit` polyfill. UI
  layout remains rem/flexbox-compatible with Coherent Gameface; do not add CSS
  grid or broad global selectors.
- New pure logic must be tested before implementation (TDD): record a
  meaningful RED run, then a GREEN run in the implementer report.
- No live game launch is required for this branch slice. Manual checks belong
  in `docs/verification.md` and require an isolated successor deployment.

## Task 1: Extract and test the game-side interaction policy

**Files:**

- Add `cs2-findit-building-menu/FindIt/Services/FindItInteractionBoundary.cs`.
- Add `cs2-findit-building-menu/FindItBuildingMenu.Tests/FindItInteractionBoundaryTests.cs`.
- Modify `cs2-findit-building-menu/FindIt/Systems/FindItUISystem.Setup.cs` only
  if constructor/field initialization is needed.
- Modify `cs2-findit-building-menu/FindIt/Systems/FindItUISystem.Methods.cs`
  and `FindItUISystem.Bindings.cs` to use the boundary as thin adapters.

**Implementation:**

1. Write failing tests for the pure boundary behavior: an invalid/unavailable
   prefab is not activated; selecting the already-active id is a no-op; a new
   valid id delegates activation; locate starts at index zero, cycles for the
   same id, and resets for a different id or an empty sequence.
2. Implement the smallest delegate-injected service that exposes those
   policies using prefab ids and locate sequence indices. It must not reference
   `ToolSystem`, `PrefabSystem`, `EntityQuery`, or perform discovery.
3. Keep the existing `FindItUISystem` game side effects exactly where they are:
   `FindItUtil.GetPrefabBase` resolves the id, `_toolSystem.ActivatePrefabTool`
   performs placement, `PrefabTrackingSystem.GetPlacedEntities` supplies
   placed entities, and `JumpTo` performs the camera handoff. The boundary
   only decides whether/how to delegate and owns the locate cursor state.
4. Run the focused test first (RED before implementation, GREEN after), then
   `../../scripts/codex-just.sh build` is not required here; run from the mod
   root `./build.sh test` before committing. Commit the task and write the
   required report to the SDD ledger report path.

**Verification:** `dotnet test` via `cs2-findit-building-menu/build.sh test`;
the existing catalog tests and the new boundary tests pass.

## Task 2: Define the typed UI surface contract and adapter

**Files:**

- Add `cs2-findit-building-menu/FindIt/UI/src/domain/findItSurfaceContracts.ts`.
- Add `cs2-findit-building-menu/FindIt/UI/src/domain/findItSurfacePort.ts`.
- Add `cs2-findit-building-menu/FindIt/UI/test/findItSurfaceContracts.test.ts`.
- Modify `cs2-findit-building-menu/FindIt/UI/src/domain/buildingCatalogContracts.ts`
  to use/re-export the semantic activation and locate command types without
  `any[]`.

**Implementation:**

1. Write failing browserless tests covering semantic activation, locate, FindIt
   option, and picker option actions. Assert the exact legacy trigger method
   and ordered payload produced by the adapter contract; include negative/zero
   ids only as normalization rules if the existing UI contract already needs
   them, without changing backend semantics.
2. Implement a discriminated action union and a named-argument port. The port
   adapter is the only module in this new seam that imports `trigger` and
   `mod.json`; its four methods must map to the existing bindings without
   exposing a generic `args: any[]` API to components.
3. Keep catalog query/filter/sort/paging functions pure and backward-compatible
   for their existing callers. Do not move catalog data or add a UI-side index.
4. Run the focused Node test RED then GREEN, then `npm test` and `npm run build`
   from `FindIt/UI`. Commit the task and write the SDD report.

**Verification:** New and existing UI tests pass; webpack emits the successor
bundle successfully.

## Task 3: Route existing surfaces through the port

**Files:**

- Modify `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx`.
- Modify `FindIt/UI/src/mods/PrefabItem/PrefabItem.tsx`.
- Modify `FindIt/UI/src/mods/PickerComponent/PickerComponent.tsx`.
- Modify `FindIt/UI/src/mods/MainContainer/MainContainer.tsx`.
- Modify/add focused UI tests only where the wiring is pure and testable.

**Implementation:**

1. Replace Building Lens row/compare placement and locate calls with the
   named surface port; remove direct raw trigger use from that component.
2. Route legacy `PrefabItem` activation and locate actions through the same
   port so vanilla-grid and lens selection share one handoff seam.
3. Route picker option changes and MainContainer filter-option changes through
   the corresponding port methods. Leave panel shell triggers (scroll,
   resize, lock, close, toolbar toggles) in their current owners.
4. Do not change visual layout or feature behavior beyond removing trigger
   spelling from these handoff sites. Preserve compare limits, placement
   continuity, picker visibility, and option argument order.
5. Run the focused UI tests after each meaningful edit, then the full UI test
   and build plus `./build.sh test`. Commit the task and write the SDD report.

**Verification:** `npm test`, `npm run build`, and backend `./build.sh test` pass;
`rg` confirms raw handoff trigger names are confined to the adapter and C#
binding registration/owners.

## Task 4: Document verification and boundary ownership

**Files:**

- Modify `cs2-findit-building-menu/docs/verification.md`.
- Modify `cs2-findit-building-menu/docs/roadmap.md` only if needed to record
  the completed boundary slice; do not rewrite historical evidence.

**Implementation:**

1. Add a concise “FindIt surface boundary” checklist naming the isolated
   successor package and the manual developed-save checks: lens row select,
   compare Place, repeated locate/reset, picker option changes, ordinary
   placement/tool-options continuity, and legacy grid parity with lens off.
2. Record the ownership rule that the index, picker, placement tool, and
   camera remain FindIt/system-owned, while the UI port only translates
   semantic commands. Repeat the old-BMO rollback/co-install warning where a
   future verifier will see it.
3. Do not claim live verification for this branch unless a later explicitly
   authorized run produces new artifacts. Keep existing historical evidence
   intact.
4. Run `git diff --check`, the focused tests, full UI build, and backend tests;
   commit the documentation task and write the SDD report.

**Verification:** Documentation matches the actual adapter/binding ownership;
all offline gates pass.

## Final branch verification

After all task reviews pass, run from the clean worktree:

```bash
cd cs2-findit-building-menu
./build.sh test
(cd FindIt/UI && npm test)
(cd FindIt/UI && npm run build)
git diff --check HEAD~4..HEAD
```

Also inspect the final diff for old-BMO changes, duplicate ECS scans, upstream
identity strings, and raw UI handoff triggers outside their intended owners.
Do not launch CS2 or deploy to the live Mods directories as part of this
offline branch. A separate human/live verification step remains required by
the repository Definition of Done before closing the bead.
