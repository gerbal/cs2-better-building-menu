# Prefab indexing

How `PrefabIndexingSystem` builds the index the panel lists from, and why it works the way it
does. The code carries one-line pointers to the headings below.

In short, the index holds one entry per indexed prefab, together with the menus, zones,
milestones and dev tree needed to file them.

- A **full pass** rebuilds it from nothing: on each load of a game, map or the editor ("Load
  timing"), and in a few other cases such as a language change ("Language changes"). A full
  pass that fails publishes nothing ("A pass that fails").
- A **partial pass** re-reads the prefabs the game created or changed in a frame, drops the ones
  it removed, and refreshes where every entry sits in the menus ("Partial passes").
- Each pass runs the **processors**, which decide what is indexed and under which category
  (`PrefabCategoryProcessors` lists them in order), and walks the game's own menus to learn where
  each asset sits ("The vanilla menu walk").
- Anything that changes an indexed fact bumps the indexer's `Generation`, which is how the panel
  knows to refresh (`IndexWatch`).

The system is one partial class across six files in `BetterBuildingMenu/Systems/`:

- `PrefabIndexingSystem.cs`: the lifecycle, the passes, and what each entry is built from;
- `.Menus.cs`: the vanilla menus;
- `.MenuAudit.cs`: the census and coverage report, which ask the game about prefabs and log what
  `VanillaMenuAudit`, `VanillaMenuCoverage` and `IndexAuditLog` return;
- `.Facts.cs`: the reads behind per-prefab facts;
- `.Progression.cs`: milestones, the dev tree and unlock requirements;
- `.Zones.cs`: the zone catalog.

## Load timing

`GameManager`'s load sequence runs in this order:

1. Deserialise the save. `LoadGameSystem` raises `OnGameLoaded` at the end of it.
2. `SetGameActive` — the toolbar goes live here, and the city is playable.
3. Await the loading screen, which waits on three progress groups. One of them, `LoadTextures`,
   is the virtual-texturing material pass and runs on a per-frame budget, so at a low
   frame rate it can take minutes.
4. Raise `onGameLoadingComplete`.

Indexing only at step 4 would leave a playable city with vanilla's menu standing and nothing of
ours built, for as long as the texture pass takes. So the full pass runs at step 1 instead.

Nothing is read too early there: the prefab set is complete before the save is read at all, and
the save's lock state is restored by the Deserialize phase that `OnGameLoaded` follows.

The gate is on `Purpose`, not `GameMode`: the main menu's Cleanup load raises `OnGameLoaded` too,
and there is nothing to index for.

Every load starts from nothing. `OnGamePreload`:

- empties the index, keeping only the mod flags, which belong to the playset rather than the
  city;
- empties the placed uniques and their candidates;
- bumps the generation;
- switches the system off.

So nothing the last city indexed is served to the next one, even if the next one's first pass
fails. The system comes back on at `OnGameLoaded` for a game or map, or at loading-complete for
the game or the editor. The main menu's Cleanup load passes neither, so no pass of any kind runs
outside a city: no partial pass, no unlock, and not the pass a language change triggers (see
"Language changes"). The main menu at boot raises no preload at all, and the system starts off
there.

At loading-complete, lock state is the one fact the earlier pass could plausibly have got
wrong. `LockStateDrift` checks exactly that, with the same `Locked` read `ApplyUnlocks` uses, over
every indexed prefab. With no drift the second full pass is skipped; with any, it runs and logs
how many prefabs moved.

Which mods are enabled (`Mod.ReadEnabledMods`, kept in the index as `Mods`) is re-read at the
start of every full pass. Reading it once per process would miss a mod that joins the playset
between two city loads, which the game allows without a restart, and loading-complete is too
late for the `OnGameLoaded` pass. Road Builder's discard component is looked up at the same
point, on each full pass until it is found.

## Partial passes

A prefab the game creates or changes mid-session, such as a Road Builder edit, is re-read by a
partial pass. Each processor keeps two queries, both built in `OnCreate`: its own, and a copy
narrowed to `Created` or `Updated`. A partial pass reads only the narrowed copy, so one edited road
costs one prefab rather than every road its processor matches.

### When it runs

The indexer runs in one phase, `UIUpdate`. Every frame the world updates, in the game and the
editor alike, the main loop runs:

1. `PrefabSystem`, whose own update applies queued prefab updates and tags what it created or
   changed;
2. `UnlockSystem`;
3. `UIUpdateSystem`: the indexer, then the panel's own system, which reads the index.

So the indexer sees that frame's unlock events and every `Created` or `Updated` tag (the tags last
until the frame's clean-up), and the panel reads the index after it. Running at `PrefabUpdate` as
well would read each changed prefab twice a frame and add nothing, since nothing reads the index
in between.

A prefab added and tagged after `UIUpdate` but before the frame's clean-up, for example by a
mod's own main-loop system calling `PrefabSystem.AddPrefab`, has its tags cleared before the
indexer next runs, and waits for the next full pass. `PrefabSystem.UpdatePrefab`, which
Road Builder uses, queues the change for the next frame's `PrefabSystem` update, so it is not
affected.

### Recreated and removed prefabs

A prefab the game recreates, such as a Road Builder road, arrives under a new entity, so a
partial pass drops the old entry first. `PrefabSystem.UpdatePrefab` marks the old entity
`Deleted`, and the mark lasts until the frame's clean-up, after the indexer's tick. So every
partial pass starts by removing the entries of prefab entities marked `Deleted`. The old entity
is the one handle on the old entry that always holds: Road Builder gives a road a new ID, and so
a new prefab name, on every edit. A `Deleted` prefab on its own also triggers a partial pass, so
a prefab the game removes outright leaves the list too.

Sometimes the old entity has already gone by then. For that case the pass also drops every entry
filed under the new entity's prefab name whose prefab the game no longer maps to that entry's
entity. `PrefabSystem.UpdatePrefab` keeps the `PrefabBase` and points it at the new entity, so
this catches the old entries and never a live namesake of another prefab type. An entity the game
has already replaced, as when a prefab is created and recreated in one frame, is skipped, and
anything filed for it is removed.

### Menu placements

Placements are keyed by entity, so a recreated prefab's placement has to be read again. By the
indexer's tick the game's menus already hold the new entity: `ReplacePrefabSystem` takes the old
one out of every `UIGroupElement` buffer, and `UIObject.LateInitialize`, which
`PrefabInitializeSystem` runs on the new `Created` entity during `PrefabSystem`'s update, adds the
new one to its category.

So every partial pass, after dropping the deleted entries and before the processors run, walks
the menus again (see "The vanilla menu walk"), and `CatalogIndex.RefreshPlacements` swaps the
result into the published index. If the walk throws, the placements it would have replaced stay.
Without this, an edited road the game offers in a menu would be placed nowhere until the next
full pass:

- it would drop out of its menu's view, which admits a network only when some menu places it;
- a prefab that only its placement admits would leave the index altogether: the menu-placed
  processor, the blacklist and the Find It overrides all go by placement.

`RefreshPlacements` files every indexed entry the game places under its placement now, with its
category's priority, whether or not the pass re-read the prefab. A mod can regroup without
marking anything changed: Asset UI Manager moves whole categories between menus, and rewrites
their priorities, whenever its settings change. Refreshing only the re-read entries would leave
the entries of one category naming different menus, and its heading would appear twice.

The menus and their tabs, unlike the placements, wait for the next full pass. Stale tabs matter
only when the game regroups without recreating the assets. A recreated category is one such case:
`ReplacePrefabSystem` does not move its members to the new entity, so the new category starts
empty, and vanilla, which draws no empty category, hides the tab and its assets. The walk agrees
and places none of them, so the tab counts nothing. The strip and the chip row's category picker
draw only tabs with something behind them (`visibleCategories`), so they hide it at the same
pass. Re-reading the tabs on a partial pass is not worth it: a category removed late in the frame
would make its menu's read fail on every partial pass rather than on the next full one.

## A pass that fails

A full pass builds a new index on the side, including the menus, zones, milestones, dev tree
and mod flags it reads, and `BuildIndex` passes it down as `target`. Until the pass returns, the
published `Index` is still the previous one. The pass reads the published index once,
deliberately, for its mod flags: they are the answer to keep if reading the enabled mods fails.
Every other read and write in the pass goes to `target`.

Inside the build, each processor and each prefab has its own catch, in full and partial passes
alike: a failure there is logged, costs that processor's or that prefab's entries, and the pass
goes on. Anything that throws outside those catches, in the tables read before the processors or
the renumbering after them, fails the pass. `RunIndex` then logs the error and publishes nothing:
the panel keeps the index it had, and nothing reaches the game's load or update loop.

So a failed pass has nothing to put back. The published index keeps the tables and mod flags it
was built with, and the partial passes after a failure read the same ones. Road Builder's discard
component is the exception: once a pass has found it, it is kept whether or not that pass
succeeds.

A city's first pass is different, because the preload has already emptied the index. If it
fails, the index stays empty and not ready: the panel shows the indexing notice and hands every
menu back to vanilla, which is better than showing the last city's catalog.

If every pass of a load fails, or the first-update pass of a mod joining a running game does, the
index stays empty until the next load. A language change retries it only if a pass has succeeded
earlier in the session, since until then the locale policy has no indexed locale to compare
against.

A partial pass edits the live index in place, so none of this applies to it beyond the
per-processor and per-prefab catches.

## The vanilla menu walk

`TryIndexVanillaMenuPlacements` walks the game's own group tree downward: `UIAssetMenuData` menus →
their `UIGroupElement` categories → the categories' members.

The direction is the whole point. Everything else in the file reads upward: an indexed asset
names its category through `UIObject.m_Group` and its menu through that category's `m_Menu`. An
upward view can only describe assets we already hold, so an asset no processor queries is absent
from it entirely, and the menu it belongs to looks complete while being short. Terrain brushes
under Landscaping or seaway tools under Transportation, say, that no processor queried would be
invisible to any report built from the index.

The walk follows vanilla's step for step, so a difference in the result is ours rather than an
artefact of reading the tree differently:

- `ToolbarUISystem.BindAssetCategories` takes each menu's `UIGroupElement` buffer;
- `GetSortedCategories` keeps the members that carry `UIAssetCategoryData` and have members of
  their own;
- `BindAssets` takes every element of those buffers.

Of vanilla's exclusions, only `FilterOutUpgrades` is applied. It drops `ServiceUpgradeData`,
because a service upgrade is placed from its parent building's row rather than from the grid.
The theme and asset-pack filters are deliberately not applied: those are player settings that
hide assets which should still be indexed.

A menu, or a category's member, that the game has removed is skipped too (`IsLive` says why a
removed entity can still be in its group). A top-level category is not checked, and one removed
late in the frame can cost its menu's tabs for the pass.

