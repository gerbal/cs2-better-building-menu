# Building Lens UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair Building Lens title spacing, row density, and filter drawer visibility/interaction without changing FindIt's filter source of truth.

**Architecture:** Keep C# option sections and bindings unchanged except for the explicit toggle-group flag. Adjust the React/CSS presentation in the existing MainContainer, OptionsPanel, and BuildingCatalog modules; use contract helpers/tests for deterministic UI assertions. Verify the same path in a live Gameface session.

**Tech Stack:** C# net48, React/TypeScript, Sass modules, Node test runner, webpack, Cities: Skylines II Coherent Gameface CDP.

## Global Constraints

- Use Flexbox-based layout; do not add CSS Grid or browser-only APIs.
- Preserve `OptionsList → OptionClicked → TriggerSearch` and `AreFiltersSet/ClearFilters` semantics.
- Use rem-based sizing consistent with CS2 Gameface UI scale.
- Write a failing test before each production behavior change.

### Task 1: Add failing contracts for title, density, and filter toggles

**Files:**
- Modify: `FindIt/UI/test/buildingLensLayout.test.ts`
- Create: `FindIt/UI/test/buildingLensUx.test.ts`
- Modify: `FindIt/UI/src/domain/buildingLensLayout.ts` only if a new pure density helper is needed

**Interfaces:**
- Consumes: existing `getBuildingLensDensity` and `getBuildingLensMetricLabel` helpers.
- Produces: executable expectations for icon/title markup intent, 92/88rem default density, compact row bounds, and filter option click payload/state.

- [ ] **Step 1: Write the failing tests**

  Add tests that assert:

  - the intended default/compact row density values are exposed by the layout contract;
  - a filter option model with `selected: false` becomes selected after the real toggle reducer/handler contract is invoked;
  - the resulting command is `{ method: "OptionClicked", args: [90, 0, 0] }` for the first Extra Filters option;
  - the Building Lens heading contract includes the signature icon before the title text.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

  Run `npm test -- --test-name-pattern='Building Lens|filter'` from `FindIt/UI`. Confirm the failures identify the missing density/title/filter contracts rather than a test import error.

### Task 2: Implement title and row-density presentation

**Files:**
- Modify: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx`
- Modify: `FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss`

**Interfaces:**
- Consumes: existing `BuildingCatalogComponent`, density classes, and `BuildingZoneSignature.svg` asset.
- Produces: an inline decorative icon/title heading and reduced row/selector geometry at default and compact tiers.

- [ ] **Step 1: Add the heading icon**

  Import the existing signature asset and render `<img className={styles.titleIcon} alt="" />` immediately before the localized title inside a Flexbox `.titleLine`.

- [ ] **Step 2: Tighten the row shell**

  Set default row/selector heights to 92/88rem, reduce selector vertical padding to 2rem, and set the identity block to a 72rem max/min height. Set compact row/selector heights to 84/80rem and retain the existing metric columns and tooltip text.

- [ ] **Step 3: Run the focused UI tests**

  Run `npm test -- --test-name-pattern='Building Lens|filter'`. The title and row assertions must pass before touching filter placement.

### Task 3: Make the existing filter drawer visible and interactive

**Files:**
- Modify: `FindIt/UI/src/mods/MainContainer/mainContainer.module.scss`
- Modify: `FindIt/UI/src/mods/OptionsPanel/OptionsPanel.module.scss`
- Modify: `FindIt/Domain/Options/ExtraFiltersOption.cs`
- Modify: `FindIt/UI/test/buildingLensUx.test.ts`

**Interfaces:**
- Consumes: `OptionsList`, `OptionClicked`, `AreFiltersSet`, and existing panel placement branches.
- Produces: an on-screen, bounded filter drawer and an explicit toggle-group payload contract.

- [ ] **Step 1: Implement the visible fallback drawer**

  For centered `topPanel`, replace the negative bottom anchor with a top anchor, add a z-index above the tool content, and cap the panel height with local `overflow-y: auto`. Do not alter the side-panel offsets used by left/right alignment.

- [ ] **Step 2: Mark Extra Filters as a toggle group**

  Set `IsToggle = true` on the `OptionSectionUIEntry` returned by `ExtraFiltersOption.AsUIEntry()`. Leave its `OnOptionClicked`, mutually exclusive parking behavior, and reset logic unchanged.

- [ ] **Step 3: Add the interaction contract**

  Assert that the rendered option model exposes selected/unselected state, dispatches the section/option/value tuple, and enables the clear-filter command after a toggle. Keep tests independent of Gameface DOM internals by exercising the pure command/model helpers.

- [ ] **Step 4: Run focused UI and backend tests**

  Run `npm test` from `FindIt/UI` and `./build.sh test` from `cs2-findit-building-menu`. Both must pass.

### Task 4: Build and live-verify at the user viewport

**Files:**
- Modify: `docs/verification.md`
- Create: `tools/e2e/artifacts/building-lens-ux-fixes/<run-id>/` via the existing E2E harness

**Interfaces:**
- Consumes: compiled UI bundle, adopted CS2 process, and existing CDP helpers.
- Produces: screenshot and recorded measurements for title gap, row height, drawer bounds, selected toggle state, result refresh, and zero new exceptions.

- [ ] **Step 1: Build the UI and backend**

  Run `npm run build`, `./build.sh test`, and `./scripts/codex-just.sh build`.

- [ ] **Step 2: Reload the adopted Gameface view safely**

  Run `just cs2-status`, keep the current agent lock, use the existing CDP reload/wait procedure, and do not kill or relaunch the user's game.

- [ ] **Step 3: Verify the interaction sequence**

  Open the filter icon, assert the drawer bounds have `y >= 0`, click an Extra Filters option, assert selected state and Clear Filters enabled, then clear the filter and restore the original category/search state.

- [ ] **Step 4: Verify visual geometry**

  Measure the title icon-to-text gap, default/compact row heights, and identity text bounds. Capture a screenshot and inspect it visually for clipping/occlusion.

- [ ] **Step 5: Record results and run workspace E2E**

  Append commands, measurements, screenshot path, and exception count to `docs/verification.md`; run `./scripts/codex-just.sh e2e`.
