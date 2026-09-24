# Per-load catalog index

Date: 2026-09-24. Status: approved by the owner the same day, with decisions 1–7 below
taken as recommended. Decision 8 came from the live-testing review; the owner chose (a). Steps 1–6
are built (#32, #33, #36, #37, #38, #40, #42, #43). Roadmap: "Per-load state" in
[roadmap.md](../../roadmap.md).

## Goal

Replace the static index, caches and registries with one object. It is built
by a full pass, published when the pass succeeds, and handed to the systems
that read it.

Three problems today:

1. **State outlives its city.** Nothing is cleared at preload or on the way
   back to the main menu. City A's index and `IsReady` stay until city B's
   first pass succeeds. If that pass fails, the panel keeps serving city A's
   index in city B.
2. **Tests share process-wide state.** Three test classes write statics:
   - `ContentFacetTests` writes the toolbar selection;
   - `AvailabilityStateTests` writes the placed uniques;
   - `BuildingCatalogQueryEngineTests` writes `IsReady` and the index.

   So the C# tests run one class at a time, each restores what it set, and
   no test can hand the adapter a small index of its own.
3. **A full pass reads its own half-built output** through the same statics
   the panel reads. The pass is atomic only because `RunIndex` captures 14
   references and puts them back if the pass throws, and because everything
   runs on the main thread.

Behaviour does not change until the last step (step 6), which empties the
index when a new city starts loading.

## What exists today

Read from `main` after #23. Line-level detail is in the PR that changes each
piece.

| State | Where | Written | Read by |
|---|---|---|---|
| The index: `CategorizedPrefabs`, three levels of `IndexedPrefabList` | `BuildingMenuUtil` | Full and partial passes; unlocks edit entries in place | The adapter, the UI system, the menu audit and the pass itself |
| `IsReady` | `BuildingMenuUtil` | Set after any successful pass, partial passes included. Never reset. | The adapter; `RefreshBuildingCatalog` |
| Vanilla menu tables: placements, asset menus, menu entities, categories | `PrefabIndexingSystem` statics | Full pass (`IndexVanillaMenuPlacements`, `IndexAssetMenus`, `IndexAssetCategories`) | Six processors, `AddPrefab`, zones, the adapter, the UI bindings |
| Zone tables: type, density, lot sizes, the zone catalog | `PrefabIndexingSystem` statics | Full pass (`IndexZones`) | Two processors, `AddPrefab`, the menu audit |
| Progression: milestone names, dev-tree branches and roots | `PrefabIndexingSystem` (branches are an instance field) | Full pass | `AddPrefab`, the adapter |
| `IndexGeneration` | `PrefabIndexingSystem` static | After a pass, an unlock batch, a placed-unique rescan that moved, and a tracker event | `IndexWatch`, `SnapshotCache`, the adapter's name map, the extension menu |
| Placed uniques | `PlacedUniqueRegistry` static | The game's unique-asset tracker; the rescan after each pass | Baked into each projection (`IsAlreadyBuilt`) |
| Toolbar selection | `BuildingCatalogAdapter.ToolbarSelection` static | The UI trigger `SetVanillaToolbarSelection` | The adapter, including the static `BuildFacetState` that `CatalogView` calls |
| `IsExtraDetailingEnabled`, `IsRoadBuilderEnabled` | `Mod` statics | The start of every full pass. A failed pass does not roll them back. | The lanes processor; the Road Builder filter |
| `Silhouettes` | `Mod` static | `OnLoad` | The adapter's projection; silhouette priming |

**Dead state, deleted along the way:**
- `_zoneFacts`: filled by every full pass and never read.
- `TryGetMenuEntityFor`: no callers.

**Stays as it is:**
- Constant tables and memos: category icon attributes, the processor order, the Domain config tables and the facet band arrays.
- The stopwatches.
- `Mod.Settings` and `Mod.Log`.

**The pure pipeline barely depends on this.** `BuildingCatalogQueryEngine`,
`CatalogView` and `BuildingCatalogGrouping` already work on
`BuildingCatalogEntry[]`. Only the adapter and the two systems read the
index. The adapter has two hidden dependencies:
- **The toolbar selection**, which it reads inside `BuildFacetState`.
- **`Mod.Silhouettes`.** Reading any `Mod` static runs `Mod`'s type initializer, and that initializer's logger needs the running game (see `ModInstanceTests`). So no test against the mocks can reach `Project`.

**The pass reads its own output.** In a full pass, these read what earlier
steps of the same pass wrote:
- six processors: zoned building, zone, menu-placed, terraforming, misc building and lanes;
- `AddPrefab`'s placement, dev-tree and lot-size lookups;
- `IndexZones`' placement and density reads;
- the blacklist tie-break and the Find It checks;
- duplicate numbering and brand cleanup.

For example, the menu-placed processor skips any prefab that is already in
the index, and that means already indexed by an earlier processor in this
same pass.

## Proposed shape

### Types

New files in `Domain/Catalog/`. Not `Systems/`, because `BindingManifestTests`
scans that folder.

```csharp
public sealed class CatalogIndex                   // one per successful full pass
{
    public static CatalogIndex Empty { get; }      // laid out; IsReady false
    public bool IsReady { get; }
    public VanillaMenuIndex Menus { get; }         // fixed once built
    public ZoneIndex Zones { get; }                // fixed once built
    public ProgressionIndex Progression { get; }   // milestone names, dev-tree branches and roots
    public ModCompatibility Mods { get; }          // Extra Detailing, Road Builder, as of this pass
    public IndexedPrefabList All { get; }          // today's [Any][Any]
    public IndexedPrefabList List(PrefabCategory category, PrefabSubCategory subCategory);
    public PrefabIndex? Get(int id);
    public IReadOnlyList<VanillaMenuCategory> GetMenuCategories(string? menu);

    // The indexer's only way in. Main thread only; see "Updates" below.
    internal void File(PrefabIndex entry);
    internal void Remove(int id);
    internal void NumberDuplicateNames();
    internal void RemoveBrandDuplicates();
}

public sealed class PlacedUniques { /* today's PlacedUniqueRegistry, as an instance */ }

public readonly record struct CatalogSource(CatalogIndex Index, PlacedUniques Placed, int Generation);
```

- `PrefabIndexingSystem`'s 16 public static methods go. The menu, zone and progression lookups become methods on these objects, and `SyncPlacedUniques` becomes an instance method on the system.
- Tables keyed by `Entity` are re-keyed by `entity.Index`, as `PrefabIndex.Id` and the placements already are. Against the mocks, `Entity`'s `Equals` and `GetHashCode` throw like every other game method body, so a test cannot fill a `Dictionary<Entity, …>`. Among one pass's live prefab entities, the two keys are equivalent.
  - **One caveat, not new:** Road Builder creates and discards road prefab entities at runtime, and an index can come back with a new version. A recreated road can inherit a stale placement until the next full pass. The placements are keyed this way today, so the re-keyed tables add nothing to it.
  - **Never persist these keys.** Entity numbering is not stable across boots: the live-testing review saw the toolbar menu entities shift by one between two launches.

### Who holds what

**`PrefabIndexingSystem`** keeps everything that needs ECS:
- the `Index*` walks, `AddPrefab`, the processors and their queries;
- the lifecycle flags, the blacklist, the audit logs and silhouette priming;
- the placed-unique rescan and its candidate list.

It gains:

```csharp
public CatalogIndex Index { get; private set; } = CatalogIndex.Empty;
public PlacedUniques PlacedUniques { get; private set; } = new();
public int Generation { get; private set; } = 1;
public CatalogSource Source => new(Index, PlacedUniques, Generation);
```

A system's initializers do run (only `Mod` is built without its
constructor), so these defaults are safe. The static `_instance` goes.

