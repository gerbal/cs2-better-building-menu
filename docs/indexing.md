# Prefab indexing

Design rationale for `PrefabIndexingSystem`, one partial class across six files in
`BetterBuildingMenu/Systems/`:

- `PrefabIndexingSystem.cs`: the lifecycle, the passes, and what each entry is built from;
- `.Menus.cs`: the vanilla menus;
- `.MenuAudit.cs`: the census and coverage report, which ask the game about prefabs and log what
  `VanillaMenuAudit`, `VanillaMenuCoverage` and `IndexAuditLog` return;
- `.Facts.cs`: the reads behind per-prefab facts;
- `.Progression.cs`: milestones, the dev tree and unlock requirements;
- `.Zones.cs`: the zone catalog.

The code carries one-line pointers to the headings below.

## Load timing

`GameManager`'s load sequence runs in this order:

1. Deserialise the save. `LoadGameSystem` raises `OnGameLoaded` at the end of it.
2. `SetGameActive` — the toolbar goes live here, and the city is playable.
3. Await the loading screen, which waits on three progress groups. One of them, `LoadTextures`,
   is the virtual-texturing material pass and runs on a per-frame budget, so on a slow or
   headless frame rate it can take minutes.
4. Raise `onGameLoadingComplete`.

Indexing only at step 4 therefore leaves a playable city with vanilla's menu standing and nothing
of ours built, for as long as the texture pass takes. So the full pass runs at step 1 instead.

Nothing is read too early there: the prefab set is complete before the save is read at all, and
the save's lock state is restored by the Deserialize phase that `OnGameLoaded` follows.

The gate is on `Purpose`, not `GameMode`: the main menu's Cleanup load raises `OnGameLoaded` too,
and there is nothing to index for.

Every load starts from nothing. `OnGamePreload` empties the index, keeping only the mod flags,
which belong to the playset rather than the city. It also empties the placed uniques and their
candidates, bumps the generation, and switches the system off. Nothing the last city indexed is
served to the next one, even if the next one's first pass fails. The system comes back on at
`OnGameLoaded` for a game or map, or at loading-complete for the game or the editor. The main
menu's Cleanup load passes neither, so no pass runs outside a city: not a partial pass, not an
unlock, and not the pass a language change earns (see "Milestones"). The main menu at boot raises
no preload at all, and the system starts off there.

`OnGameLoadingComplete` still runs, and lock state is the one fact the earlier pass could
plausibly have got wrong. `LockStateDrift` is the exact test for it — the same `Locked` read
`ApplyUnlocks` uses, over every indexed prefab. Zero drift skips the second full pass; any drift
runs it and logs how many prefabs moved.

Mod detection (`Mod.ReadEnabledMods`, kept in the index as `Mods`) is re-read at the start of
every full pass, and Road Builder's discard component is looked up there until it is found.
Reading them at loading-complete came after the `OnGameLoaded` pass. Reading them once per process
missed a mod added to the playset between two city loads, which the game allows without a
restart.

## Processors

Each `IPrefabCategoryProcessor` decides whether a prefab is indexed and under which category. A
pass runs them in the order `PrefabCategoryProcessors` lists them, which is the same on every
build. A test fails if a processor in the assembly is missing from that list.

The index holds one entry per prefab, so when two processors claim the same prefab the later one's
entry replaces the earlier one's, category and all: `CatalogIndex.File` takes the earlier entry out
of every list it was filed in, so the prefab is listed under one category only. Nothing fails when
that happens. The full pass that logs the census also logs each such pair at Info as
`[PROCESSOR-OVERLAP]`, with how many prefabs they shared and one of them by name.
`MenuPlacedPrefabCategoryProcessor` runs last and claims only what nothing else did, so it never
appears there.

## Partial passes

A prefab the game creates or changes mid-session, such as a Road Builder edit, is re-read by a
partial pass. Each processor keeps two queries, both built in `OnCreate`: its own, and a copy
narrowed to `Created` or `Updated`. A partial pass reads only the narrowed copy, so one edited road
costs one prefab rather than every road its processor matches.

The indexer runs at one phase, `UIUpdate`. The main loop runs `PrefabSystem` (whose own update
applies queued prefab updates and tags what it created or changed), then `UnlockSystem`, then
`UIUpdateSystem`, every frame the world updates, in the game and the editor alike. So the indexer
sees that frame's unlock events and every `Created` or `Updated` tag, which last until the frame's
clean-up, and it runs before the panel's own `UIUpdate` system, which reads the index. It was once
registered at `PrefabUpdate` too, which read each changed prefab twice a frame and added nothing
else: nothing reads the index between the two.

