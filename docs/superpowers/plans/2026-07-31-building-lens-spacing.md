# Building Lens Adaptive Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the successor Building Lens readable at its default width while preserving a denser but usable minimum-width view and a spacious maximum-width view.

**Architecture:** A pure UI helper maps the existing outer panel width to compact, default, or expanded and owns the compact header-label policy. BuildingCatalogComponent binds the existing PanelWidth value directly, applies a density class, and keeps full localized labels and values in title tooltips. Existing flex row/header alignment and C# resize behavior remain unchanged.

**Tech Stack:** React 18, TypeScript 4.8, CSS Modules/Sass, Coherent Gameface, Node built-in tests, webpack, and the existing CS2 net48 backend.

## Global Constraints

- Use the existing outer width including BUILDING_LENS_PANEL_CHROME_WIDTH (35 rem).
- Keep exact boundaries: Compact 735–799, Default 800–999, Expanded 1000–1235 outer rem.
- Preserve flex column order, the 8rem identity gutter, and the 34rem header action reserve.
- Use fontSizeXS for metric headers and values in Default/Expanded; use fontSizeXXS for both in Compact.
- Keep numeric values locale-formatted and unrounded. Values may ellipsize, but full values remain in title tooltips.
- Use rem for Gameface dimensions. Do not add CSS grid, HTML table layout, :not(), or browser-only features.
- Do not change the C# resize clamp, persisted setting, resize triggers, or vanilla FindIt sizing.
- Do not commit or push without explicit authority; use test/build output and Beads comments as checkpoints.

---

### Task 1: Add deterministic density and compact-label policy

Files:
- Modify: cs2-findit-building-menu/FindIt/UI/src/domain/buildingLensLayout.ts
- Test: cs2-findit-building-menu/FindIt/UI/test/buildingLensLayout.test.ts

Interfaces:
- BuildingLensDensityTier = compact | default | expanded.
- getBuildingLensDensity(outerWidth: number): BuildingLensDensityTier.
- BuildingLensMetric = cost | upkeep | workers | capacity | lot | level | parking.
- getBuildingLensMetricLabel(metric, tier, fullLabel): string.

- [ ] Step 1: Add failing boundary and label tests.

~~~ts
it("maps exact width boundaries", () => {
  assert.equal(getBuildingLensDensity(735), "compact");
  assert.equal(getBuildingLensDensity(799), "compact");
  assert.equal(getBuildingLensDensity(800), "default");
  assert.equal(getBuildingLensDensity(999), "default");
  assert.equal(getBuildingLensDensity(1000), "expanded");
  assert.equal(getBuildingLensDensity(1235), "expanded");
});

it("abbreviates only compact labels", () => {
  assert.equal(getBuildingLensMetricLabel("upkeep", "compact", "Upkeep"), "Upk");
  assert.equal(getBuildingLensMetricLabel("workers", "compact", "Workers"), "Wkr");
  assert.equal(getBuildingLensMetricLabel("upkeep", "default", "Unterhalt"), "Unterhalt");
});
~~~

- [ ] Step 2: Run the focused test and verify it fails.

Run from cs2-findit-building-menu/FindIt/UI:

~~~bash
npm test -- --test-name-pattern="width boundaries|compact labels"
~~~

Expected: FAIL because the new exports do not exist.

- [ ] Step 3: Implement the pure policy.

Use strict comparisons, return compact below 800, default below 1000, and expanded otherwise. Use the fixed compact map: cost Cost, upkeep Upk, workers Wkr, capacity Cap, lot Lot, level Lvl, parking Park. Return the caller-provided fullLabel for default and expanded. Keep this helper independent of C# clamping.

- [ ] Step 4: Run focused and complete tests.

~~~bash
npm test -- --test-name-pattern="width boundaries|compact labels"
npm test
~~~

Expected: new tests and all existing contract tests pass.

### Task 2: Bind width and apply presentation labels

Files:
- Modify: cs2-findit-building-menu/FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx

Interfaces:
- Consume the existing FindItBuildingMenu.PanelWidth binding.
- Consume BUILDING_LENS_PANEL_CHROME_WIDTH, getBuildingLensDensity, and getBuildingLensMetricLabel.
- Emit data-density and one of styles.densityCompact, styles.densityDefault, or styles.densityExpanded on the catalog root.

