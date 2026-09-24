# Splitting PrefabIndexingSystem

Date: 2026-09-24. Status: approved by the owner the same day, with decisions 1–3
below taken as recommended. Roadmap: "Split `PrefabIndexingSystem` further" in
[roadmap.md](../../roadmap.md).

## Goal

Move the logic that turns what the game holds into what the panel shows out of
`PrefabIndexingSystem` and into plain classes that a test can call. The system
keeps every read of the game (`EntityManager`, `PrefabSystem`, the localization
dictionary) and every log call; the new classes take the values it read and
return the facts, lines or tables it used to compute in place.

Nothing a player sees changes, and every log line stays byte-identical.

## Where it stands

`PrefabIndexingSystem` is one partial class across six files in `Systems/`, 3,338
lines at `cbdaee1`. None of it uses Burst or jobs; the only native containers are
`Allocator.Temp` and `TempJob` ones, which stay in the system.

| File | Lines | What it does |
|---|---|---|
| `PrefabIndexingSystem.cs` | 1,038 | Load lifecycle, unlocks, `RunIndex` and its census, `BuildIndex`, `AddPrefab`, placed uniques |
| `.Facts.cs` | 915 | `PopulateAnalyticalData` (lines 46–591), bonuses, extractor features, supported upgrades, vanilla asset facts, parking |
| `.MenuAudit.cs` | 303 | `LogVanillaMenuAudit`, `LogVanillaMenuCoverage`, `Cap` |
| `.Menus.cs` | 209 | The walks over vanilla's menus, asset menus and categories |
| `.Progression.cs` | 512 | Milestones, the dev tree and its ranking, `DevTreeBranchOf`, unlock requirement wording |
| `.Zones.cs` | 361 | Zones, their building-side tiers, extractor areas |

Some of the logic has already moved: `VanillaMenuAudit.Compare`, `DevTreeGates`,
`ZoneDensityClassifier`, `ServiceUpkeepSummary`, `SpeedLimit` and others live in
`Domain/` with tests. What is left is mostly the gathering around them, and
`PopulateAnalyticalData`, which maps about 45 components onto a `PrefabIndex` and
has no test at all.

## The seams