State stays off `Mod`: the game builds it with `GetUninitializedObject`, so an instance field
initializer there never runs (`ModInstanceTests` guards this). Systems are constructed normally.

**`BuildingMenuUISystem`:**
- Looks up the indexer in `OnCreate`. The indexer is registered first, and `GetOrCreateSystemManaged` would create it anyway.
- Owns the toolbar selection, which is UI state.
- Takes `_indexer.Source` once per refresh, after syncing placed uniques, and passes it to every `Build`, `MenuHasAssets` and name lookup in that refresh.

Dependencies run one way: the UI reads the indexer, never the reverse.

**`BuildingCatalogAdapter`:**
- It takes the source and the toolbar selection as arguments, and a silhouette lookup in its constructor. The UI system passes `thumbnail => Mod.Silhouettes?.UrlFor(thumbnail)`, a lambda, so `Mod` is still read only when a projection runs, as today.
- The source is taken once per refresh, after the placed-unique rescan, which can bump the generation. Its placed set is the live one, not a copy.
- `BuildFacetState` and `CatalogView` take `vanillaSelected` as a flag.

**Processors** get the index they are filling as a parameter:
`TryCreatePrefabIndex(prefab, entity, CatalogIndex target, out entry)`. A
parameter rather than an ambient field lets the compiler list every in-pass
read, which step 5 depends on.