- [ ] Step 1: Bind PanelWidth directly and derive density.

Calculate outerPanelWidth as useValue(PanelWidth$) plus BUILDING_LENS_PANEL_CHROME_WIDTH. Map the three known tier strings explicitly to CSS module classes; do not construct an unchecked CSS-module key from arbitrary input.

- [ ] Step 2: Replace duplicated header markup with a typed metric-column list.

Define the seven metric columns once with metric key, localization key/fallback, and CSS class. Render each translated full label as title and render getBuildingLensMetricLabel as visible text. Keep identity header and the existing Cost, Upkeep, Workers, Capacity, Lot, Level, Parking order.

- [ ] Step 3: Preserve value formatting and tooltips.

Leave formatMetric and all row value formatters unchanged. Keep full row titles such as Cost 1,000, Upkeep —, Lot dimensions, and Building level. Only compact visible header labels change; never abbreviate or round numeric values.

- [ ] Step 4: Run tests and build.

~~~bash
npm test
npm run build
~~~

Expected: all tests pass and webpack emits the UI bundle without TypeScript or Sass errors.

### Task 3: Apply tier-specific spacing and typography

Files:
- Modify: cs2-findit-building-menu/FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss

Interfaces:
- Consume densityCompact, densityDefault, and densityExpanded root classes.
- Keep existing flex row/header selectors and fixed metric bases.

- [ ] Step 1: Set the readable baseline.

Keep default shell and row rhythm: catalog padding 8rem, row/select heights 104/100rem, row gap 3rem, identity gap 7rem. Set metricHeader, metric, and parking to fontSizeXS; identity name/category tokens stay unchanged. This baseline covers Default and Expanded.

- [ ] Step 2: Add explicit density root classes and the Compact override.

Add non-empty densityDefault and densityExpanded root selectors that retain the 8rem baseline, then add a densityCompact block with catalog padding 6rem; heading, sortBar, capacityFilter, and compare horizontal shell padding/margins 6rem; row/select heights 92/88rem; row gap 2rem; identityCell gap 6rem; metricHeader, metric, and parking fontSizeXXS. Do not override columnHeader left padding 8rem, its 34rem right reserve, or add metric-cell horizontal padding.

- [ ] Step 3: Build CSS and run all browserless tests.

~~~bash
npm run build
npm test
git diff --check -- cs2-findit-building-menu/FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss
~~~

Expected: webpack and tests pass; no unsupported grid/table rules or whitespace errors.

### Task 4: Build, deploy, and live-verify

Files:
- Modify: cs2-findit-building-menu/docs/verification.md
- Modify the design spec only if measured behavior requires a documented correction.

- [ ] Step 1: Run quality gates.

~~~bash
./scripts/codex-just.sh build
./scripts/codex-just.sh e2e
~~~

If the wrapper does not expose the mod build, run from the mod root:

~~~bash
./build.sh backend
./build.sh test
~~~

Expected: backend and UI build/tests are green.

- [ ] Step 2: Check state and deploy without killing a live session.

~~~bash
just cs2-status
just deploy-isolated findit-building-menu
~~~

The adopted external game must not be killed or restarted implicitly. If it remains a human session, record deployment and wait for restart permission. A supervised restart must use the stable lock id codex-live-ui-1 and just launch-cs2.

- [ ] Step 3: Measure minimum, default, and maximum widths in Gameface.

At outer widths 735, 800, and 1235 capture computed styles and rectangles for catalog, columnHeader, first row, identityCell, each metric, and compareButton. Confirm header and row metric edges align, identity begins at 8rem, trailing reserve matches the row action, default/expanded metric fonts are fontSizeXS, compact metric fonts are fontSizeXXS, identity name/category remain distinct, world/native HUD remains visible, and successor logs have no exceptions. Restore saved center alignment and default width.

- [ ] Step 4: Record evidence and update Beads.

Append commands, measured values, screenshot/run artifact path, and limitations to docs/verification.md. Comment on CS-Modding-b53.13 at each milestone; do not close it until its live screenshot and all three verification layers are complete.

- [ ] Step 5: Handoff.

~~~bash
git status --short
git diff --check
~~~

Report changed files, test/build output, deployment state, live verification status, and whether the adopted game lock remains intentionally held.
