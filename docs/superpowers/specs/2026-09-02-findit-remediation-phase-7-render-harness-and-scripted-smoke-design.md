# FindIt remediation phase 7 — a render harness, and a smoke you can re-run

**Bead:** cm-jjlv.11 (epic cm-jjlv). **Argues from:** finding 9 of
`2026-09-01-architecture-review.md`. **Follows:** phase 6 (cm-jjlv.10),
which left `buildingLensUx.test.ts` reading the four catalog files as one
text.

## What is wrong

- **Eleven TS test files read source as text.** `buildingLensUx.test.ts`
  holds 47 `it` blocks; 25 of them (63 assertions) match regexes against
  `.tsx` and `.scss` — `onSelect=\{\(\) => onPlace\(entry\)\}`,
  `/\$row-details-width: 26rem;/`. These fail on a rename (phase 6 had to
  re-point nine of them) and pass on a bug (the container carried a dead
  `getBuildingExtensionLabels(entry.supportedUpgrades)` local for months
  because a test grepped for it). Nothing renders a component.
- **The live record is a session artefact.** `docs/verification.md` grows
  a hand-written section per phase from ad-hoc scripts in a session's
  scratchpad; nobody can re-run one, and nothing says how far behind the
  code the newest section is.

## Decision

Render components under node and assert on what they draw; delete the
source-regex assertions those replace and the ones that only guard the
absence of deleted features; keep the stylesheet contract tests that pin
Cohtml pitfalls no renderer can see. Put one scripted smoke under
`tools/e2e` that drives the lens through the cs2-qa bridge and writes its
report to an artifact, and give `verification.md` a header that names the
last run's commit so staleness is a number.

Measured feasibility: with a `module.register` loader that transforms TSX
through `@swc/core` (already in `node_modules`), resolves the bundler's
`domain/`/`mods/` aliases, stubs `cs2/*` and answers stylesheet imports
with a class-name proxy, `renderToStaticMarkup(<BuildingCatalogComponent/>)`
renders the whole container in ~200 ms. No DOM library is needed for what
these tests assert.

## Design

### 1. The harness — `FindIt/UI/test/harness/`

- `register.mjs` — `node --import ./test/harness/register.mjs`; installs
  `hooks.mjs`.
- `hooks.mjs` — `resolve`: `cs2/<x>` → `test/harness/stubs/cs2-<x>.tsx`;
  `domain/…`, `mods/…`, `images/…` → `src/…` with extension probing;
  extensionless relative imports under `src`. `load`: `.ts`/`.tsx` under
  `src` or `test` through `@swc/core` (typescript parser, automatic JSX
  runtime, es2022, inline source maps); `.scss`/`.css` → a `Proxy` whose
  every key is its own name (`styles.row` is `"row"`); `.svg`/`.png` → the
  file name; `.json` → a default export.
- `stubs/` — `cs2-api.tsx` (a binding registry: `bindValue` returns a key +
  fallback, `useValue` reads the registry, `trigger` appends to an
  exported `triggers` array; test seams `setBinding(group, name, value)`
  and `resetBindings()`), `cs2-ui.tsx` (`Button` → `<button>` keeping
  `className`, `title`, `style`, `disabled` and every `data-*`/`aria-*`
  prop, plus `data-has-select` when an `onSelect` is bound; `Scrollable` →
  `<div data-scrollable>`; `Tooltip` → its children; `Dropdown*`,
  `Panel*` → plain divs), `cs2-l10n.tsx` (`translate(key, fallback)` →
  the fallback), `cs2-modding.tsx` (`getModule`: stylesheet modules answer
  a `vanilla-<key>` proxy, `text-input.tsx#TextInput` an `<input>`,
  anything else `undefined`), `cs2-bindings.tsx` (`game`, `tool` with
  stub bindings; `Theme` and the focus-key types), `cs2-input.tsx`
  (`FOCUS_DISABLED`).