**Nested categories are flattened into tabs.** ExtraLib, which Extra Assets Importer builds its
menu with, nests categories: `UIAssetChildCategoryPrefab` gives a child `UIAssetCategoryData` and
adds it to its parent category's `UIGroupElement` buffer, and the assets sit in the child.
ExtraLib's own UI draws a second row of tabs for them.

The walk follows any member that carries `UIAssetCategoryData` and has members of its own down
into it (`CategoryTree`). `NestedCategories.Flatten` then makes a tab of every category that holds
assets: each parent's own assets first, then its children in their order (priority, then entity
index for a tie). A nested menu's tabs are numbered 0, 1, 2… in that order, and the placements
take the same numbers, so the strip, the headings and the placements agree. A menu with no
nesting keeps the game's priorities untouched.

**The menus and their tabs are in the game's order**, reached by the game's own steps
(`SortedCategories`, `ToolbarOrder`), and the All tab's headings follow the strip's order
(`VanillaMenuIndex.TabOf`). The comments there say why.

The walk's tables, with the menus and their category tabs, go into the pass's `VanillaMenuIndex`,
which its `CatalogIndex` carries as `Menus`: a new pass reads the menus afresh, and nothing
outlives the index it was read for. A partial pass walks again and swaps in a copy with the new
placements (see "Partial passes"). The placements are read by:

