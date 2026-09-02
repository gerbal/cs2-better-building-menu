# Building Lens UX Critique

Date: 2026-08-03
Auditor: `ux-audit-1`
Scope: `cs2-better-building-menu/` Building Lens — interaction model, information
architecture, task flow, and decision usefulness. Pixel-level styling is covered by
`ui-spacing-typography-audit.md` and is not re-reported.

## Evidence status — read this first

**A fresh live game session could not be launched for this audit.** Both unattended
launch paths failed on this host:

- `--no-pdx` direct launch (two attempts, before and after clearing the stale
  `playset_config_lock.json`): fatal
  `Colossal.IO.AssetDatabase.PopulateFromDataSource` NullReferenceException cascading
  into a `Game.SceneFlow.GameManager.Update`/`OnGUI` NRE loop before any menu; CDP
  never became reachable. This is the same environment failure tracked in `cm-8e0`
  and recorded repeatedly in `docs/verification.md`.
- `--full-chain` (two attempts): Steam never spawned the dowser/Paradox launcher
  chain for a headless request; the wrapper polled to timeout ("Launcher may need
  manual Play click").

Because of this, every finding below is tagged with its evidence class:

- **[ARCHIVED-LIVE]** — directly observed in the archived Gameface artifacts of the
  build in this working tree (settled screenshots and DOM observations from
  `tools/e2e/artifacts/e2e-20260802-findit-ux-followthrough/` and the 2026-08-01
  runs). These are real live observations, but from a prior session, not this one.
- **[STATIC]** — verified by this audit in the current source (file:line cited).
  High-confidence logic conclusions, not live-reproduced.
- **[UNVERIFIED]** — stated as inference; needs a live pass to confirm.

Test gates at audit start and end: backend 58/58, frontend 60/60. No source was
modified by this audit.

## Verdict

The Building Lens is a capable query engine wearing the UI of a debug console. The
backend is genuinely good: bounded paging, typed facets, composable predicates,
defensive offset resets on most mutations, a readiness status, and placement reuse.
But the player-facing layer fractures across **three state owners** (backend query,
client React state, legacy FindIt state) and **four filter surfaces**, and the
result is that the headline player journey — *shortlist buildings, compare them,
place one, come back and continue* — structurally cannot be completed without
losing work. The analytical columns, the feature's whole reason to exist, lack the
semantics (units, comparable capacity, the pollution/utility data the roadmap
promised) that would let a player actually decide with them.

The prior audits fixed real things (localized row labels, a filter summary, debounce,
readiness copy, accessible names). Those fixes are visible in the archived
2026-08-02 screenshot. They do not change the structural problems below.

---

## 1. Task-flow analysis

### Journey A — find a specific building by name

Open FindIt (toolbar icon) → enable lens (second icon) → type name → row → place.

Works, with two breaks:

- **A1. Searching from any page past the first strands the player on a phantom
  zero-state. [STATIC — Critical]**
  `SearchChanged` (`BetterBuildingMenu/Systems/BuildingMenuUISystem.Bindings.cs:331-347`) refreshes
  the catalog without resetting `Offset`; every other mutation resets it
  (`Bindings.cs:122-156`, `BetterBuildingMenu/Domain/BuildingCatalogFacetSelection.cs:28-34`,
  `BuildingCatalogMetricRange.cs:57-62`). The backend clamps only negative offsets
  (`BetterBuildingMenu/Domain/BuildingCatalogQuery.cs:46`), so a search issued while on page 3
  (offset 200) that matches 30 items returns an empty `items` slice with
  `totalCount = 30` and status `ready`
  (`BetterBuildingMenu/Systems/BuildingMenuUISystem.Methods.cs:90`). The UI then renders **"No
  buildings match the current search and category."**
  (`BetterBuildingMenu/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:321-326`) while the
  pager — which normalizes the offset *for display only*
  (`BetterBuildingMenu/UI/src/domain/buildingCatalogContracts.ts:128-138`) — claims
  "Rows 1–30 of 30 · Page 1 of 1". The panel tells the player their search has no
  results when it has 30, and simultaneously shows a pager describing rows that are
  not on screen. Recovery requires guessing that "Previous page" (enabled, because
  raw `offset > 0`) will fix a screen that claims to have one page.
  **Fix:** reset `Offset` to 0 in `SearchChanged`, and clamp `EffectiveOffset`
  against `TotalCount` server-side so no stale offset can ever produce this page.

- **A2. Search scope is invisible. [ARCHIVED-LIVE — Major]** The search box is the
  legacy FindIt search ("Search…", top bar); with the lens enabled its results are
  the lens table. Nothing indicates whether the query covers all 19,288 assets or
  the 4,206 lens records — and the top bar count says "19,288 items" while the lens
  corner badge says "4206" (both visible in
  `e2e-20260802-findit-ux-followthrough/building-lens-populated.png`). Two
  different totals with no labels forces the player to reverse-engineer the scope.
  **Fix:** one count, labeled, in one place ("4,206 buildings — 128 match"), and
  scope the search placeholder ("Search buildings…") while the lens is active.

### Journey B — browse a category and compare candidates

Open lens → pick section tab → subcategory → scan rows → `+` three rows → compare
tray → `Place`.

- **B1. The compare tray self-destructs at the exact moment it is used.
  [STATIC — Critical]** `compareEntries` is client React state
  (`BuildingCatalog.tsx:92`), and the whole panel unmounts whenever it is not
  visible (`FindIt/UI/src/mods/MainContainer/MainContainer.tsx:78` — `return
  null`). The panel is auto-closed by the game whenever the prefab or tool changes
  outside FindIt's own activation path
  (`BetterBuildingMenu/Systems/BuildingMenuUISystem.Methods.cs:260-287`): placing the chosen
  building and then leaving the placement tool (Esc/right-click → default tool)
  fires `OnToolChanged` → `ToggleFindItPanel(false)` → unmount → the shortlist is
  gone. The one flow the tray was built for — compare three, place one, come back
  and try the runner-up — cannot be completed. The 2026-07-26 parity run verified
  close/reopen "preserving state" for the *query*, which lives in C#; the tray and
  sort presentation do not.
  **Fix:** move compare state into a backend binding beside
  `BuildingLensSection` (the pattern already exists), or at minimum a
  module-scope store that survives unmount.

- **B2. Compare is capped at 3 with no feedback about why. [STATIC — Minor]**
  The `+` button silently disables at the cap
  (`BuildingCatalog.tsx:384-393`); the only "3/3" indicator is inside the tray
  header. Fine as a bound, but the disabled `+` has no tooltip explaining it.

- **B3. The tray compares only 4 of 7 visible metrics, as prose. [STATIC —
  Major]** The tray renders "Cost … · Upkeep … · Workers … · Capacity …" as a
  single text run per row (`BuildingCatalog.tsx:263-265`) — not aligned columns,
  and it drops Lot, Level, Parking, plus everything in section 5 below. A compare
  surface that cannot be visually compared column-by-column is a list, not a
  comparison. **Fix:** align tray metrics under the same column grid as the table,
  include all columns, highlight best/worst per metric.

### Journey C — constrained search ("cheap high-capacity school")

The player must discover and combine: section tab `Service` → subcategory
`Education & Research` → the Education capacity preset row that appears only then
(`BuildingCatalog.tsx:215-234`) → the `Metric filters` drawer for a Cost maximum →
optionally sort by Cost. That is four separate control surfaces for one sentence of
intent.

- **C1. Overlapping capacity controls with different lifetimes. [STATIC — Major]**
  Capacity now has two homes: the Education preset (`Any/100+/500+/1000+`) and the
  metric drawer's Capacity min/max. The backend composes them correctly
  (`Methods.cs:50-56`, greater-of), but the *rules* are invisible: the preset
  resets when the subcategory changes (`Bindings.cs:211-228` via
  `IsEducationCapacityFilterVisible`), the metric range does not; clearing one
  leaves the other; the filter summary lists them as separate entries. A player
  cannot predict which of their two capacity floors is in force.
  **Fix:** fold the preset into the Capacity metric as quick-set chips; one
  capacity control, one lifetime.

- **C2. Compound constraints have no summary you can act on. [STATIC — Major]**
  The unified summary counts facets but does not name them ("2 facets" —
  `BetterBuildingMenu/UI/src/domain/buildingLensFilterSummary.ts:100-104`), and none of the
  entries are removable chips: the only actions are per-drawer `Clear` and the
  global `Clear lens filters`. Removing *one* wrong constraint means reopening the
  right drawer and finding it again. **Fix:** removable chips per active
  constraint, each named ("DLC: San Francisco ×", "Cost ≤ 50,000 ×").

### Journey D — place and resume

Covered by B1: resume is broken. Additionally:

- **D1. Sort presentation lies after reopen. [STATIC — Critical]** `sortColumn` /
  `descending` are client state initialized to `Name`/ascending
  (`BuildingCatalog.tsx:89-90`), while the backend query keeps its last sort
  (`Bindings.cs:122-147`; nothing resets it on panel toggle —
  `Bindings.cs:229-262`). After any unmount/remount cycle the sort bar shows
  "Name ▲" over a list still ordered by, say, Cost ▼. The player's most basic
  orientation cue — "what order am I looking at?" — is wrong until they click a
  sort option, which also snaps them back to page 1. **Fix:** make the backend
  sort state a binding the UI reads (exactly like `BuildingLensSection`), and
  derive the indicator from it.

- **D2. Whole-row-click places immediately. [ARCHIVED-LIVE hint exists; STATIC —
  Major]** The entire row is one `Place` button (`BuildingCatalog.tsx:341-383`);
  the "Place" pill is `opacity: 0` until hover/focus
  (`buildingCatalog.module.scss:781-798`). There is no inspect/preview action at
  all — no way to look at a building's details without entering the placement
  tool. In a decision tool, the primary click should not be the irreversible-feeling
  action. **Fix:** row click selects/expands a detail row (where the hidden
  metrics of section 5 belong); explicit `Place` button places.

### Journey E — first open during indexing

The `indexing` status exists and is distinct (`BuildingCatalog.tsx:98-99, 321-326`;
`Methods.cs:90`; `BuildingCatalogLensState.cs:13-35`) — good. But
`GetPageStatus` keys off `IsReady` and `TotalCount` only, so the A1 stale-offset
case reports `ready` and shows the *false* zero-state. The archived 2026-08-02 run
could not visually capture the indexing copy (the save indexed too fast), so the
indexing state remains **[UNVERIFIED]** visually — as the artifact itself honestly
records.

---

## 2. Information architecture

- **IA1. Four filter surfaces, two "Filters" labels, three "Clear" scopes.
  [STATIC — Critical]** With the lens open a player faces: (1) the legacy FindIt
  options drawer (top-bar funnel icon, labeled "Filters" in its tooltip) with
  theme/DLC/parking/extras; (2) the lens facet drawer (button also labeled
  "Filters") with Source/DLC/Theme/Asset pack/Placement/Extensions; (3) the
  `Metric filters` drawer; (4) the contextual Education preset. Two of these
  filter the same dimensions (DLC, theme) through different code paths, and the
  clears are scoped differently: top-bar `Clear Filters` (legacy),
  `Clear facets`, `Clear metric ranges`, `Clear lens filters` (facets + metrics +
  preset — but **not** legacy filters or search). No player can form a mental
  model of which "Filters" or which "Clear" does what.
  **Fix:** while the lens is active, present one filter surface; migrate or hide
  the legacy drawer's building-relevant toggles.

- **IA2. Legacy filters shape the lens invisibly. [STATIC — Critical]** The lens
  table applies the legacy grid's non-search predicates to its source
  (`BetterBuildingMenu/Services/BuildingCatalogAdapter.cs:146`), and parking maps into the
  typed query (`Methods.cs:64-72`). None of this appears in the lens filter
  summary (`buildingLensFilterSummary.ts:92-113` reads only facets, metric
  ranges, capacity floor). Concretely: a player who once toggled "Without parking"
  in the legacy drawer opens the lens later, sees 1,644 of 4,206 records and the
  summary text **"No active lens filters"**. Filter conflicts across the two
  systems (legacy DLC = X AND facet DLC = Y) produce zero results that neither
  surface explains. This is the single worst trust-breaker in the design.
  **Fix:** include every active predicate — legacy, search, category — in the
  summary, or sever the legacy predicates from the lens query entirely.

- **IA3. Zero results never name the culprit. [ARCHIVED-LIVE + STATIC — Major]**
  The only ready-empty copy is "No buildings match the current search and
  category." (`BuildingCatalog.tsx:325`) even when the cause is a facet, a metric
  range, the preset, or an invisible legacy filter — the message actively points
  at the wrong knobs. There is no "clear filters" action in the empty state
  itself. **Fix:** empty-state copy that enumerates active constraint groups with
  one-click removal ("0 results — active: Cost ≤ 10,000, DLC: San Francisco").

- **IA4. Facet taxonomy overlaps itself. [ARCHIVED-LIVE — Major]** In the
  2026-08-01 facet capture, `Source → Base game` and `DLC → Base game` both
  exist. Two groups offering the same option teaches players the facets are
  arbitrary. The Extensions facet mixes a fundamentally different concept (109
  specific building-extension names — effectively an entity picker) into the same
  multi-select UI as six-option groups. **Fix:** dedupe Source/DLC; give
  Extensions a searchable picker or move it out of the facet drawer.

- **IA5. Lens vs. full catalog is a hidden mode with hidden costs. [STATIC —
  Major]** The lens replaces FindIt's tabs with its own five sections and swaps
  the grid for the table — but the top bar keeps legacy controls that silently
  change meaning: the Sorting button still opens the *legacy* sort dropdown,
  which has **no effect** on the lens table (lens sorting is
  `SetBuildingCatalogSortColumn`; the legacy dropdown drives
  `BuildingMenuUtil.SetSorting` for the grid). Random selection likewise operates on
  legacy state. A mode switch that leaves dead controls active is worse than
  either mode alone. **Fix:** hide or rewire legacy-only controls while the lens
  is enabled.

---

## 3. Discoverability and affordance

- **DS1. The feature is behind an unlabeled icon behind another icon.
  [ARCHIVED-LIVE — Major]** Reaching the lens requires knowing the FindIt
  magnifier, then picking the small building-zone SVG among ~9 icon-only top-bar
  buttons (`TopBar.tsx:328-334`; visible in the 2026-08-02 screenshot). Tooltip
  and aria labels exist ("Enable building lens"), but a tooltip is confirmation,
  not discovery — nothing invites a player who doesn't already know the lens
  exists. **Fix:** first-run hint or a labeled mode switch next to
  Catalog/Tools.

- **DS2. Column headers look sortable and are not. [STATIC — Major]** The
  metric headers are inert `span`s (`BuildingCatalog.tsx:292-318`); sorting
  lives in a separate "Sort by Name ▲ / More sorting" disclosure with ten text
  buttons (`BuildingCatalog.tsx:169-206`). Every data table a player has ever
  used sorts by clicking the header. The current design spends a full toolbar row
  to provide, less discoverably, what the header row could do in place.
  Direction toggling also requires re-clicking the same option inside the
  disclosure (`nextSortState`), i.e. up to 3 clicks to flip a sort.
  **Fix:** clickable headers (click = sort, click again = flip), keep the
  disclosure for the non-column sorts if needed.

- **DS3. Icon-only tabs for the core taxonomy. [ARCHIVED-LIVE — Major]** The
  five lens sections and subcategories render as small unlabeled icon tabs on the
  right edge, physically distant from the left-aligned title (2026-08-02
  screenshot). Vanilla's toolbar communicates the same taxonomy with icons *the
  player already learned*; the lens re-uses some of that iconography but at
  smaller size, without text, in a new location. **Fix:** icon + label tabs, or
  at least a persistent label of the active section near the title (the subtitle
  slot currently spends its space on "Buildings from the FindIt index" —
  implementation-speak that helps no player).

- **DS4. "CATALOG" clips inside its own selected state. [ARCHIVED-LIVE —
  Minor]** In the 2026-08-02 capture the selected Catalog/Tools switch highlight
  truncates the word ("CATALO…"). Small, but it is the first control a player
  reads at the top of the panel.

- **DS5. The one genuinely discoverable pattern is buried praise-worthy:** the
  facet drawer's ✓/○ markers, scroll hints, and title attributes (facet panel,
  post-2026-08-01 fixes) are the right idea — but the drawer toggle strings
  ("Filters", "Hide filters", "Scroll for more filters") are hardcoded English
  (`BuildingCatalogFacetPanel.tsx:37,49-57`), unlike the localized rest.