A prefab added and tagged after `UIUpdate` but before the frame's clean-up, for example by a mod's
own main-loop system calling `PrefabSystem.AddPrefab`, has its tags cleared before the indexer
next runs, and waits for the next full pass. `PrefabSystem.UpdatePrefab`, which Road Builder uses,
queues the change for the next frame's `PrefabSystem` update, so it is not affected.

Duplicate names are numbered after every pass, partial passes included, always starting from each
prefab's `AssetName` (`CatalogIndex.NumberDuplicateNames`). A partial pass gives the prefab it
re-reads back its plain name. Numbering only what it touched would leave that prefab as "Foo"
beside a sibling still called "Foo 2".

A prefab the game recreates, such as a Road Builder road, arrives under a new entity, so a partial
pass drops the old entry first. `PrefabSystem.UpdatePrefab` marks the old entity `Deleted`, which
it keeps until the frame's clean-up, after the indexer's `UIUpdate` tick, so every partial pass
starts by removing the entries of prefab entities marked `Deleted`. A `Deleted` prefab alone
triggers a partial pass, so a prefab the game removes outright leaves the list too. The entity is
the one link that always holds: Road Builder gives a road a new ID, and so a new prefab name, on
every edit.

A recreated prefab's menu placement moves with it. The placements are keyed by entity, and by the
indexer's tick the game's menus already hold the new one: `ReplacePrefabSystem` takes the old
entity out of every `UIGroupElement` buffer, and `UIObject.LateInitialize`, which
`PrefabInitializeSystem` runs on the new `Created` entity during `PrefabSystem`'s update, adds the
new one to its category. (Read from the game's code; a Road Builder edit in game is the check.)
So every partial pass walks the menus again (see "The vanilla menu walk") after dropping the
deleted entries and before the processors run, and `CatalogIndex.RefreshPlacements` swaps the
result into the published index. Without it, an edited road the game offers in a menu is placed
nowhere until the next full pass: it drops out of that menu's view, which admits a network only
when some menu places it, and a prefab only its placement admits (the menu-placed processor, and
the blacklist and Find It overrides) leaves the index. A walk that throws keeps the placements it
replaces.

The menus and their tabs wait for the next full pass. The entries do not: `RefreshPlacements`
files every indexed entry the game places under its placement now, with its category's priority,
whether or not the pass re-reads the prefab. A mod can regroup without marking anything changed:
Asset UI Manager moves whole categories between menus, and rewrites their priorities, whenever its
settings change. Left alone, the entries the pass re-read and the rest would name different menus
for one category, and its heading would appear twice. The stale tabs matter only when the game
regroups without recreating the assets. A recreated category is one: `ReplacePrefabSystem` does not move its
members to the new entity, so it starts empty, and vanilla, which draws no empty category, hides
the tab and its assets. The walk agrees and places none of them, so the tab counts nothing, and
the strip and the chip row's category picker, which draw only tabs with something behind them
(`visibleCategories`), hide it at the same pass. Re-reading the tabs on a partial pass would not
be worth it: a category removed late in the frame would make its menu's read fail on every
partial pass rather than on the next full one.

For a recreation whose old entity has already gone, the pass also drops every entry filed under
the new entity's name whose prefab the game no longer maps to that entry's entity.
`PrefabSystem.UpdatePrefab` keeps the `PrefabBase` and points it at the new entity, so this holds
for the old entries and never for a live namesake of another type. An entity the game has already
replaced, as when a prefab is created and recreated in one frame, is skipped, and anything filed
for it removed. `CatalogIndex` keeps the entries under each prefab name in step as it files and
removes them, and `GetByPrefabName` answers the extension picker's rows from the same map. Two
prefab types can carry one name; then the first by display name answers, as the lists order them,
and the lower id between equal names.

## A pass that fails

A full pass builds a new index aside, and the menus, zones, milestones, dev tree and mod flags it
reads are built into it. `BuildIndex` passes it down as `target`. The published `Index` is still
the previous one until the pass returns, and the pass reads it once, deliberately: its mod flags,
the answer to keep if reading the enabled mods fails. Every other read and write in the pass goes
to `target`.

`RunIndex` publishes the new index only when the pass returns. If anything in the build throws, it
logs the error and publishes nothing: the panel keeps the index it had, and nothing reaches the
game's load or update loop.

So a failed pass has nothing to put back. The published index keeps the tables and mod flags it
was built with, and the partial passes after a failure read the same ones it was filled from. Road
Builder's discard component is the exception: once a pass has found it, it is kept whether or not
that pass succeeds.

A city's first pass is the exception to keeping what it had: the load emptied the index at
preload, so a first pass that fails leaves it empty and not ready. The panel shows the indexing
notice and hands every menu back to vanilla, which is better than the last city's catalog.
Loading-complete runs its own pass unless the index is ready by then. Ready means a full pass has
succeeded since the preload, `OnGameLoaded`'s or a locale pass after it; partial passes cannot
make it so. Until a pass succeeds, partial passes and unlocks are skipped: there is nothing to
patch, and the next full pass reads their changes afresh. If every pass of a load fails, or the
first-update pass of a mod joining a running game does, that lasts until the next load. A
language change retries it only if a pass has succeeded earlier in the session, since the
policy has no indexed locale to compare against until one has.

Partial passes are not covered by any of this. They edit the live index in place, and each prefab
and each processor in them has its own catch.

## How the panel hears of a change

The indexer never calls the panel. Whatever changes an indexed fact — a pass, an unlock, a unique
asset built or bulldozed, a load emptying the index — bumps the indexer's `Generation`, and
`BuildingMenuUISystem.OnUpdate` compares it with the generation its last publish read
(`IndexWatch`).

Each publish reads the indexer's `Source` once: the index, the placed uniques and the generation
together. Every cache the adapter keeps is keyed on that generation. It is never reset, because
the caches compare plain ints, and a count that started again could land on a number an older
projection was stored under.

A change while the panel is open schedules the same debounced refresh a keystroke does, so a burst
of partial passes or unique events is one refresh rather than one each. A change while it is closed
schedules nothing, because opening the panel publishes anyway.

## The vanilla menu walk

`TryIndexVanillaMenuPlacements` walks the game's own group tree downward: `UIAssetMenuData` menus →
their `UIGroupElement` categories → the categories' members.

The direction is the whole point. Everything else in the file reads upward: an indexed asset
names its category through `UIObject.m_Group` and its menu through that category's `m_Menu`. An
upward view can only describe assets we already hold, so an asset no processor queries is absent
from it entirely, and the menu it belongs to looks complete while being short. That is the shape
behind gaps such as terrain brushes under Landscaping and seaway tools under Transportation:
never indexed, and so invisible to any report built from the index.

The walk is vanilla's, step for step, so a difference is ours rather than an artefact of reading
the tree differently. `ToolbarUISystem.BindAssetCategories` takes each menu's `UIGroupElement`
buffer; `GetSortedCategories` keeps the members that carry `UIAssetCategoryData` and have members
of their own; `BindAssets` takes every element of those buffers. The one exclusion applied here
is `FilterOutUpgrades`, which drops `ServiceUpgradeData`, because a service upgrade is placed
from its parent building's row rather than from the grid. The theme and asset-pack filters are
deliberately NOT applied: those are player settings that hide assets which should still be
indexed. A menu, category or asset the game has removed is skipped too. `UIInitializeSystem`
takes a removed prefab out of its group during `PrefabSystem`'s update, but a
`PrefabSystem.RemovePrefab` later in the frame, from a mod's own system or a UI trigger, leaves the
entity in its group marked `Deleted`, and still there once the frame's clean-up destroys it, when
its index can go to another entity and would place that entity instead.

**The menus and their tabs are in the game's order**, reached the same way. A menu's tabs are
`GetSortedCategories` run as is: the menu's members, less the non-categories and the empty ones
(removed swap-back, which moves the last one into the gap), then Unity's sort by `UIObjectInfo`.
That comparer is the priority alone and the sort is not stable, so any sort of our own, stable or
not, could put equal priorities in a different order from the game's. The menus are the bottom
bar's: the toolbar groups by priority, then each group's members sorted the same way. A menu no
toolbar group holds goes last. The UI keeps the menus in that order. It sorts the tabs again, by
the same priority and stably, which leaves them as they are. The All tab's category headings
follow the strip too: in one menu's view the adapter gives each entry its tab's priority and place
in the strip (`VanillaMenuIndex.TabOf`). So a priority tie breaks as the strip breaks it, before
the name, and every entry of one tab ranks alike, a moved asset included. The walk also reads
each category's priority as the strip does (`UIObjectData.m_Priority`), and `AddPrefab`'s
placement override files a placed asset under that priority rather than its managed group's, and
a partial pass files every placed entry again (see "Partial passes"). So where the strip draws no
tab for a placed category, the assets the game places there still share one priority and one
heading. A placed category has no tab when a menu's tabs fail to read, or after a partial pass:
it reads the placements again but keeps the last full pass's tabs, so a category that was empty
then, or has been created or moved into the menu since, has none.

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
`ZonesExtractors` tag is assigned in asset data through `ManualUITagsConfiguration`, so no
component predicate can name it. A query on `ExtractorAreaData` finds the feature-level extractor
lots, which vanilla does not put in the menu, rather than the resource-specific assets it does.

So `InheritVanillaZoneMenu` inherits the categories from the same downward walk `ToolbarUISystem`
draws from: whatever the game puts under Zones appears here too, including anything a mod adds.
`ZoningSurfaceCatalog`'s family map already speaks the category names.

Entries the zone pass produced are left alone — they carry density, footprints and allowed
resources the walk cannot know — and the walk adds what the queries missed. Afterwards the
catalog drops everything vanilla does not place in Zones: the `ZoneData` query returns every zone
prefab that exists, including internal ones the player can never pick (the area-hub zones the
specialised-industry system uses, and the theme-less base zones whose EU and NA variants the menu
offers instead). That trim is applied only when the walk actually found the menu; if it ever
stops working, an over-broad catalog beats an empty one.

`IndexExtractorAreas` is the fallback for that day. The specialised industries are `LotPrefab`s
carrying `ExtractorArea` and holding a `MapFeature`, placed by the Area tool, so the zone query
(which requires `ZoneData`) never returns one. They join the zone catalog rather than getting
their own binding because the player reaches both the same way, by opening Zones.

## The menu audit

`LogVanillaMenuCoverage` answers one question — what does vanilla place that we failed to index —
and is blind in two ways:

- It skips zones outright, because they reach the player through the zoning hierarchy rather than
  the prefab index. A whole Zones tab can be missing while the report says "0 missing".
- It only looks one way. It never asks what WE show that vanilla does not place, which is how
  unbuildable zones can sit in the surface until a player tries to build one.

`LogVanillaMenuAudit` is the census that closes both: every menu, its categories, what vanilla
places, what we cover, and what we show that vanilla does not. It logs at Info whether or not
anything is wrong, because the value is in reading it rather than in being warned by it.

It runs once per city load, on the first full pass, with the processor census beside it. A
language change or a lock-state recheck repeats the pass but not the menus it reports on, so the
repeat would add a second copy of the same census. With Debug logging on, every full pass logs it.

The arithmetic and the wording live in `Domain/`, where they are functions of the index and
covered by tests: `VanillaMenuAudit` for the census, `VanillaMenuCoverage` for the coverage
report, and `IndexAuditLog` for the lines of both and of the processor census. They return lines
rather than log them, since anything that touches `Mod` cannot run in a test. For those, the
system only asks the game what a placed prefab is, and logs what comes back. The DLC audit, the
processor overlap, the zone parity check and the failure lines are worded in the system.
As a log line alone the census could only be read by booting a save and grepping
`Modding.log`, so nothing would stop the mapping regressing between boots.

Extras are split in the output: ones a recorded divergence explains are `expectedExtras`,
anything else is `UNEXPLAINED`, which is either a new divergence to write down or a bug. The
divergence list is logged beside the census so a reader of the log has the reason in hand.

The DLC lines beside it exist because two very different causes look identical from the UI: the
DLC prefabs may be absent, or present and filtered for being unowned. `EnumerateLocalDLCs` reads
the shipped manifest, so it lists what the install has; `EnumerateDLCs` goes through the platform
backends, so it lists what the store says. A stubbed Steamworks leaves the second empty while the
first is full, and then `IsDlcOwned` is false for everything but the base game.

## Per-prefab facts

An entry's figures and facts (cost, upkeep, capacity, and the service figures a card lists) are
a mapping from the components its prefab carries. `.Facts.cs` reads them into a `PrefabSnapshot`:
each component, or null when the prefab has none, plus the few inputs that live elsewhere. Those
are a road's three flags from its authoring prefab, the two upkeep buffers, an extractor's map
feature, a zone's lots, and what a prefab's sub-nets, sub-objects and auxiliary networks add: a
transformer's connections, a power plant's power lines, a building's stops and a network's extra
cost. The pollution thresholds are settings rather than a fact about any prefab, so a pass reads
them once and hands them to every snapshot. `PrefabFacts.Apply` in `Domain/` maps the snapshot
onto the entry and never touches the entity world. So a test builds a snapshot by hand and checks
what the entry gets, and `UI/test/factCoverage.test.ts` reads that file for every key it can emit.

Where the game's own tooltip shows a figure, `Apply` follows its binder in
`PrefabUISystem.BuildDefaultPropertyBinders`. Three rules decide more than one line:

- A network that owns a building, through a sub-object flagged `MakeOwner`, is read from that
  building, as `BindPrefabDetails` reads it (`DetailsSource`).
- A building's upkeep is the `ServiceUpkeepData` buffer's money and nothing else; a network's
  comes from `PlaceableNetData`. A building without the buffer has no upkeep line, as in vanilla:
  what `ConsumptionData` holds alone, on a zoned or signature building, is the rent-side upkeep
  `PropertyRenterSystem` charges, not the city's.
- Capacity is the primary role's own figure, in the unit the UI formats that role in. Two
  secondary figures vanilla shows get lines of their own, a garbage store and a power output: an
  incinerator is filed as a garbage facility, and its output is the second.

docs/design-notes.md, "The card against vanilla", lists where the card differs from vanilla
and why.

The entry keeps the facts in the order they are added, but a card re-sorts them by `FACT_ORDER`
in `serviceFacts.ts`. So the order `Apply` adds them in only breaks ties within one key, such as
a road's features.

The rest of an entry's per-prefab data is split the same way: `.Facts.cs` reads, and a plain class
in `Domain/` decides, so a test can reach every rule without the entity world.

- A building's effect lines: `EffectWording.Lines`, from its city and local modifier buffers.
- Its upgrades, in the order vanilla offers them: `SupportedUpgrades.InMenuOrder`, from the offers
  the system collects out of the `BuildingUpgradeElement` and `BuildingModule` buffers.
- What the toolbar's filter row knows about it: `VanillaAssetFacts.From`, from its requirement and
  pack entities and which of them carry `ThemeData` and `ModPrerequisiteData`.
- Its parking bays: `ParkingSlots.Own`, from its garage capacity, its parking connection and the
  shape of each parking lane. The system adds each sub-object's own count, walking the prefab graph.

An extractor's map feature stays in the system: every step of it is a read, in the order
`RequiredResourceBinder.GetExtractorType` guards them, and what is left once the reads are done is
the choice of the first matching area.

## Dev tree branches

A service's tree is a free `Basic<Service>` root with chains hanging off it.

**A node is its own branch.** `IndexDevTreeBranches` labels each node with its own name, not with
the branch below the root that it hangs off. Collapsing chains reads as the game's structure and
is not: it files the Central Intelligence Bureau under "Police Headquarters" and the Nuclear
Power Plant under "Gas Power Plant", which are separate unlocks the player buys separately.

**The root is named after its service** — Electricity, Water & Sewage, Police & Administration —
because that is what the top bar already calls this bucket, and its tab draws the service's own
glyph. Everything the tree never gated falls into that root bucket, which is why the root is also
recorded against its service name.

**Node names come from `Progression.NODE_NAME[<node prefab>]`**, the key the dev tree itself
reads. The prefab's title id points at `Assets.NAME`, which has no entry for a node, so asking for
the prefab's title gets the English prefab name ("Police Headquarters Node") in every language.
That name is still the fallback, without its "Node".

**Ranking is the tree's own layout**, column first and then distance from the trunk row. The
column alone leaves siblings tied, and an alphabetical tie-break puts Medical University and
Technical University above the plain University they specialise. Siblings in a column are drawn
around the chain they hang off, so measuring outward from the trunk takes the generic before its
specialisations — the order the player meets them in. The trunk row is that of the service's first
node in column 0, its root, and is not necessarily zero. `DevTreeLayout.Rank` does this, over each
node's column and row; the system only reads where each node is drawn.

**More than one node** can gate an asset. `DevTreeGates.Pick` files it by a rule modelled on
the game's `UnlockSystem`, which unlocks an asset once every node it needs (`RequireAll`) is bought
and one of its ways in (`RequireAny`). Taking the first match would not do: the requirements
arrive in hash order, which follows entity numbering and moves when the installed content does.

- **The asset's own service only**, when any of its gates is in it. That is its `ServiceObject`'s
  service, or failing that the one its menu is named after. Depth is a node's rank in its own
  service's tree, so comparing it across services means nothing. With no gate in its own service,
  the rule runs over all of them.
- **The deepest needed node, or the nearest way in when that is deeper.** A tie goes to the needed
  node. A lone way in needs no special case: the game treats it as needed, and the deeper of the
  two is already the deepest.
- **Unless the asset has a way in the rule cannot weigh**: a requirement that is not a node, such
  as a milestone, or a node in another service. That could let the asset in first, so the ways in
  the rule can weigh are set aside and the deepest needed node decides.
- **Ties go by label, then icon, then service.**

Depth stands in for the order the player buys nodes in, and matches it only along one chain.
Siblings in a column get different ranks, and nodes on separate branches have no fixed order.

The gates are independent nodes, such as the asset's own and the one a building it needs sits
behind. `ProgressionUtils.CollectSubRequirements` stops at each dev-tree node, so a node's
ancestors are never among them. It also flattens the requirements: a node keeps only the flags of
the edges straight into it, so how they nested above is lost. An asset that needs either of two
buildings arrives as needing both their nodes. One that needs two buildings, each with ways in of
its own, arrives with every node a way in, so it is filed under the nearest. Both mostly affect
service upgrades, which the catalog hides.

**Labels and icons travel together**, keyed by node and by service. Keying an icon by label
collides: every service's root is called "Basic", so all of them would share one entry.

**Icons** are resolved as `DevTreeUISystem.GetDevTreeIcon` does: an explicit `m_IconPath` wins,
otherwise the thumbnail of the prefab the node points at, otherwise empty. Empty rather than a
placeholder, because a placeholder glyph reads as a broken icon rather than as none.

**The `Node` suffix is dropped** from a node's display name. The game's localized title is "Gas
Power Plant Node"; the word is an authoring artefact the player never sees in the dev tree, which
draws the node under its icon.

**Folds** (`FoldedDevTreeNodes`) are the narrow exception. Transportation's Air category carries
three assets and the tree gives each of the big two its own node, so the strip draws one tab of
three and two tabs of one — and neither of those nodes has an icon, so both fall back to the
menu's glyph and render as a pair of identical marks. An international airport and a space centre
are things you build at an airport, so they are drawn under the Airport tab.

Folds are keyed on the dev tree NODE prefab name, not on the label (which is localized and would
fold in English but not in German) and not on the asset name. A key that matches nothing is a
typo rather than a no-op, and nothing in the build or the tests catches it, so an unmatched key
warns and the fold count is logged. `DevTreeLayout.Fold` applies them and returns the unmatched
ones; the system logs the warnings.

**An asset's branch** comes from the requirements `ProgressionUtils.CollectSubRequirements`
collects. `ProgressionIndex.BranchOf` turns each labelled node among them into a gate for
`DevTreeGates.Pick`, as above, and falls back to the root bucket of the service the asset's menu is
named after when no node gated it. The system only reads the asset's own service.

## Milestones

Milestone names are resolved at index time, not in the UI: the game's key is parameterised by index
(`Progression.MILESTONE_NAME:<index>`), and the modding API's `translate(id, fallback)` takes no
arguments, so the active dictionary is asked directly. `GetAssetName` does not cover it — a
milestone prefab's title lookup misses and falls through to the prefab name, literally
"Milestone7". Resolving at index time also means milestone names follow a language change for free,
because a full pass follows `OnActiveDictionaryChanged` when the active locale is not the one the
names were resolved in. The game raises that same event for every locale source a mod adds or
removes, and those do not change the language: `LocaleReindexPolicy` defers them to one full pass a
second after the last. Both passes are taken from `OnUpdate`, never run from the event: the event
also fires at the main menu and between a preload and `OnGameLoaded`, where `OnUpdate` is off, and
a pass there would publish an index outside a city or from a half-loaded world. A full pass run for
any other reason (the save's own at `OnGameLoaded`) covers either, so a language switched at the
main menu is simply read by the next city's first pass. Eight full passes in the first minute at
the main menu, one per mod locale file, is what that replaced.

`ProgressionIndex.MilestoneNames` is sized from the highest index actually present
rather than probed upward from index 0, which the game's first milestone need not use — probing
publishes an empty table in that case. Gaps stay empty strings so every later name keeps its own
index.