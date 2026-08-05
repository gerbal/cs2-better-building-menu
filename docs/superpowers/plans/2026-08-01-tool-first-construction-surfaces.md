# Tool-first Construction Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate Tools affordance to Building Lens so roads, paths, lot/terraform, vegetation, props, and vehicles reach the native construction workflow without being misrepresented as building rows.

**Architecture:** C# exposes a small immutable catalog of stable tool-surface descriptors. The UI resolves those descriptors against the live vanilla `toolbar.toolbarGroups`/`toolbar.assetCategories` bindings, renders enabled and unavailable states, and triggers the native toolbar before closing FindIt. A pure resolver owns alias matching and handoff command construction; no direct `ToolSystem` assignment or second ECS index is introduced.

**Tech Stack:** C# 11/net48, xUnit/net10 pure backend tests, React 18, TypeScript 4.8, Node built-in tests, Sass/CSS Modules, Coherent Gameface built-in bindings, and the existing CS2 build/deploy scripts.

## Global Constraints

- Preserve the successor's `net48` target, C# 11 language version, nullable conventions, and `IsExternalInit` polyfill.
- Keep the existing FindIt index and Building Lens catalog limited to building/service records; do not add a network, prop, vegetation, or vehicle ECS scan.
- Use the built-in Gameface `toolbar` bindings and triggers for native handoff. Do not assign `ToolSystem`, `NetToolSystem`, `TerrainToolSystem`, or other tool systems directly in this slice.
- Keep the five existing Building Lens sections and their selection/query state unchanged. Tools must be a visually distinct affordance, never another building section or an implicit query filter.
- Treat runtime toolbar entity IDs as ephemeral. Resolve them from `uiTag`/name aliases at runtime; never persist or hard-code them in the descriptor catalog.
- Keep the transport payload flat and serialization-safe: records plus primitive fields/string arrays only; no dictionaries or nested ECS objects.
- Use Flexbox-based divs and `rem` dimensions for Gameface UI. Do not add CSS Grid, native table layout, `px`, `:not()`, or browser-only APIs.
- Write a focused failing test before each production behavior change, verify the failure is for the intended contract, then implement the smallest passing change.
- Preserve unrelated dirty worktree changes. Do not reset, commit, push, or overwrite an existing Mods target without explicit user authority.
- Record claim, red/green milestones, and any blockers on Beads issue `cm-3e5j` using `BEADS_ACTOR=codex-building-lens-surfaces-1`.

---

### Task 1: Define the stable C# tool-surface catalog and binding payload

**Files:**

- Create: `cs2-findit-building-menu/FindIt/Domain/ToolSurfaceContract.cs`
- Create: `cs2-findit-building-menu/FindItBuildingMenu.Tests/ToolSurfaceContractTests.cs`
- Modify: `cs2-findit-building-menu/FindIt/Systems/FindItUISystem.Setup.cs`
- Modify: `cs2-findit-building-menu/FindIt/Locale.json`

**Interfaces:**

- `ToolSurfaceIds` constants: `Roads`, `Paths`, `LotTerraform`, `Vegetation`, `Props`, and `Vehicles`.
- `ToolSurfaceActions` constants: `NativeAssetMenu`, `NativeAssetCategory`, `NativeTool`, and `Unavailable`.
- `ToolSurfaceDescriptor(string Id, string Icon, string Tooltip, string Action, string[] Aliases)`.
- `ToolSurfaceCatalog.GetDescriptors()` returns the deterministic descriptor order used by the UI.

- [ ] **Step 1: Add failing catalog tests.**

  Add xUnit tests for the exact six-item order, unique stable IDs, non-empty icon/tooltip/action values, non-empty alias sets, and the rule that aliases contain names/tags rather than numeric entity IDs. Add a serialization/property-shape assertion so the binding remains a flat array of primitive fields and string arrays.

- [ ] **Step 2: Run the focused backend tests and confirm the intended red failure.**

  From `cs2-findit-building-menu/` run:

  ```bash
  dotnet test FindItBuildingMenu.Tests/FindItBuildingMenu.Tests.csproj --filter FullyQualifiedName~ToolSurfaceContract --no-restore
  ```

  The failure must identify the missing catalog contract, not a missing test dependency or game-world initialization.

- [ ] **Step 3: Implement the immutable catalog.**

  Add the string constants and records in the existing `FindItBuildingMenu.Domain` namespace. Seed aliases from the decompiled vanilla toolbar labels/tags, retaining multiple aliases only when they are genuinely distinct. Use existing hosted icon paths and locale keys where available; add base-locale `Tools`, `Roads`, `Paths`, `Lot/Terraform`, `Vegetation`, `Props`, and `Vehicles` labels/tooltips with safe English fallbacks.

- [ ] **Step 4: Expose the catalog through `FindItUISystem`.**

  Create a read-only `ToolSurfaceDescriptors` binding during `OnCreate`. It does not need a trigger because descriptors are static for the process. Do not modify `CurrentCategory`, `CurrentSubCategory`, or the existing lens section bindings.