- `render.tsx` — `renderHtml(element): string` over
  `react-dom/server`'s `renderToStaticMarkup`, and `catalogPage(entries,
  over?)` / `entry(id, over?)` fixture builders shared by the render tests.

`package.json`: `test` runs `test:unit` (the existing strip-types glob)
then `test:render` (`node --no-warnings --import ./test/harness/register.mjs
--test test/render/*.test.tsx`). `just test findit-building-menu` is
unchanged because it calls `npm test`.

### 2. What the render tests assert — `FindIt/UI/test/render/`

Each replaces the regex block named in brackets; the assertion is on the
markup, not the source.

- `tableRow.test.tsx` — the row's Place control carries
  `aria-label="Place: <name>"`, is not `disabled`, and has no
  `data-refused` for a placeable entry [makes the row itself the Place
  control]; a locked entry's label ends `— Locked` and the button carries
  `data-refused="true"` and stays enabled [does not disable an unplaceable
  row]; the details chevron is its own `<button>` with
  `aria-label="Details: <name>"` and, expanded, the details block lists a
  metric [gives expanding a row its own control; renders the projected
  analytical metrics]; the details name an upgrade from
  `supportedUpgrades` [supportedUpgradesField's "table row detail" site].
- `buildingCatalog.test.tsx` — with `hasMore`, the load-more row renders
  INSIDE the `data-scrollable` element in table mode and in grid mode
  [ends the feed with a load-more inside the scroll, in every view mode];
  with an empty page and an active search that has matches elsewhere, the
  scope notice renders in both modes; the column header renders in table
  mode whatever `PanelWidth` [obeys the chosen view mode].
- `lensControlPane.test.tsx` — the pane renders the group picker (labelled
  with the effective dimension), the sort picker and the four view-mode
  buttons [carries grouping, sorting and view mode]; the filter rail and a
  chip for an active facet render in it [carries the filters and their
  chips]; with a search active the search context names the query and the
  count [still says what a search is for]; the control set for menu
  "Zones" equals the set for menu "Roads" [gives the Zones menu the same
  controls]; no button is labelled Lock, Close or Expand [draws no
  panel-level controls].
- `buildingMenuHeader.test.tsx` — the clear-search and close buttons carry
  their `aria-label`s and every decorative `<img>` is `alt=""
  aria-hidden` [provides explicit labels for the header's icon actions].
- `buildingHoverCard.test.tsx` — the card names an upgrade from
  `supportedUpgrades` [supportedUpgradesField's "hover card" site].

Deleted outright (they assert the absence of code that no longer exists,
or restate a behaviour test that now exists): "has no page controls left
to label", "does not carry a standing result count", "keeps no control
chrome in the panel at all", "left-aligns both layouts together" and
"puts vanilla's layout back" (both pinned by `vanillaLayout.test.ts`), the
`index.tsx` half of "injects them nowhere else", and the two `.tsx`
`includes` checks in `supportedUpgradesField.test.ts` (its type-field
check stays).

Kept, moved to `test/stylesheetContracts.test.ts` with their reasons: the
seven SCSS blocks of `buildingLensUx.test.ts` ("keeps the trailing
reserve…", "makes the row Place hint visible…", "gives the height drag a
target…", "lets the catalog strip grow…", "matches the vanilla options
bank…", "lets the pane's text buttons size…", "opens the pane's menus
upward") — Cohtml layout rules no renderer can check. `uniqueMarkScale`,
`scrollContainerContracts`, `vectorEffectSafety` and
`vanillaMenuCategories`'s hook-order guard stay where they are, for the
same reason. `buildingLensUx.test.ts` keeps its 22 domain tests and no
`readFileSync`.

C# is out of scope: `BuildingLensDimensionTests` reads TS constants to
hold the two sides of a layout contract together, which is the manifest
pattern, not the regex-on-a-component pattern; the review's
`SortReorderabilityTests:147` no longer reads `QueryEngine.cs`.

### 3. The scripted smoke — `tools/e2e/findit-lens-smoke.mjs`

ESM, over `tools/cs2-qa-mcp/src/exec.mjs` + `bindings.mjs` and
`tools/e2e/cohtml-cdp.js`, like the session drivers it replaces.

- Arguments: `--http <cdp http url>` (default `CS2_HTTP` or
  `http://127.0.0.1:9444`), `--agent <id>` (required; the run refuses a
  game whose `cs2qa` hello does not name it — [[verify-scripts-must-select-their-game]]),
  `--prefix <steam prefix>` (optional; when given, the mod log under that
  prefix is read for `[LENS-REFRESH]` lines and exceptions), `--menus`
  (default `Roads,Landscaping,Health & Deathcare,Zones,Electricity,Education & Research`).
- Requires a loaded city (`query.load` succeeded / `gameMode` in a city);
  refuses at the menu.
- Per menu: open via `toolbar.selectAssetMenu`, wait, read
  `BuildingCatalogGroupBy`, `BuildingLensGroupDimensions`,
  `BuildingCatalog.totalCount` and the first item's `groupPath`; count
  the `[LENS-REFRESH]` lines the open produced (expect exactly one when
  the log is available); close. Then All menus (`ClearBuildingLensMenuScope`)
  total; inside Landscaping `SearchChanged "tre"` → total and first name;
  exceptions in the log (expect zero new).
- Output: a markdown report (a table of menu → refreshes / groupBy /
  dimensions / total, the search readings, the exception count) printed
  to stdout and written to
  `tools/e2e/artifacts/findit-smoke/<YYYYMMDD-HHMMSS>-<short sha>.md`;
  exit 1 on any expectation failing, 2 when the game refuses (wrong
  agent, no city). Node-side pure helpers (`parseArgs`, `summarise`,
  `expectations`) in `findit-lens-smoke-lib.mjs` with
  `findit-lens-smoke.test.js` in the existing `just e2e` list.

### 4. `docs/verification.md`

A header block above the first section:

```
> **Re-run:** `node tools/e2e/findit-lens-smoke.mjs --http … --agent … --prefix …`
> against a loaded city. **Last run:** <date> on <short sha> — <artifact path>.
> Sections below are dated records; the newest describes the current build.
```

The phase-7 section records the smoke's own output for this build, so the
header's sha and the section agree on day one.

## Live verification

`949230-c`, Porterville 3: the smoke runs green (six menus one refresh
each, All 10,536, `tre` 13, zero exceptions), its artifact exists, and
the header names its sha. A second run against the wrong `--agent` exits
2 without touching the game.
