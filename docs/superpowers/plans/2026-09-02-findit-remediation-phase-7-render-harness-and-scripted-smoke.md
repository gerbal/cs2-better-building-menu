# FindIt remediation phase 7 — render harness and scripted smoke — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Components are tested by what they render under node; the
source-regex assertions those tests replace are deleted; one scripted smoke
under `tools/e2e` drives the lens and writes an artifact that
`docs/verification.md` names.

**Architecture:** A `module.register` loader (`test/harness/`) transforms
TSX with `@swc/core`, resolves the bundler's aliases and stubs `cs2/*`;
tests render with `react-dom/server` and assert on markup. The smoke is
an ESM script over the cs2-qa bridge libraries, with its pure halves unit
tested in `just e2e`.

**Tech Stack:** node 22 (`--import` loader hooks, `--test`), `@swc/core`
1.11, react-dom 18 server renderer; `tools/cs2-qa-mcp/src/{exec,bindings}.mjs`,
`tools/e2e/cohtml-cdp.js`.

**Spec:** `docs/superpowers/specs/2026-09-02-findit-remediation-phase-7-render-harness-and-scripted-smoke-design.md`

## Global Constraints

- Branch `findit/phase-7-render-harness` off master `4c5c74f`, worktree
  `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation`.
- No production source changes except where a test finds a defect (none
  expected). No binding is added or removed.
- After Task 4, `grep -l readFileSync FindIt/UI/test/*.test.ts` lists only
  `stylesheetContracts`, `uniqueMarkScale`, `scrollContainerContracts`,
  `vectorEffectSafety`, `vanillaMenuCategories`, `localizableStrings`,
  `supportedUpgradesField` — every remaining reader is a stylesheet
  contract, a manifest, or the hook-order guard.
- `npm test` = `test:unit` then `test:render`; `just test findit-building-menu`
  unchanged. `tsc --noEmit -p .` stays clean (`test/` is excluded).
- The smoke refuses a game whose hello does not name `--agent`, and
  refuses at the main menu.
- Beads cm-jjlv.11.1–.6 under cm-jjlv.11; close each on commit. Commit
  trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`,
  `Claude-Session: https://claude.ai/code/session_013U8fzQAHmfdVdWfXLX2Eqv`.

---

### Task 1: The harness

**Files:**
- Create: `FindIt/UI/test/harness/register.mjs`, `hooks.mjs`,
  `stubs/cs2-{api,ui,l10n,modding,bindings,input}.tsx`, `render.tsx`
- Create: `FindIt/UI/test/render/harness.test.tsx`
- Modify: `FindIt/UI/package.json` scripts
- Delete: `FindIt/UI/test/render.spike.test.tsx` (the spike)

**Interfaces (Produces):**
```ts
// test/harness/stubs/cs2-api.tsx
export function setBinding(group: string, name: string, value: unknown): void
export function resetBindings(): void
export const triggers: Array<{ group: string; name: string; args: unknown[] }>
// test/harness/render.tsx
export function renderHtml(element: ReactElement): string   // renderToStaticMarkup
export function entry(id: number, over?: Partial<BuildingCatalogEntry>): BuildingCatalogEntry
export function catalogPage(items: BuildingCatalogEntry[], over?: Partial<BuildingCatalogPage & { status: string }>): object
export function count(html: string, pattern: RegExp): number
```

- [ ] **Step 1:** The spike's `register.mjs`, `hooks.mjs` and six stubs are
  already at their final paths; keep them. Change the `Tooltip` stub so
  the card's content renders too:
  ```tsx
  export const Tooltip = ({ children, tooltip }: { children?: ReactNode; tooltip?: ReactNode }) => (
    <>{children}{tooltip !== undefined && tooltip !== null && <div data-tooltip="true">{tooltip}</div>}</>
  );
  ```