- [ ] **Step 5: Rerun the focused tests and backend build.**

  ```bash
  dotnet test FindItBuildingMenu.Tests/FindItBuildingMenu.Tests.csproj --filter FullyQualifiedName~ToolSurfaceContract --no-restore
  dotnet build FindIt/FindIt.csproj -c Debug -p:SkipBuildUI=true
  ```

  Confirm the catalog tests pass and no game-only API was introduced into the pure contract.

---

### Task 2: Implement and test pure toolbar target resolution

**Files:**

- Create: `cs2-findit-building-menu/FindIt/UI/src/domain/toolSurfaceContracts.ts`
- Create: `cs2-findit-building-menu/FindIt/UI/test/toolSurfaceContracts.test.ts`

**Interfaces:**

- Structural runtime types for toolbar groups/items/categories that include `entity`, `type`, `uiTag`, `name`, `locked`, and optional child/category arrays. Keep these local to the resolver so the bundle does not depend on an unstable generated enum name.
- `normalizeToolSurfaceText(value: string): string`.
- `resolveToolSurfaceTarget(descriptor, toolbarGroups, assetCategories): ToolSurfaceResolution`.
- `getToolSurfaceAvailability(resolution): { enabled: boolean; reason: string }`.
- `buildToolSurfaceHandoff(resolution): ToolSurfaceHandoff | null`, where a handoff contains the built-in trigger name/entity and the ordered FindIt close commands.

- [ ] **Step 1: Add failing resolver tests.**

  Use small in-memory toolbar fixtures to prove:

  - exact `uiTag` matches win over normalized display-name matches;
  - case, punctuation, and whitespace differences normalize predictably;
  - a menu target produces `toolbar.selectAssetMenu` with the matched entity;
  - a category target produces `toolbar.selectAssetCategory` with the matched entity;
  - locked, missing, and ambiguous matches become unavailable with a user-readable reason;
  - `NativeTool` remains unavailable until a documented native trigger exists;
  - unavailable resolutions produce no handoff and therefore no panel-close commands;
  - a successful handoff closes Building Lens only after the native toolbar trigger is ordered first.

- [ ] **Step 2: Run the focused UI tests and verify the expected red result.**

  From `cs2-findit-building-menu/FindIt/UI/` run:

  ```bash
  npm test -- --test-name-pattern='tool surface|toolbar target|handoff'
  ```

  Confirm failures are resolver-contract failures rather than TypeScript loader or test-discovery errors.

- [ ] **Step 3: Implement normalization, matching, and command construction.**

  Flatten toolbar groups and category candidates, filter locked items, prefer a single `uiTag` match, then use a normalized name fallback. Return an explicit unavailable reason for no bindings, no match, locked-only matches, ambiguous matches, and unsupported native-tool actions. Keep the returned entity only in the transient handoff object.

- [ ] **Step 4: Rerun the focused UI tests.**

  The complete resolver fixture set must pass before any React component is changed.

---

### Task 3: Render a distinct Tools affordance in Building Lens

**Files:**

- Create: `cs2-findit-building-menu/FindIt/UI/src/mods/ToolSurfaceBar/ToolSurfaceBar.tsx`
- Create: `cs2-findit-building-menu/FindIt/UI/src/mods/ToolSurfaceBar/toolSurfaceBar.module.scss`
- Modify: `cs2-findit-building-menu/FindIt/UI/src/mods/TopBar/TopBar.tsx`
- Modify: `cs2-findit-building-menu/FindIt/UI/src/mods/TopBar/topBar.module.scss`

**Interfaces and behavior:**

- Bind the C# `ToolSurfaceDescriptors` value through the successor mod group.
- Bind vanilla `toolbar.toolbarGroups` and `toolbar.assetCategories` through `bindValue("toolbar", ...)` and subscribe with `useValue`.
- Render `ToolSurfaceBar` only while `BuildingLensEnabled` is true, in a separate row between the building section row and the existing subcategory row. The existing section list remains exactly the five building sections.
- Show every descriptor with icon, label, and tooltip. Keep unresolved entries visible but disabled with their resolver reason. Do not change the current building section/subcategory on click.

- [ ] **Step 1: Add a pure component-model test fixture.**

  Extend `toolSurfaceContracts.test.ts` with the six-descriptor render model: all six IDs are present, the model is marked `tools` rather than `buildingSections`, and disabled entries retain their reason. This keeps the UI intent testable without a browser renderer.

- [ ] **Step 2: Add the component and styles.**

  Use the existing `BasicButton`, `Tooltip`, icon conventions, and vanilla button theme. Style the row with flexbox, bounded wrapping/overflow, compact rem-based spacing, and a visible disabled treatment that does not obscure the reason. Keep the title/category/subcategory spacing owned by existing components.

- [ ] **Step 3: Rerun UI tests and webpack build.**

  ```bash
  npm test
  npm run build
  ```

  Fix only tool-surface failures; do not absorb unrelated spacing or facet changes from other active work.