### Generation

`Generation` keeps today's meaning: something a projection depends on has
changed. Two tempting simplifications are wrong:

- **Using the index object itself as the version.** Partial passes and unlocks edit the published index in place. A placed unique moving changes no index at all, but it is baked into every cached projection.
- **Restarting the count for each index or each load.** `SnapshotCache` and `IndexWatch` compare ints. If city B's count reached a number city A's had used, the panel would serve city A's cached projection.

So it counts up for the life of the World and never resets. Confirmed in game (1.6.2f1): the
World and the mod's systems live across city loads. `OnCreate` and `OnLoad` run once per boot,
and at quit `ModManager.Dispose()` runs before `DestroyWorld()`, so the systems are alive during
`Mod.OnDispose`. Instance state on the indexer therefore lives exactly as long as the statics it
replaces. It moves when:
- an index is published;
- a partial pass finishes;
- an unlock batch changes something;
- the placed set moves;
- the tracker reports an event;
- (from step 6) a new city starts loading.

### Updates

- **Full pass:** build a new `CatalogIndex` aside. Publish it (`Index = next; Generation++`) only if the pass succeeds. `CaptureIndex`, `RestoreIndex` and `IndexSnapshot` are deleted: a failed pass never touched `Index`.
- **Partial passes and unlocks edit the published index in place**, under one rule:
  - only the indexer edits it;
  - only on the main thread, in `OnUpdate`;
  - only through the `internal` methods;
  - every batch ends with one `Generation++`.
- **Why in place is enough:**
  - No reader holds a `PrefabIndex` across generations: the adapter's caches and the extension menu are already keyed on the generation, and projections are immutable records.
  - The menu, zone and progression tables never change after they are built.
  - `IndexedPrefabList`'s public indexer setter becomes internal.
- **Nothing reads the index off the main thread.** The mod has no `Task.Run`, `Thread`, `ThreadPool`, `Parallel`, `async`, `IJob` or `lock`. So publishing is a plain reference assignment.

### Per-load and per-session state

