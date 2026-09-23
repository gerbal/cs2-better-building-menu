# Prefab indexing

Design rationale for `PrefabIndexingSystem`, one partial class across six files in
`BetterBuildingMenu/Systems/`:

- `PrefabIndexingSystem.cs`: the lifecycle, the passes, and what each entry is built from;
- `.Menus.cs`: the vanilla menus;
- `.MenuAudit.cs`: the census and coverage report;
- `.Facts.cs`: per-prefab facts;
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

`OnGameLoadingComplete` still runs, and lock state is the one fact the earlier pass could
plausibly have got wrong. `LockStateDrift` is the exact test for it — the same `Locked` read
`ApplyUnlocks` uses, over every indexed prefab. Zero drift skips the second full pass; any drift
runs it and logs how many prefabs moved.

Mod detection (`Mod.RefreshEnabledMods`) and Road Builder's discard component are re-read at the
start of every full pass. Reading them at loading-complete came after the `OnGameLoaded` pass.
Reading them once per process missed a mod added to the playset between two city loads, which the
game allows without a restart.

## Partial passes

A prefab the game creates or changes mid-session, such as a Road Builder edit, is re-read by a
partial pass. Each processor keeps two queries, both built in `OnCreate`: its own, and a copy
narrowed to `Created` or `Updated`. A partial pass reads only the narrowed copy, so one edited road
costs one prefab rather than every road its processor matches.

Duplicate names are numbered after every pass, partial passes included, always starting from each
prefab's `AssetName`. A partial pass gives the prefab it re-reads back its plain name. Numbering
only what it touched would leave that prefab as "Foo" beside a sibling still called "Foo 2".

## A pass that fails

A full pass clears the index and rebuilds it, along with the menus, zones, milestones and dev tree
it reads. `RunIndex` captures what it is about to replace, and if anything in the build throws, it
puts all of it back and logs the error. The panel keeps the index it had, and nothing reaches the
game's load or locale dispatch.

Capturing references is enough, because a pass never writes to the old collections. Every
`Index*` step builds new ones and assigns them at its end, and `AddAllCategories` gives every
category new lists. Before the first pass there is nothing to keep, so a failure there leaves an
empty index laid out, and `IsReady` stays false.

A failed pass at `OnGameLoaded` does not count as indexed, so loading-complete runs its own.
Partial passes are not covered. They edit the live index in place, and each prefab and each
processor in them has its own catch.

## How the panel hears of a change

The indexer never calls the panel. Whatever changes an indexed fact — a pass, an unlock, a unique
asset built or bulldozed — bumps `IndexGeneration`, and `BuildingMenuUISystem.OnUpdate` compares
it with the generation its last publish read (`IndexWatch`).

A change while the panel is open schedules the same debounced refresh a keystroke does, so a burst
of partial passes or unique events is one refresh rather than one each. A change while it is closed
schedules nothing, because opening the panel publishes anyway.

## The vanilla menu walk

`IndexVanillaMenuPlacements` walks the game's own group tree downward: `UIAssetMenuData` menus →
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
indexed.

Two things read the result: the coverage report, and the index itself, which treats placement as
an override — see the blacklist check in `BuildIndex` and `IsPlacedInVanillaMenu`.

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

The arithmetic lives in `VanillaMenuAudit`, where it is a function of plain data and covered by
tests; the system only gathers the facts out of the entity world and logs what comes back. As a
log line alone the census could only be read by booting a save and grepping `Modding.log`, so
nothing would stop the mapping regressing between boots.

Extras are split in the output: ones a recorded divergence explains are `expectedExtras`,
anything else is `UNEXPLAINED`, which is either a new divergence to write down or a bug. The
divergence list is logged beside the census so a reader of the log has the reason in hand.

The DLC lines beside it exist because two very different causes look identical from the UI: the
DLC prefabs may be absent, or present and filtered for being unowned. `EnumerateLocalDLCs` reads
the shipped manifest, so it lists what the install has; `EnumerateDLCs` goes through the platform
backends, so it lists what the store says. A stubbed Steamworks leaves the second empty while the
first is full, and then `IsDlcOwned` is false for everything but the base game.

## Dev tree branches

A service's tree is a free `Basic<Service>` root with chains hanging off it.

**A node is its own branch.** `IndexDevTreeBranches` labels each node with its own name, not with
the branch below the root that it hangs off. Collapsing chains reads as the game's structure and
is not: it files the Central Intelligence Bureau under "Police Headquarters" and the Nuclear
Power Plant under "Gas Power Plant", which are separate unlocks the player buys separately.

**The root is named after its service** — Electricity, Water & Sewage, Police & Administration —
because that is what the top bar already calls this bucket, and its tab draws the service's own
glyph. The node's own name is worse: it has no localized title, so it falls through to a prefab
name. Everything the tree never gated falls into that root bucket, which is why the root is also
recorded against its service name.

**Ranking is the tree's own layout**, column first and then distance from the trunk row. The
column alone leaves siblings tied, and an alphabetical tie-break puts Medical University and
Technical University above the plain University they specialise. Siblings in a column are drawn
around the chain they hang off, so measuring outward from the trunk takes the generic before its
specialisations — the order the player meets them in. The trunk row is taken from the service's
own root and is not necessarily zero.

**More than one node** can gate an asset. `DevTreeGates.Pick` chooses by a stated rule rather
than taking the first match, because the requirements arrive in hash order, which follows entity
numbering and moves when the installed content does. A node the asset needs (`RequireAll`) comes
before one of several ways in (`RequireAny`). Among the nodes it needs, the one furthest into the
tree wins: the player buys it last, so it is what unlocks the asset, and the root and the chain
below it never are. Among ways in, the nearest wins, since any one of them unlocks it. Ties go
by label, then icon.

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
warns and the fold count is logged.

**An asset's branch** is looked up through `ProgressionUtils.CollectSubRequirements`: the first
collected requirement that is a labelled dev tree node wins. A node can have several parents
(Satellite Uplink requires both Server Farm and Telecom Tower); taking the first keeps the walk
total, and nothing in the UI depends on that choice being canonical. An asset no node gated falls
into the service's root bucket.

## Milestones

Milestone names are resolved at index time, not in the UI: the game's key is parameterised by
index (`Progression.MILESTONE_NAME:<index>`), and the modding API's `translate(id, fallback)`
takes no arguments, so the active dictionary is asked directly. `GetAssetName` does not cover it
— a milestone prefab's title lookup misses and falls through to the prefab name, literally
"Milestone7". Resolving at index time also means milestone names follow a language change for
free, because `OnActiveDictionaryChanged` runs a full pass when the active locale is not the one
the names were resolved in. The game raises that same event for every locale source a mod adds
or removes, and those do not change the language: `LocaleReindexPolicy` defers them to one full
pass a second after the last, polled from `OnUpdate`, and a full pass run for any other reason
(the save's own at `OnGameLoaded`) cancels the deferral. Eight full passes in the first minute at
the main menu, one per mod locale file, is what that replaced.

`GetMilestoneNames` is sized from the highest index actually present
rather than probed upward from index 0, which the game's first milestone need not use — probing
publishes an empty table in that case. Gaps stay empty strings so every later name keeps its own
index.