---

### Task 4: Wire native handoff and preserve FindIt lifecycle state

**Files:**

- Modify: `cs2-findit-building-menu/FindIt/UI/src/mods/ToolSurfaceBar/ToolSurfaceBar.tsx`
- Modify: `cs2-findit-building-menu/FindIt/Systems/FindItUISystem.Methods.cs` only if the existing tool-change close path needs an idempotence guard
- Modify: `cs2-findit-building-menu/FindIt/UI/test/toolSurfaceContracts.test.ts`
- Modify: `cs2-findit-building-menu/FindItBuildingMenu.Tests/ToolSurfaceContractTests.cs` if a backend lifecycle helper is extracted

- [ ] **Step 1: Add a failing handoff/lifecycle assertion.**

  Assert that an enabled menu/category handoff emits, in order, the built-in toolbar trigger and then `SetBuildingLensEnabled(false)`/`FindItCloseToggled`. Assert that an unavailable click emits neither trigger nor close command and leaves the current lens selection untouched. Add a regression fixture for the existing `OnToolChanged` close behavior so a native tool event may close the panel twice without corrupting state.

- [ ] **Step 2: Implement the click path.**

  Resolve the target from the latest toolbar bindings at click time. If it is unavailable, return without side effects. If it is enabled, call `trigger("toolbar", "selectAssetMenu", entity)` or `trigger("toolbar", "selectAssetCategory", entity)` first, then close/disable the successor panel through its existing mod triggers. Do not call a direct C# tool-system method.

- [ ] **Step 3: Verify lifecycle invariants locally.**

  Rerun all UI/backend tests and inspect the diff to ensure no code writes `FindItUtil.CurrentCategory`, `CurrentSubCategory`, `_buildingLensSection`, or `_buildingLensSubCategory` as part of a tool-surface click. If a small C# guard is required, keep it idempotent and cover it with a pure test.

---

### Task 5: Document the verification matrix and run all local quality gates

**Files:**

- Modify: `cs2-findit-building-menu/docs/verification.md`
- Modify: `cs2-findit-building-menu/FindIt/Locale.json` if any fallback key was not added in Task 1

- [ ] **Step 1: Add the live checklist.**

  Document the expected path from opening FindIt, enabling Building Lens, opening Tools, and selecting each descriptor. Record the success assertion (native toolbar/tool active, panel closed, no building rows/page count) and the unavailable assertion (disabled reason, panel/query unchanged). Include the required settled-menu/Gameface and CS2 lock precautions.

- [ ] **Step 2: Run backend and UI tests/builds.**

  From `cs2-findit-building-menu/` run:

  ```bash
  ./build.sh test
  ./build.sh backend
  (cd FindIt/UI && npm test)
  (cd FindIt/UI && npm run build)
  ./build.sh package
  ```

  The package identity guard must pass and the generated successor bundle must contain the new component without upstream Find It identity strings.

- [ ] **Step 3: Post a Beads milestone.**

  Comment `cm-3e5j` with the red/green test counts, build/package results, and any known unavailable native targets. Do not close the issue yet; live verification is still required.

---

### Task 6: Deploy in isolation and verify against a live settled world

**Files/artifacts:**

- Use the existing isolated deployment recipe and `tools/e2e/artifacts/` evidence directory; do not edit either shared Mods root directly.

- [ ] **Step 1: Reconcile and protect the game process.**

  Run `just cs2-status` before any game action. If an externally launched game is healthy and unlocked, adopt it with `just game-adopt codex-building-lens-surfaces-1`; otherwise launch with `just launch-cs2 codex-building-lens-surfaces-1` after the canonical preflight. Never attach CDP during logo/loading and never kill a foreign lock holder.

- [ ] **Step 2: Deploy the isolated successor.**

  Use `just deploy-isolated findit-building-menu`, then wait for a settled main menu/world and verify the successor UI module re-registers before driving it.

- [ ] **Step 3: Execute the live matrix.**

  In Building Lens, verify the Tools affordance is visually separate from building sections. Exercise every surface that resolves to a native menu/category and record the toolbar trigger, panel closure, active native workflow, and absence of building rows/page count. Exercise loading/locked/missing/ambiguous unavailable states where reproducible and confirm the panel/query remain unchanged. Reopen Building Lens and confirm the prior valid section/query survives. Verify legacy FindIt category selection and normal building placement still work.

- [ ] **Step 4: Archive evidence and update Beads.**

  Save screenshots/observations and the final console/error summary under a timestamped `tools/e2e/artifacts/` directory. Comment `cm-3e5j` with exact evidence paths and the three verification layers. Close only when backend/UI builds and tests pass and the live matrix is evidenced; otherwise leave the issue in progress with the blocker recorded.

## Handoff

After the plan is executed, report changed files, focused/full test commands and results, package/deploy status, live evidence paths, and any surfaces that remain intentionally unavailable. Git commit, push, and external release identity work remain outside this plan unless separately authorized.