- **Placed uniques belong to a city load.** The indexer owns them and replaces them when a new city starts loading (step 6). The rescan after each pass resets them anyway.
- **The toolbar selection belongs to the UI session and must not reset per load.** The UI forwards it when it mounts and when it changes (`toolbarSelectionKey`), not on a load, so a reset in C# alone could leave a filter showing in the toolbar but no longer applied to the catalog. Step 6's checks confirm it in game rather than assume it: if vanilla resets its own selection on a load, the binding changes and the UI forwards that.
- **No full pass outside a loaded city (step 6, decision 8).** A language change calls `RunIndex(true)` straight from `OnActiveDictionaryChanged` when the locale differs from the last one indexed. Nothing gates it, so it runs at the main menu after leaving a city, and between `OnGamePreload` and `OnGameLoaded` if the language changes during a load. Once step 6 empties the index at preload, either would publish a full index outside a city: at the main menu, undoing the empty state, or from a half-loaded world. The deferred branch for mod locale sources already runs from `OnUpdate`, so `Enabled` gates it: the system is disabled at boot and from every `OnGamePreload` until a city finishes loading (`OnGameLoaded` for a game or map, or loading-complete for the game or the editor).
- **What step 6's `!Index.IsReady` guard protects.** `OnGamePreload` already sets `Enabled = false`, so partial passes and unlocks, which run in `OnUpdate`, cannot run during a load. `OnGameLoaded` sets `Enabled = true` even when its pass failed. The guard therefore matters in one window: after a failed `OnGameLoaded` pass, until loading-complete retries. Unlock events are one-frame event entities, so one skipped there loses only that delta; the next full pass reads `Locked` from the components. On a normal load the unlock batch arrives 0.5–1 s after the `OnGameLoaded` pass, so the guard never sees it.

## Steps

Seven PRs, starting once #28 has merged. Each one builds with no warnings
of any kind, as CI requires. Steps 1 to 5 and step 7 change no behaviour;
step 6 does.

| # | PR | Risk | Main files |
|---|---|---|---|
| 1 | **The toolbar selection moves to the UI system.** The static goes. `Build` and `MenuHasAssets` take the selection, and `BuildFacetState` and `CatalogView` take `vanillaSelected`. `MenuHasAssets` stays static until step 3 gives it an index to read. | Low | Adapter, `CatalogView`, Bindings, Methods; `ContentFacetTests` drops its save and restore |
| 2 | **The UI system holds the indexer, and placed uniques become an object.** `Generation` becomes an instance property, the static `_instance` goes, and the adapter's silhouette function is passed in. | Low–medium | `PrefabIndexingSystem`, `PlacedUniques`, Setup, Methods, Adapter; `AvailabilityStateTests` builds its own |
| 3 | **`CatalogIndex` replaces `BuildingMenuUtil`**, holding the lists, `IsReady`, `Get`, `File` and `Remove`. The full pass still publishes first and rolls back on failure, which is today's behaviour exactly. | Medium | New `CatalogIndex`; `BuildingMenuUtil` deleted; the indexer, the audit, the Menus partial, the menu-placed processor, the adapter, Methods |
| 3b | **The C# tests run in parallel again**: `TestParallelization.cs` and its CONTRIBUTING paragraph go. One file, so it can be reverted on its own. | Low | Tests only |
| 4 | **The menu, zone, progression and mod-flag tables join the index.** Each `Index*` step returns its table. Processors take `target`. `_zoneFacts` and `TryGetMenuEntityFor` go. Can be split into 4a (menus) and 4b (the rest). | Medium–high by size, mechanical | 24 processor files (6 with real changes), the indexer's partials, Bindings, Methods, Adapter; new `CatalogIndexTests` |
| 5 | **Build aside, publish at the end.** Every read in the pass goes to `next`. | The riskiest change, so it is on its own | The indexer's partials; small, because step 4 added the parameter |
| 6 | **A new city starts from an empty index.** At `OnGamePreload`: `Index = new CatalogIndex()`, new placed uniques, `Generation++`. A fresh index rather than a shared `Empty`: a partial pass files into the published index, so a shared one would be filled and marked ready. Partial passes and unlocks skip while `!Index.IsReady`. A language change's pass runs from `OnUpdate`, as the deferred one does (decision 8). The mod-flag fallback then has no last answer across loads, so a failed read on a city's first pass means `ModCompatibility.None`; carry the last flags aside if that matters. | Behaviour change, medium | The indexer; indexing.md's "Load timing" and "A pass that fails" |
| 7 | (Optional) **Test builders and projection tests.** A name map inside the index replaces the adapter's `_byName` and the O(n) `Find`. | Low | Tests, `CatalogIndex`, Adapter |