- [ ] **Step 2:** `render.tsx`:
  ```tsx
  import { renderToStaticMarkup } from "react-dom/server";
  import type { ReactElement } from "react";
  import type { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";

  export const renderHtml = (element: ReactElement): string => renderToStaticMarkup(element);

  export function entry(id: number, over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry {
    return {
      id, prefabName: `Prefab${id}`, name: `Building ${id}`, category: "ServiceBuildings", subCategory: "ServiceBuildings_Health",
      categoryLabel: "Services", subCategoryLabel: "Health", thumbnail: "", lotWidth: 4, lotDepth: 4, buildingLevel: 1, zoneType: 0,
      hasParking: false, isUniqueMesh: false, isVanilla: true, pdxModsId: "", constructionCost: 1000, upkeep: 10, workers: 5, capacity: 20,
      electricityConsumption: null, waterConsumption: null, garbageAccumulation: null, waterCapacity: null, sewageCapacity: null,
      groundPollution: null, airPollution: null, noisePollution: null, groupPath: [], groupLabelId: "", ...over,
    } as BuildingCatalogEntry;
  }
  export function catalogPage(items: BuildingCatalogEntry[], over: Record<string, unknown> = {}) {
    return { items, totalCount: items.length, offset: 0, limit: 100, hasMore: false, status: "ready", reorderableSortColumns: [], ...over };
  }
  export const count = (html: string, pattern: RegExp): number => (html.match(new RegExp(pattern.source, "g")) ?? []).length;
  ```
  (`entry`'s field list comes from `test/buildingCatalogContracts.test.ts`'s
  fixture plus the identity fields `TableRow` reads.)
- [ ] **Step 3:** `harness.test.tsx` — proves the loader end to end:
  ```tsx
  import assert from "node:assert/strict";
  import { describe, it } from "node:test";
  import { renderHtml, entry } from "../harness/render";
  import { setBinding, resetBindings, triggers } from "../harness/stubs/cs2-api";
  import { bindValue, useValue, trigger } from "cs2/api";
  import styles from "../../src/mods/BuildingCatalog/buildingCatalog.module.scss";
  import { Button } from "cs2/ui";

  describe("the render harness", () => {
    it("answers a stylesheet import with the class names themselves", () => {
      assert.equal(styles.row, "row");
      assert.equal(styles.anything, "anything");
    });
    it("lets a test set what a binding reads and see what a trigger sent", () => {
      resetBindings();
      const B$ = bindValue<number>("FindItBuildingMenu", "X", 1);
      const Probe = () => { const v = useValue(B$); trigger("FindItBuildingMenu", "Y", v); return <span>{v}</span>; };
      assert.equal(renderHtml(<Probe />), "<span>1</span>");
      setBinding("FindItBuildingMenu", "X", 2);
      assert.equal(renderHtml(<Probe />), "<span>2</span>");
      assert.deepEqual(triggers.at(-1), { group: "FindItBuildingMenu", name: "Y", args: [2] });
    });
    it("renders cs2/ui's Button as a button that keeps its labels and data attributes", () => {
      const html = renderHtml(<Button aria-label="Do" title="Do it" data-refused="true" onSelect={() => {}}>x</Button>);
      assert.match(html, /<button [^>]*aria-label="Do"/);
      assert.match(html, /data-refused="true"/);
      assert.match(html, /data-has-select="true"/);
    });
    it("builds an entry the components accept", () => {
      assert.equal(entry(3, { name: "Clinic" }).name, "Clinic");
    });
  });
  ```
- [ ] **Step 4:** `package.json` scripts:
  `"test": "npm run test:unit && npm run test:render"`,
  `"test:unit": "node --no-warnings --experimental-strip-types --test test/*.test.ts"`,
  `"test:render": "node --no-warnings --import ./test/harness/register.mjs --test test/render/*.test.tsx"`.
  Delete `test/render.spike.test.tsx`.