- the coverage report and the menu audit;
- the zone catalog, which inherits the Zones menu (below);
- the index itself, which treats placement as an override: the blacklist and Find It checks in
  `BuildIndex`, the menu-placed, terraforming and misc-building processors, and `AddPrefab`'s
  placement override, which takes the menu, category and category priority the entity world
  gives;
- the adapter, which scopes a menu's view by them and gathers networks into Roads only when some
  menu places them.

### The Zones menu

Menu membership is not in components, so no ECS query can reproduce the Zones menu.
`Game.Zones.AreaType` has only None, Residential, Commercial and Industrial, and the
`ZonesExtractors` group is defined in the game's asset data, not its code, so no component
predicate can name it. A query on `ExtractorAreaData` finds the feature-level extractor
lots, which vanilla does not put in the menu, rather than the resource-specific assets it does.

So `InheritVanillaZoneMenu` inherits the categories from the same downward walk `ToolbarUISystem`
draws from: whatever the game puts under Zones appears here too, including anything a mod adds.
`ZoningSurfaceCatalog`'s family map already speaks the category names.

Entries the zone pass produced are left alone — they carry density, footprints and allowed
resources the walk cannot know — and the walk adds what the queries missed. Afterwards the
catalog drops everything vanilla does not place in Zones: the `ZoneData` query returns every zone
prefab that exists, including internal ones the player can never pick (the area-hub zones the
specialised-industry system uses, and the theme-less base zones whose EU and NA variants the menu
offers instead). The trim runs whether or not the walk found the menu, so if the walk found
nothing under Zones, only the fallback below is left (see
[issue #107](https://github.com/gerbal/cs2-better-building-menu/issues/107)).

`IndexExtractorAreas` is the fallback for when the walk adds nothing to the zone catalog. It
queries the specialised industries directly: they are `LotPrefab`s carrying `ExtractorArea` and
holding a `MapFeature`, placed by the Area tool, so the zone query (which requires `ZoneData`)
never returns one. That query finds the feature-level lots rather than the resource-specific assets the
menu offers (see above), which is why it is only a fallback.

The specialised industries join the zone catalog rather than getting their own binding because
the player reaches both the same way, by opening Zones.

## The menu audit

`LogVanillaMenuCoverage` answers one question — what does vanilla place that we failed to index —
and is blind in two ways:

- It skips zones outright, because they reach the player through the zoning hierarchy rather than
  the prefab index. A whole Zones tab can be missing while the report says "0 missing".
- It only looks one way. It never asks what WE show that vanilla does not place, which is how
  unbuildable zones can sit in the surface until a player tries to build one.

`LogVanillaMenuAudit` is the census that closes both: every menu, its categories, what vanilla
places, what we cover, and what we show that vanilla does not. It logs whether or not anything
is wrong, because the value is in reading it rather than in being warned by it.

It runs on every full pass with Debug logging on, beside the processor census, the overlap
pairs, the coverage report and the DLC audit (see `Mod.Log`). With Debug off, none of them is
logged and the audits are not computed.

The census and the coverage report are counted and worded in `Domain/` and tested there, because
as a log line alone the census could only be checked by booting a save and reading the log, and
nothing would stop the mapping regressing between boots. The DLC audit, the processor overlap,
the zone parity check and the failure lines are worded in the system.

Extras are split in the output: ones a recorded divergence explains are `expectedExtras`,
anything else is `UNEXPLAINED`, which is either a new divergence to write down or a bug. The
divergence list is logged beside the census so a reader of the log has the reason in hand.

The DLC lines beside it exist because two very different causes look identical from the UI: the
DLC prefabs may be absent, or present and filtered for being unowned. `EnumerateLocalDLCs` reads
the shipped manifest, so it lists what the install has; `EnumerateDLCs` goes through the platform
backends, so it lists what the store says.

## Per-prefab facts

`.Facts.cs` reads a prefab's components into a `PrefabSnapshot`, and `PrefabFacts.Apply` in
`Domain/` maps the snapshot onto the entry; the comments on both list what goes in and why.

Where the game's own tooltip shows a figure, `Apply` follows its binder in
`PrefabUISystem.BuildDefaultPropertyBinders`. Two rules decide more than one line:

- A network's upkeep comes from `PlaceableNetData`; a building's is its `ServiceUpkeepData`
  buffer's money alone.
- Capacity is the primary role's own figure. The two secondary figures vanilla shows, a garbage
  store and a power output, get lines of their own.

docs/design-notes.md, "The card against vanilla", lists where the card differs from vanilla
and why.

The entry keeps the facts in the order they are added, but a card re-sorts them by `FACT_ORDER`
in `serviceFacts.ts`. So the order `Apply` adds them in only breaks ties within one key, such as
a road's features.

The rest of an entry's per-prefab data is split the same way, `.Facts.cs` reading and a plain
class in `Domain/` deciding, so a test can reach every rule without the entity world:
`EffectWording`, `SupportedUpgrades`, `VanillaAssetFacts` and `ParkingSlots`.

An extractor's map feature stays in the system: every step of it is a read, in the order
`RequiredResourceBinder.GetExtractorType` guards them, and what is left once the reads are done is
the choice of the first matching area.

## Dev tree branches

A service's tree is a free `Basic<Service>` root with chains hanging off it. The rules are stated
where they are applied: `IndexDevTreeBranches`, `DevTreeLayout`, `DevTreeGates`,
`DevTreeNodeName` and `ProgressionIndex.BranchOf`. This section holds the reasoning and examples
they leave out.

**A node is its own branch.** Collapsing a chain to the branch below the root looks like the
game's structure and is not: it would also file the Nuclear Power Plant under "Gas Power Plant",
a separate unlock the player buys separately.

**Ranking.** The column alone leaves siblings tied, and an alphabetical tie-break puts Medical
University and Technical University above the plain University they specialise. Measuring
outward from the trunk takes the generic first, the order the player meets them in. Depth
matches the order the player buys nodes in only along one chain: siblings in a column get
different ranks, and nodes on separate branches have no fixed order.

**Gates.** The asset's own service is its `ServiceObject`'s, or failing that the one its menu is
named after. With no gate in that service, the rule runs over every service's gates.

The requirements the rule sees come from `ProgressionUtils.CollectSubRequirements`, which stops at
each dev-tree node, so a node's ancestors are never among them. It also flattens the
requirements: a node keeps only the flags of the edges straight into it, so how they nested above
is lost. An asset that needs either of two buildings arrives as needing both their nodes. One that
needs two buildings, each with ways in of its own, arrives with every node a way in, so it is
filed under the nearest. Both mostly affect service upgrades, which the catalog hides.

**Icons.** A node with no icon gets none, rather than a placeholder, because a placeholder glyph
reads as a broken icon rather than as none.

**Folds** (`FoldedDevTreeNodes`). Transportation's Air category carries three assets and the tree
gives each of the big two its own node, so the strip would draw one tab of three and two tabs of
one, and neither of those nodes has an icon, so both would fall back to the menu's glyph and
render as a pair of identical marks. An international airport and a space centre are things you
build at an airport, so they are drawn under the Airport tab. Folds are keyed on the node prefab
name because the label is localized: a label key would fold in English but not in German.

## Language changes

Names the index resolves from the game's dictionary, such as milestone names, follow a language
change because a full pass follows `OnActiveDictionaryChanged` when the active locale is not the
one the names were resolved in. The game raises the same event whenever a mod adds or removes a
locale source, which does not change the language; `LocaleReindexPolicy` gathers those into one
full pass a second after the last.

Both kinds of pass are started from `OnUpdate`, never from the event itself. The event also fires
at the main menu and between a preload and `OnGameLoaded`, where `OnUpdate` is off, and a pass
there would publish an index outside a city or from a half-loaded world. A full pass run for any
other reason, such as the save's own at `OnGameLoaded`, covers either, so a language switched at
the main menu is simply read by the next city's first pass.