### Checks per step

- **Every step:** the C# and UI suites, and a clean `CI=true` build. Also `./build.sh test` against the real game assemblies on the merged tree: two PRs passed CI's mock run and failed only there (#19's page-write test, #28's writer test), and each step touches the adapter and the index those tests cover. #39 moves CI itself onto the real assemblies; until it lands, the validator runs this.
- **Steps 3–5:** an in-game A/B on one save. After a load, compare with `main`:
  - `Indexed Prefabs Count` and the locked count;
  - `[PROCESSOR-CENSUS]` and `[PROCESSOR-OVERLAP]`;
  - `[MENU-AUDIT]` and `[MENU-COVERAGE]`.

  Then switch the language with the panel open.
- **Step 5:** a review search for `Index.` inside `BuildIndex`, `AddPrefab` and the `Index*` methods. Any hit reads the previous index during a full pass. For example, the menu-placed processor would skip whatever it indexed last time, and the blacklist and Find It checks would use old placements. The census and audit lines log once per load at Info, so the A/B compares a second city in one session, whose first pass runs against a full previous index, or turns Debug logging on; `Indexed Prefabs Count` logs on every pass.
- **Step 6:** the full set of load paths:
  - city A → main menu → city B;
  - Load Game from the pause menu;
  - a new game;
  - the editor;
  - the mod joining a game already running;
  - placing and bulldozing a unique asset, with and without Anarchy;
  - quitting to desktop while the index is held;
  - a full-chain load with the DLC, which adds about 1,500 prefabs (19,198 against 17,698) and changes the menu counts;
  - a second city in the same session with the panel open before the load, where a stale `CatalogSource` or `SnapshotCache` entry would show;
  - a language change at the main menu after leaving a city, and during a load (decision 8). A log line confirms the system is disabled at the main menu after a city; if it is not, decision 8 falls back to (b);
  - a failed first pass, forced in a debug build, so the `!Index.IsReady` guard's one window is exercised. A throwing processor cannot do it: every prefab and every processor has its own catch, and the pass succeeds. The throw has to come from outside them: a prologue walk such as `IndexMilestones`, or duplicate numbering or brand cleanup. Once on the `OnGameLoaded` pass and once on a language-change pass: the log says "the previous index stands", `Generation` does not move, and after a first-pass failure loading-complete runs its own;
  - a pack or theme filter set in city A, then city B loaded (ideally with a different theme): the C# selection matches what the toolbar shows.
- **Step 7:** pin today's handling of duplicate prefab names with a test first. Today `_byName` keeps the last entry in name order, `Find` returns the first, and a map would keep the last one filed.

### Overlap with open PRs

- **#28** edits the adapter's content filter, tab icons and name map; `CatalogView`; `SnapshotCache.TryGet`; and small parts of Methods, Bindings and Facts. Steps 1–3 wait for it.
- **#29** edits `GetAssetName` and the milestone title in `Progression.cs`. Step 4 changes that file too, so whichever lands second takes a merge. Nothing in the plan depends on #29.

## Decisions for the owner

Decided on 2026-09-24: each as recommended.

1. **A failed first pass on a new city.**
   - Today the panel keeps serving the previous city's index.
   - After step 6 it is empty instead: the status reads `indexing`, the panel yields every menu to vanilla (`MenuHasAssets` is false), and loading-complete retries the pass.
   - **Recommended: empty.** The UI already handles `indexing`.