- [ ] **Step 5:** `npm test` green (unit 568 + render 4); `npx tsc --noEmit -p .` clean; `just test findit-building-menu` green (C# `BindingManifestTests` must not pick the stubs' `bindValue` calls up — it scans `src`; confirm by its passing).
- [ ] **Step 6:** Commit `test(findit): a render harness — TSX through swc under node, cs2/* stubbed, components rendered to markup (cm-jjlv.11.1)`; close cm-jjlv.11.1.

---

### Task 2: Row, card and header render tests

**Files:**
- Create: `FindIt/UI/test/render/tableRow.test.tsx`, `buildingHoverCard.test.tsx`, `buildingMenuHeader.test.tsx`

- [ ] **Step 1: `tableRow.test.tsx`**
  ```tsx
  import assert from "node:assert/strict";
  import { describe, it } from "node:test";
  import { renderHtml, entry } from "../harness/render";
  import { TableRow, type TableRowProps } from "../../src/mods/BuildingCatalog/TableRow";

  const labels = { place: "Place", inspect: "Details", locked: "Locked", built: "Already built" };
  const row = (over: Partial<TableRowProps> = {}) => renderHtml(
    <TableRow entry={entry(7, { name: "Clinic" })} expanded={false} nameBudget={40} separators={{ thousands: ",", decimal: "." } as never}
      labels={labels} columnStyle={() => ({})} resolveFacetLabel={() => null} onPlace={() => {}} onToggleExpanded={() => {}} {...over} />
  );

  describe("a table row", () => {
    it("makes the row itself the Place control", () => {
      const html = row();
      assert.match(html, /<button class="rowSelect"[^>]*aria-label="Place: Clinic"/);
      assert.match(html, /<button class="rowSelect"[^>]*data-has-select="true"/);
      assert.doesNotMatch(html, /<button class="rowSelect"[^>]*data-refused/);
    });
    it("does not disable an unplaceable row, because that would take its hover card too", () => {
      // A locked entry: the label says why, the button stays enabled.
      const html = row({ entry: entry(7, { name: "Clinic", isLocked: true } as never) });
      assert.match(html, /aria-label="Place: Clinic — Locked"/);
      assert.match(html, /<button class="rowSelect"[^>]*data-refused="true"/);
      assert.doesNotMatch(html, /<button class="rowSelect"[^>]*disabled/);
    });
    it("gives expanding a row its own control", () => {
      const html = row();
      assert.match(html, /<button class="rowDetailsButton"[^>]*aria-label="Details: Clinic"/);
      assert.doesNotMatch(html, /class="rowDetails"/);
    });
    it("renders the projected analytical metrics and the upgrades when expanded", () => {
      const html = row({ expanded: true, entry: entry(7, { name: "Clinic", supportedUpgrades: ["Extra Wing"] }) });
      assert.match(html, /rowDetailsButtonOpen/);
      assert.match(html, /Extra Wing/);
      assert.match(html, /Upgrades/);
    });
  });
  ```
  The locked flag: read `domain/buildingLockState.ts` for the field
  `isEntryLocked` tests (`isLocked`/`unlockMilestone`), and set that field
  in the second test.
- [ ] **Step 2: `buildingHoverCard.test.tsx`** — render
  `<BuildingHoverCard entry={entry(1, { supportedUpgrades: ["Extra Wing"] })} context={context}><span>x</span></BuildingHoverCard>`
  where `context` comes from rendering a probe that calls
  `useHoverCardContext()` (or, if the context is a plain object type,
  construct it as the probe's captured value). Assert the `data-tooltip`
  block contains `Upgrades` and `Extra Wing`, and that with
  `supportedUpgrades: []` it contains neither. This is
  `supportedUpgradesField`'s "hover card" site as a behaviour.
- [ ] **Step 3: `buildingMenuHeader.test.tsx`** — `renderHtml(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />)`
  after `setBinding("FindItBuildingMenu","CurrentSearch","road")`
  (so the clear-search control renders): assert
  `/aria-label="Clear search"/`, `/aria-label="Close"/`, and that every
  `<img` in the markup has `alt="" aria-hidden="true"` (`count(html,
  /<img /) === count(html, /<img [^>]*alt="" aria-hidden="true"/)`).
  Read `BuildingMenuHeader.tsx:120-180` for the binding that gates the
  clear button and set it.
- [ ] **Step 4:** `npm run test:render` green; commit
  `test(findit): the row, the hover card and the header are tested by what they render (cm-jjlv.11.2)`; close cm-jjlv.11.2.

---

### Task 3: Catalog and control-pane render tests

**Files:**
- Create: `FindIt/UI/test/render/buildingCatalog.test.tsx`, `lensControlPane.test.tsx`

- [ ] **Step 1: `buildingCatalog.test.tsx`**
  ```tsx
  import assert from "node:assert/strict";
  import { beforeEach, describe, it } from "node:test";
  import { renderHtml, entry, catalogPage } from "../harness/render";
  import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
  import { resetLensView, setLensView } from "../../src/domain/lensViewStore";
  import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

  const page = (over = {}) => setBinding("FindItBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], over));
  const render = () => renderHtml(<BuildingCatalogComponent />);

  describe("the catalog container", () => {
    beforeEach(() => { resetBindings(); resetLensView(); setBinding("FindItBuildingMenu", "PanelWidth", 700); });

    for (const mode of ["table", "grid"]) {
      it(`ends the feed with a load-more inside the scroll in ${mode} mode`, () => {
        setLensView({ viewMode: mode }); page({ hasMore: true, totalCount: 403 });
        const html = render();
        const scroll = html.indexOf('data-scrollable="true"'); const more = html.indexOf('class="loadMoreRow"');
        assert.ok(scroll >= 0 && more > scroll, `${mode}: load-more must sit inside the scroll`);
        assert.match(html, /Showing 2 of 403/);
      });
      it(`offers to widen a scoped miss in ${mode} mode`, () => {
        setLensView({ viewMode: mode }); page({ items: [], totalCount: 0 });
        setBinding("FindItBuildingMenu", "CurrentSearch", "police"); setBinding("FindItBuildingMenu", "BuildingCatalogMatchesElsewhere", 5);
        assert.match(render(), /No matches here — 5 elsewhere/);
      });
    }
    it("obeys the chosen view mode whatever the panel width", () => {
      setLensView({ viewMode: "table" }); page();
      for (const width of [300, 700, 1100]) { setBinding("FindItBuildingMenu", "PanelWidth", width); assert.match(render(), /class="columnHeader"/); }
    });
    it("draws no control chrome of its own", () => {
      setLensView({ viewMode: "grid" }); page();
      const html = render();
      for (const gone of [/class="toolbar"/, /class="heading"/, /class="sortBar"/, /data-sort-options/]) assert.doesNotMatch(html, gone);
    });
  });
  ```
  The grid branch renders `GroupedResults` → `BuildingGrid`; if a nested
  component reads a binding with no fallback and throws, set that binding
  in `beforeEach` (`BuildingLensMilestones`, `BuildingLensFacets` are the
  likely ones — read the throw).
- [ ] **Step 2: `lensControlPane.test.tsx`** — `beforeEach` sets
  `BuildingLensMenu`, `BuildingCatalogGroupBy` ("menuCategory"),
  `BuildingLensGroupDimensions` (all ids), `BuildingCatalogSortColumn`
  ("Name"), `BuildingCatalogSortDescending` (false), `CurrentSearch`,
  `BuildingLensFacets` (one group with one selected option),
  `BuildingCatalogMetricRanges` (empty), `BuildingCatalog` (a page). Tests:
  - "carries grouping, sorting and view mode": markup has
    `class="pickerSummary"` twice (group, sort), the label `Category`, the
    text `Sort by`, and the four view-mode labels `Grid`, `List`, `Cards`,
    `Table`.
  - "carries the filters and their chips": with a selected facet option
    the markup has the rail (`class="filterRail"` — confirm the class in
    `FilterRail.tsx`) and a chip whose `aria-label` starts `Remove `.
  - "still says what a search is for": with `CurrentSearch` "road" the
    markup has `Results for road` (the `BuildingLensSearchResults`
    fallback is `Results for {0}`; confirm the count formatting at
    `LensControlPane.tsx:221-230`).
  - "gives the Zones menu the same controls as every other menu": render
    with `BuildingLensMenu` "Zones" and "Roads"; the sorted list of
    `aria-label`s (`html.match(/aria-label="[^"]*"/g)`) is equal.
  - "draws no panel-level controls of its own": no `aria-label` among
    `Lock`, `Close`, `Expand`, `Collapse`.
- [ ] **Step 3:** `npm run test:render` green; commit
  `test(findit): the catalog and the control pane are tested by what they render (cm-jjlv.11.3)`; close cm-jjlv.11.3.

---

### Task 4: Delete the regex assertions; keep the stylesheet contracts

**Files:**
- Modify: `FindIt/UI/test/buildingLensUx.test.ts` (delete the 25 regex
  `it` blocks and every `readFileSync`/source constant; keep the 22 domain
  tests and their describes: "Building Lens filter controls", "Vanilla menu
  interception", "Vanilla menu watcher lifecycle", "Out-of-scope search")
- Create: `FindIt/UI/test/stylesheetContracts.test.ts` — the seven SCSS
  blocks moved verbatim with their comments: "keeps the trailing reserve
  and the name budget agreeing", "makes the row Place hint visible for
  hover and keyboard focus", "gives the height drag a target worth aiming
  at", "lets the catalog strip grow rather than slicing a wrapped row of
  tabs", "matches the vanilla options bank it sits opposite", "lets the
  pane's text buttons size to their text", "opens the pane's menus upward,
  away from the bottom bar"; header comment: these pin Cohtml layout
  rules a renderer cannot see — see `scrollContainerContracts.test.ts` for
  the pattern.
- Modify: `FindIt/UI/test/supportedUpgradesField.test.ts` — delete the
  `SITES` loop; keep "the entry type keeps both fields"; note in its
  header that the two sites are now `tableRow.test.tsx` and
  `buildingHoverCard.test.tsx`.

- [ ] **Step 1:** Apply the deletions and the move.
- [ ] **Step 2:** `grep -c readFileSync test/buildingLensUx.test.ts` → 0;
  `npm test` green (unit count drops by 25 − 7 moved = 18 `it`s, plus 2
  from supportedUpgrades); `tsc` clean.
- [ ] **Step 3:** Commit `test(findit): the source-regex assertions go; the stylesheet contracts keep their own file (cm-jjlv.11.4)`; close cm-jjlv.11.4.

---

### Task 5: The scripted smoke

**Files:**
- Create: `tools/e2e/findit-lens-smoke.mjs`, `tools/e2e/findit-lens-smoke-lib.mjs`, `tools/e2e/findit-lens-smoke.test.js`
- Modify: `justfile` `e2e` recipe (add `node tools/e2e/findit-lens-smoke.test.js`)

**Interfaces (lib, pure):**
```js
export function parseArgs(argv, env): { http, agent, prefix, menus: string[], out }   // throws on a missing --agent
export function modLogPath(prefix): string   // …/compatdata/<prefix>/pfx/drive_c/users/steamuser/AppData/LocalLow/Colossal Order/Cities Skylines II/Logs/FindItBuildingMenu.log
export function refreshLines(logText, fromLine): string[]                           // [LENS-REFRESH] lines after fromLine, prefix stripped
export function exceptionCount(logText): number
export function evaluate(readings): { ok: boolean, failures: string[] }             // the expectations
export function report(readings, { sha, date, evaluation }): string                 // the markdown
```
`readings` = `{ menus: [{ name, refreshes, groupBy, dimensions, total, firstPath }], all: { total, refreshes }, search: { menu, text, total, first }, exceptions: { before, after } }`.

- [ ] **Step 1: `findit-lens-smoke.test.js`** (CommonJS like its neighbours, `node:test`):
  - `parseArgs(["--agent","a","--prefix","949230-c"], {CS2_HTTP:"http://x"})` → http from env, menus default list; without `--agent` throws `/--agent/`.
  - `refreshLines` strips `[timestamp] [INFO]  ` and returns only lines after `fromLine`.
  - `evaluate`: a menu with `refreshes: 2` fails with a message naming the menu; `refreshes: null` (no log) does not fail; `total: 0` fails; `exceptions.after > exceptions.before` fails; a clean reading is `ok`.
  - `report` contains one table row per menu and the sha.
- [ ] **Step 2: lib** — implement the five functions. `evaluate`: per menu `total > 0`, `groupBy` non-empty, `dimensions` includes `"none"`, `refreshes === 1` when not null; `all.total > menus' max total`; `search.total > 0` and `search.first` non-empty; `exceptions.after === exceptions.before`.
- [ ] **Step 3: script** — `main()`: `parseArgs(process.argv.slice(2), process.env)`; connect as `qa9444.mjs` does (`cdp.listTargets(http)`, `selectTarget`, `connectWs`); `createExec({client})`; `exec("hello", {}, agent)` must succeed (the bridge refuses a foreign agent) else exit 2; `exec("query.load")` status must be `succeeded` else exit 2 ("no city loaded"); read `toolbar.toolbarGroups` → menu name → entity; for each menu: note the log line count (if `prefix`), `triggerBinding` `toolbar.selectAssetMenu` observing `FindItBuildingMenu.BuildingLensMenu`, wait 2.5 s, `readBindings` the three paths + page, count refreshes, `toolbar.clearAssetSelection`; All menus via `FindItBuildingMenu.ClearBuildingLensMenuScope`; the search inside Landscaping; exceptions before/after; `evaluate`; `report`; write `tools/e2e/artifacts/findit-smoke/<YYYYMMDD-HHMMSS>-<sha>.md` (sha from `git rev-parse --short HEAD`); print; exit 0/1. Always close the client. Read binding output through `readBindings({ client, paths, waitMs: 2500 })` — it returns `{ [path]: { got, value } }`.
- [ ] **Step 4:** `just e2e` green with the new test; `node tools/e2e/findit-lens-smoke.mjs` with no args exits 1 naming `--agent`.
- [ ] **Step 5:** Commit `test(e2e): a scripted smoke that drives the lens through the cs2-qa bridge and writes its report to an artifact (cm-jjlv.11.5)`; close cm-jjlv.11.5.

---

### Task 6: Run it, refresh the record, close

- [ ] **Step 1:** Build, deploy to `949230-c` gated on `cs2-status` no-game, launch (`--no-steam --headless --check-menu`, CDP 9557), load Porterville 3. Run
  `node tools/e2e/findit-lens-smoke.mjs --http http://127.0.0.1:9557 --agent claude-swift-ocelot-gZs --prefix 949230-c` → exit 0, artifact written. Run again with `--agent nobody` → exit 2, no menu opened (no new `[LENS-REFRESH]`).
- [ ] **Step 2:** `docs/verification.md`: insert the header block from the spec §4 above the first `##`, with the run's date, sha and artifact path; append `## 2026-09-02 — render harness and scripted smoke (phase 7)` with the smoke's report pasted and the test counts (unit / render / C#). Stop the game (lock/stop/unlock under `CS2_PREFIX=949230-c CDP_URL=http://127.0.0.1:9557`).
- [ ] **Step 3:** close cm-jjlv.11.6 and cm-jjlv.11; commit `docs(findit): the live record names how to re-run itself and the commit it last ran on (cm-jjlv.11.6)`; merge to master in the MAIN checkout with `git -C`, `just test findit-building-menu` + `just e2e` on the merged tree, push; update memory `findit-remediation-state.md`.