---

## 4. State and feedback

- **SF1. State amnesia is systemic, not incidental. [STATIC — Critical, umbrella
  of B1/D1]** Everything backend-owned survives (search, category, facets,
  ranges, offset, width); everything client-owned dies on unmount: compare tray,
  sort presentation, `sortingExpanded`, both drawer open-states, Catalog/Tools
  mode (`MainContainer.tsx:49`). The player experiences an interface that
  remembers their *filters* but forgets their *shortlist and orientation* —
  the exact inverse of what a decision session needs.

- **SF2. Metric drawer feedback is silent in three ways. [STATIC — Major]**
  (1) Invalid input is dropped without any signal — `TryParse` fails and the
  trigger simply never fires (`Bindings.cs:190-200`), so a typo'd "50k" leaves
  the previous bound active while the text shows "50k" until the next binding
  echo overwrites the draft mid-edit (`BuildingCatalogMetricFilters.tsx:117-132`
  resets drafts whenever the echoed state changes). (2) Reversed bounds are
  silently swapped server-side — defensible, but combined with (1) the player
  cannot tell corrected input from rejected input. (3) There is no per-metric
  clear; only drawer-wide `Clear`. **Fix:** inline validation state on the
  input, don't overwrite a focused draft, per-row ×.

- **SF3. The filter summary is a counter, not a summary.** Covered by C2/IA2.