**`PopulateAnalyticalData` → `PrefabComponents` + `PrefabFacts`.** Built in #51 as
`PrefabSnapshot`, since `Game.Prefabs.PrefabComponents` is already an enum and
the two names would clash wherever both namespaces are imported.
- `Domain/PrefabComponents.cs`: a sealed class the system fills from the entity,
  one nullable game struct per component it reads (`WorkplaceData? Workplace`,
  …), the two buffers as arrays, and the handful of values that come from the
  prefab object or other entities (road flags, elevation cost, the extractor's
  resource, the zone's lot sizes). Game component structs have public fields, so
  a test can build one: `new SchoolData { m_StudentCapacity = 500 }`.
- `Domain/PrefabFacts.cs`: `static bool AppliesTo(PrefabCategory)`, which the
  system asks before reading anything, so a prop still costs nothing; and
  `static void Apply(PrefabComponents components, PrefabIndex prefabIndex)`, the
  current mapping moved verbatim. `Fact`, `TextFact`, `PollutionModifierFact` and
  `ResourceName` move with it.
- `.Facts.cs` keeps a `ReadComponents(entity, prefab, zones)`: a flat list of
  `TryGetComponent` calls with no logic.

**The menu audit → `VanillaMenuCoverage` + `IndexAuditLog`.**
- `VanillaMenuCoverage.Compare(CatalogIndex, Func<Entity, string> describeMissing)`
  returns the coverage report: buckets keyed on menu and category, totals, the
  entries filed elsewhere. `describeMissing` stays in the system, since it asks
  the game about each missing prefab, and is called only for those.
- `VanillaMenuAudit` gains the gathering half of `LogVanillaMenuAudit`.
- `IndexAuditLog` turns reports into `(severity, text)` lines, with `Cap`. It
  returns lines rather than logging because anything that touches `Mod` cannot
  run in a test (docs/ci.md); the system logs them in order. The
  `[PROCESSOR-CENSUS]` lens count moves here too.

**Progression and zones.**
- `DevTreeBranchOf`: only its service lookup reads the game. The rest becomes
  `ProgressionIndex.BranchOf(required, service, menu)`.
- Dev-tree ranking becomes `DevTreeLayout.Rank(nodes)`, over each node's column
  and row, and the folds apply to its result. The system still logs a fold that
  matches nothing.
- The zones' building-side tiers (`.Zones.cs:115–136`) become
  `ZoneDensityClassifier.ClassifyBuildings(...)`.

## Steps

Each step is one PR that builds with no warnings, runs every test against the
real game assemblies, and changes no behaviour.

| # | PR | Risk | New tests |
|---|---|---|---|
| 1 | **The menu audit leaves the system.** `VanillaMenuCoverage`, the gathering half of the audit, `IndexAuditLog`, the census lens count. | Low: logs only | A placed zone counts in `vanilla=` but never as missing; an entry filed elsewhere shows as `X->Cat` or `X->none`; a clean bucket logs no line; the summary is Info at 0 missing and Warn otherwise; buckets in ordinal order; `describeMissing` never called for held assets; `Cap` adds `,…` at 9 names and not at 8; one golden `[MENU-AUDIT]` line. |
| 2 | **`PopulateAnalyticalData` becomes `PrefabComponents` + `PrefabFacts`.** | Medium: every fact passes through it | A network's cost and upkeep ×125 with `CostIsPerDistance`; an annex priced from its upgrade cost; ConsumptionData upkeep overriding a network's, and money in the upkeep buffer overriding both; zero helicopters emit no fact; a road's electricity connection emits no capacity; the elevated width only when it differs by more than 0.01; the telecom range over the coverage range; household facts per zone cell; footprints for zones only; `AppliesTo` false for decals; one golden hospital pinning the whole `ServiceFacts` order. |
| 3 | **Progression and zone seams.** `ProgressionIndex.BranchOf`, `DevTreeLayout.Rank`, the folds, `ClassifyBuildings`. | Low | An education column with its trunk at row 1 ranks University, then Technical, then Medical; column beats row; an asset with no gate falls to its menu's root; a fold into a node with no label is reported as unmatched; the five building-side tiers, and a lot width of 0 as Row. |
| 4 | (Optional) **Bonuses, parking, vanilla asset facts.** | Low | After step 2's golden tests are in. |

### What must stay the same

- **Step 1:** every tagged audit line, its level and its order, the `—` and `…`
  characters, and the Error lines when the audit itself fails.
- **Step 2:** the order facts are emitted in, which fields stay null, and the
  arithmetic types. For example, `m_ElevationCost * 125f` is a float, and the
  `Math.Round` calls must stay where they are.
- **Every step:** `Indexed Prefabs Count`, `[PROCESSOR-CENSUS]`, `[MENU-AUDIT]`
  and `[MENU-COVERAGE]` from one save, diffed before and after.

### Checks per step

- The C# and UI suites and a clean `CI=true` build, then `./build.sh test`
  against the real game assemblies.
- **Step 2:** `BetterBuildingMenu/UI/test/factCoverage.test.ts` scans
  `Systems/PrefabIndexingSystem*.cs` for `Fact(prefabIndex, "…"` to check every
  fact id has a UI label. It must read `Domain/PrefabFacts.cs` too, and the
  mapper keeps the parameter name `prefabIndex`. The test fails loudly if it
  finds nothing, but only in the UI job.
- In game, the log diff above on one save.

### Tests that already cover part of this

`VanillaMenuAuditTests`, `ServiceUpkeepSummaryTests`, `SpeedLimitTests`,
`DevTreeGatesTests` and `ZoneDensityClassifierTests` cover the helpers the moved
code calls. The new tests cover the wiring around them, not the helpers again.

## Decisions for the owner

Decided on 2026-09-24: each as recommended.

1. **Audit output: returned lines, or an injected logger?** Returned lines keep
   the new classes free of `Mod` and any interface. **Recommended: returned
   lines.**
2. **`PrefabComponents` (built as `PrefabSnapshot`): a class, or a struct passed by reference?** A class is
   simpler and costs one allocation per indexed prefab, about 17,700 per full
   pass, beside the `PrefabIndex` each one already allocates. **Recommended: a
   class.**
3. **Step 4: now or later?** **Recommended: later**, once step 2's golden tests
   exist to catch a slip.

## Found while planning, out of scope

`.Menus.cs:145` and `:201` sort menus and their tabs by priority with
`List.Sort`. The comment at `:193` says tabs that never set a priority keep
their query order, but `List<T>.Sort` is not stable: it happens to keep order
for 16 items or fewer and not beyond. A menu with more than 16 tabs, or a
playset whose mods add enough menus, could see equal-priority entries swap. The
fix, a stable `OrderBy`, can change the order a player sees, so it is a separate
PR.

Found while building step 2: the upkeep change on a service upgrade could never
go below zero. It started from 1 and took the largest multiplier that was not 1,
where vanilla's `UpkeepModifierBinder` takes the largest of them all from 0, so
an upgrade whose only multiplier is 0.8 showed +0 % instead of −20 %. #51 fixes
it in a commit of its own.

## Docs to update as the steps land

`docs/indexing.md` ("one partial class across six files"),
`docs/vanilla-upgrades.md`, the `PrefabIndex.ParkingSlots` doc comment, and the
`ZoneIndex` remarks.