2. **Editing in place, or copy-on-write, for partial passes and unlocks?**
   - The index holds about 17,700 entries, filed about three times over, so about 53,000 dictionary slots.
   - Road Builder triggers a partial pass per edit, measured at 43–45 ms.
   - Copy-on-write would add a few MB of garbage and a re-sort to each one, and every entry's `Name` is rewritten on each pass, so entries would need cloning too.
   - **Recommended: in place, under the rule above.** Revisit only if something ever reads the index off the main thread.
3. **Processor context: a `target` parameter on all 24 processors, or a narrower lookup for the six that read the index?**
   - **Recommended: the parameter.** It makes step 5 compiler-checked.
4. **Keep two quirks verbatim for now?**
   - Nothing reads the `[Category][Any]` lists; brand cleanup is the only code that touches them, and it only removes from them.
   - Brand cleanup skips `[Any][Any]`, so it affects only the Roads extra tabs, never the catalog.
   - **Recommended: keep both as they are, and simplify in a later PR.**
5. **The public API.** `BuildingMenuUtil` and the indexer's statics are public, so deleting them breaks any mod that reaches into them. None is known. **Recommended: accept.**
6. **Building a `PrefabIndex` in tests (before step 7).**
   - Tests create it with `GetUninitializedObject`, because its constructor fails against the mocks. That leaves `ServiceFacts` and `ServiceTextFacts` null, and `Project` reads both.
   - **The cause is the mocks, and #34 fixes them.** Refasmer gives Unity's internal calls a body, and the runtime then refuses to load `UnityEngine.Object`, so no type derived from it loads, `PrefabBase` included. With the fixed mocks the constructor works.
   - **Recommended: fix the mocks in the refs repository, then use the constructor.** No test helper and no null-tolerant projection are needed.
   - **Done:** #34 and #35 merged, the refs repository carries the fixed mocks, and the constructor works against the real assemblies too.
7. **Mod flags on a failed pass.** Today the new flags stick even when the pass fails. After step 4 they roll back with it. **Recommended: accept;** the index and its flags then always agree.
8. **How step 6 keeps language-change passes inside a city** (from the live-testing review; see "Per-load and per-session state"). *Decided on 2026-09-24: (a).*
   - **(a) The immediate branch runs from `OnUpdate`, as the deferred one does.** The change is recorded as due, and the next `OnUpdate` runs the pass. `Enabled` is then the one gate for every pass outside the load hooks. It is already the "a city is loaded" flag: false at boot and from every `OnGamePreload`, true only once a game or editor session finishes loading. `LocaleReindexPolicy` cancels pending work whenever any full pass marks the locale indexed, so a change made at the main menu or during a load is absorbed by the next city's own `OnGameLoaded` pass, with no extra pass. In a city, the pass runs one frame later, which the panel's own one-frame refresh hides.
   - **(b) An explicit "a city is loaded" flag,** set when a city finishes loading and cleared at `OnGamePreload`, checked by both branches. Independent of `Enabled`, but a second lifecycle flag to keep in step with it across every path: game, editor, and the mod joining a running game.
   - **Why (a):** one gate, and no state to keep in step. It rests on the game raising `OnGamePreload` on the way back to the main menu, which is what disables the system there. **Confirmed from the decompile** ([live-testing comment](https://github.com/gerbal/cs2-better-building-menu/pull/30#issuecomment-5808499888)): leaving a city runs `GameManager.MainMenu()`, then `Load(MainMenu, Cleanup)`, which raises `onGamePreload(Cleanup, MainMenu)`. The only main-menu load without a preload is the first at boot, where the system starts disabled. Step 6's log line confirms it live; if it ever did not hold, (b)'s flag would be added.

## Not in scope

- UI binding names and payloads do not change, so `sharedContracts.generated.ts` and `BindingManifestTests` are untouched. The only change the UI can see is step 6's `indexing` status during a load, which `BuildingCatalog.tsx` already renders.
- Splitting `PrefabIndexingSystem` further (the roadmap's other structure item) is separate. This plan makes it easier, because the tables stop being statics on the system.