- **SF4. Pager offers no random access. [ARCHIVED-LIVE — Minor]** 43 pages,
  prev/next only (`BuildingCatalog.tsx:399-421`). With working sort+filter this
  is survivable; it still makes "somewhere in the middle" a 20-click trip.

---

## 5. Cognitive load — are the columns decision-useful?

- **CL1. The promised decision metrics are plumbed and then not shown.
  [STATIC — Critical for the feature's premise]** The adapter projects
  electricity, water, garbage, water/sewage capacity, and ground/air/noise
  pollution for every entry (`BuildingCatalogAdapter.cs:180-195`), fulfilling
  roadmap item 3 — and no UI surface renders any of them. The columns a player
  actually gets are Cost, Upkeep, Workers, Capacity, Lot, Level, Parking
  (`BuildingCatalog.tsx:51-64`). For the canonical service-building decision
  (schools, power, water), pollution and utility draw are *the* differentiators;
  Level is meaningless for service buildings (renders `0` for every service row
  in both archived screenshots) and Parking is a niche bit given a whole column.
  The feature ships the spreadsheet and withholds the columns that motivated it.
  **Fix:** a row-expand detail (see D2) showing the full projected set; replace
  the Level column with something universally meaningful or hide it per
  category.

- **CL2. Numbers have no units, no currency, no locale formatting in-game.
  [ARCHIVED-LIVE — Major]** Rows show `115000`, `5600000` — no `₡`, no
  thousands separators in the live render (both archived screenshots; the code
  calls `toLocaleString` (`BuildingCatalog.tsx:72-80`) but the Gameface runtime
  renders bare digits — a seven-digit number at ~8px is a counting exercise).
  Upkeep does not say "/month". Lot "4 × 6" has no unit (cells). Capacity 2000
  (students?) sits above Capacity 500 (burial plots?) in the same column with no
  hint that they measure different things — sorting All-buildings by Capacity
  interleaves incomparable quantities. **Fix:** explicit units in headers or
  values ("₡115K", "₡10K/mo"), grouping separators verified in-engine, and a
  per-category capacity label ("2,000 students").

- **CL3. "—" means three different things. [STATIC — Minor]** Null metric
  (`formatMetric`, `BuildingCatalog.tsx:72-80`), "no parking"
  (`BuildingCatalog.tsx:380-382`), and unbounded range side all render as a
  dash. A player cannot distinguish "not applicable", "zero", and "no".

- **CL4. Density default is hostile at common resolutions. [ARCHIVED-LIVE —
  Major]** At 1280×720 the settled default shows ~5 rows: title + subtitle +
  sort row + summary row + drawer-toggle row + header row consume roughly the
  top 45% of the panel before the first building (2026-08-02 screenshot). Both
  drawers open push rows further down. The panel exists to scan buildings, and
  scanning area is the first thing sacrificed. **Fix:** collapse
  title/subtitle/summary into one row, move drawer toggles into the header row,
  reclaim two full rows of results.

---

## 6. Vanilla consistency

- **VC1. Paradigm break, undeclared. [ARCHIVED-LIVE — Major]** Vanilla's build
  menu is thumbnail-first: large images, few words, categories the player
  navigates spatially. The lens is text-first with ~40rem thumbnails and 7
  numeric columns. That can be a legitimate power-tool choice — but the lens
  *replaces* the vanilla-shaped taxonomy while keeping none of vanilla's visual
  vocabulary for items, so it reads as a third-party admin panel docked into the
  game. The 2026-08-01 taxonomy work aligned the *categories* with vanilla;
  the presentation is still foreign (typography at/below the game's XXS step —
  see spacing audit; ✓/○ text markers where vanilla uses checkbox art;
  hardcoded-English strings around localized ones).
- **VC2. Localization regression risk is structural. [STATIC — Major]**
  `Locale.json` contains 214 successor keys, but none of the lens-specific keys
  the UI requests exist (`BuildingLens`, `BuildingLensDescription`,
  `CompareBuildings`, `Place`, `MoreSorting`, `NoBuildings`, `ClearCompare`,
  `SortBy`, metric header keys `Lot`/`Level`/`Parking`, `EnableBuildingLens` —
  all 0 hits; only `EducationCapacityFilter` and a few others exist). Every one
  of those `translate()` calls falls back to its English literal today, in *all*
  languages, and additional strings never pass through `translate()` at all
  (facet drawer toggles, sort option labels
  (`buildingLensSortPresentation.ts:20-31`), summary text
  (`buildingLensFilterSummary.ts:38-45,107`), pager strings
  (`buildingCatalogContracts.ts:137`), compare tray metric prose). A non-English
  player gets a half-translated panel. **Fix:** add the missing keys, route the
  hardcoded strings through l10n, and lint that every UI literal has a key.

---

## Ranked findings summary

| # | Sev | Evidence | Finding | Cite |
|---|-----|----------|---------|------|
| 1 | Critical | STATIC | Compare tray + sort presentation destroyed by the place/resume flow (unmount + auto-close) | BuildingCatalog.tsx:89-92; MainContainer.tsx:78; Methods.cs:260-287 |
| 2 | Critical | STATIC | Search from page >1 → false "No buildings match" + lying pager | Bindings.cs:331-347; BuildingCatalogQuery.cs:46; BuildingCatalog.tsx:321-326 |
| 3 | Critical | STATIC | Legacy FindIt filters shape lens results while summary says "No active lens filters" | BuildingCatalogAdapter.cs:146; buildingLensFilterSummary.ts:92-113 |
| 4 | Critical | STATIC | Sort indicator lies after reopen (client/backend split-brain) | BuildingCatalog.tsx:89-90; Bindings.cs:122-147 |
| 5 | Critical | STATIC | Promised pollution/utility metrics projected but never rendered; shown columns weakly decision-relevant | BuildingCatalogAdapter.cs:180-195; BuildingCatalog.tsx:51-64 |
| 6 | Major | STATIC | Four filter surfaces / three clear scopes / duplicated DLC+theme dimensions | IA1, C1, C2 above |
| 7 | Major | STATIC+AL | Zero results never name the active constraints; copy blames wrong knobs | BuildingCatalog.tsx:325 |
| 8 | Major | AL | Unitless, separator-less numbers; cross-type Capacity column | 2026-08-02/08-01 screenshots |
| 9 | Major | STATIC | Headers not sortable; 3-click direction flip; dead legacy Sorting button in lens mode | BuildingCatalog.tsx:292-318,169-206 |
| 10 | Major | AL | Discoverability: unlabeled lens toggle, icon-only taxonomy tabs, two disagreeing counts | TopBar.tsx:328-334; screenshots |
| 11 | Major | STATIC | Metric drawer: silent invalid-input drop, draft clobbering, no per-metric clear | Bindings.cs:190-200; BuildingCatalogMetricFilters.tsx:117-132 |
| 12 | Major | STATIC | Whole-row = Place; no inspect action; hover-only hint | BuildingCatalog.tsx:341-383; scss:781-798 |
| 13 | Major | STATIC | Lens strings missing from locale files + hardcoded English UI text | Locale.json; buildingLensSortPresentation.ts:20-31 |
| 14 | Major | AL+STATIC | ~5 visible rows at 720p; 45% of panel is chrome | 2026-08-02 screenshot |
| 15 | Major | AL | Facet taxonomy overlap (Source vs DLC "Base game"); 109-entry Extensions facet in a 96px column | 2026-08-01 capture; verification.md |
| 16 | Minor | STATIC | "—" overloaded (null / no-parking / unbounded) | BuildingCatalog.tsx:72-80,380-382 |
| 17 | Minor | STATIC | Education preset one-off lifetime vs metric range | Bindings.cs:211-228 |
| 18 | Minor | AL | Prev/next-only pager over 43 pages | BuildingCatalog.tsx:399-421 |
| 19 | Minor | AL | "CATALOG" label clipped by selected state | 2026-08-02 screenshot |
| 20 | Minor | STATIC | Drawer/mode/disclosure open-states reset on reopen | MainContainer.tsx:49; BuildingCatalog.tsx:91,104 |

## What this audit could not verify

- Any live reproduction in a running game this session (launch blocked — see top).
  Findings 1, 2, 4 are logic-verified from source but their exact on-screen
  presentation is inferred; a future live pass should reproduce all three
  (they are cheap to script: offset-then-search; sort-close-reopen;
  compare-place-esc-reopen).
- The visual `indexing` state (also uncaptured by the archived run).
- Gameface-runtime claims from the earlier design audit (`currentColor`,
  `object-fit`, `:not()`): not retested here; the thumbnail `object-fit`
  dependency (`buildingCatalog.module.scss`) remains unconfirmed either way and
  the archived screenshots show undistorted thumbnails, which weakens but does
  not settle that claim.
- Controller/keyboard traversal of the lens (never tested in any run to date).

## Recommended order of work (by player impact, not effort)

1. **Make state survive the loop** (findings 1, 4, 20): backend-own compare +
   sort presentation; stop auto-closing on tool exit while the lens is active, or
   restore full lens state on reopen.
2. **One honest filter model** (3, 6, 7, 17): every active predicate in one
   summary with removable chips and one Clear-all; empty states that name
   constraints; merge the capacity controls.
3. **Fix the paging lie** (2): offset reset on search + server-side clamp.
4. **Make the table decide** (5, 8, 9, 12): sortable headers, units, per-category
   capacity labels, row-expand details with the already-projected
   pollution/utility metrics, explicit Place button.
5. **Say what things are** (10, 13, 19): label the lens entry point, localize,
   reconcile the two counts.
6. Density and pager polish (14, 18).
