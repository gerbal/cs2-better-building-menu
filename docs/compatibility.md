# Compatibility with popular mods

Popular code mods, surveyed from source on 2026-09-11 and each measured live
since. The table is the current answer; the dated sections below it are the
measurements behind it, oldest first. Screenshots cited as
`compat/probe/*.png`, and the source clones under `compat/repos/`, are in the
maintainer's workspace, not in this repository.

## Current status

| Mod | Version tested | Ours | Result | Measured |
|---|---|---|---|---|
| Water Features (yenyang) | — | 0.1.8 | Works. Its WaterTool tab and water sources appear under Landscaping; the catch-all processor indexes them. | 2026-09-12 |
| Extra Assets Importer, with ExtraLib (Triton) | — | 0.1.8 | Works. We yield its ExtraAssetsMenu to vanilla, which draws its 18 items. Its 13 nested child categories are tabs, not assets, and stay out of the index by design. | 2026-09-12 |
| Asset UI Manager (StarQ) | — | 0.1.8 | Works. The panel groups by its runtime categories, with their own icons; the audit reports 0 misplaced. | 2026-09-12 |
| Zone Organizer (Mimonsi) | — | 0.1.8 | Works. Its ten Zones tabs sit in our strip; all 22 zones are listed. | 2026-09-12 |
| Road Builder (TDW) | — | 0.1.8 | Works, including a road created while playing. Removal of the roads it discards is by code reading only. | 2026-09-12 |
| Zone Color Changer (TDW) | — | 0.1.9 | Works. Its button is hosted in the panel's top bar while a zone is armed. | 2026-09-12 |
| Tree Controller (yenyang), Advanced Line Tool (algernon) | 1.7.4, 1.2.3 | 0.1.9 | Work. Their options sit in the tool options bank beside ours, and line mode survives picking a tree here. | 2026-09-12 |
| Anarchy (yenyang) | 1.7.24 | 0.1.10 | Works. Its options sit beside ours, and "place multiple unique buildings" reaches this panel. | 2026-09-13 |
| Asset Icon Library (TDW) | — | 0.1.6 | Works. Tiles draw its icons: 85 of 100 in Landscaping. | 2026-09-11 |
| Extra Landscaping Tools, Extra Detailing Tools (Triton) | — | 0.1.6 | Work. Their tools and props are indexed. | 2026-09-11 |
| Toggle Overlays, Unified Icon Library, I18n Everywhere | — | 0.1.6 | No interaction. | 2026-09-11 |
| Asset Menu Tweaks (Luca) | 1.0.7 | 0.1.4 | No effect on our panel, in either load order and with every option on. See docs/verification.md. | 2026-09-10 |
| Find It (TDW) | 1.5.8 | pre-release | Both install together. Its panel takes the asset-menu slot while open and ours returns when it closes; its picker is the only one. See docs/verification.md. | 2026-09-02 |
| Platter (Luca), Extra Networks and Areas (Mimonsi), Recolor (yenyang) | — | — | Source read only. The first two add or regroup menu entries at load, before our index runs; Recolor's palettes are not toolbar assets. | 2026-09-10/11 |
| Traffic, Better Bulldozer, Move It, Plop the Growables, 529 Tiles, Historical Start, Skyve, Extended Tooltip, Detailed Descriptions, Region Flag Icons, First Person Camera, Time & Weather Anarchy, Realistic Parking, Traffic Lights Enhancement | — | — | Source read only: no asset-menu or menu-tree hooks. | 2026-09-11 |

## What this mod touches

- Extends `asset-menu.tsx` `AssetMenu` (replaces the grid when it owns the
  menu), `upgrades-menu.tsx` `UpgradesMenu`, `mouse-tool-options.tsx`
  `MouseToolOptions` (availability section), `tool-options-panel.tsx`
  `useToolOptionsVisible` (hook-free) and `ToolOptionsPanel`.
- Appends two invisible watchers to `Game`.
- Arms prefabs through `ToolSystem.ActivatePrefabTool`, not through
  `ToolbarUISystem`, so Harmony patches on the toolbar's `Apply`,
  `ActivatePrefabTool` and `BindAssets` do not run for a tile click here.
- Reads the menu tree at the city's loaded hook and on prefab changes.

## Method

Sources were cloned and grepped for `moduleRegistry.(extend|override|append)`
and Harmony attributes, and for the menu-tree writers `m_Group`, `m_Menu`,
`UIAssetCategoryPrefab` and `AddPrefab`. Subscriber totals from the game's
package cache ranked the survey, since the in-game "Most popular" page could
not be filtered to code mods reliably.

## Measured 2026-09-11 (Porterville, main prefix, our 0.1.6 from the store)

Fifteen mods loaded together from the game's package cache as local mods
(the playset is server-side and ignores local edits; the store view was too
flaky to add eleven mods by hand). Zero exceptions in every mod log and
zero JS errors across both stages. Tree Controller and Line Tool were not
found that day; both were measured on 2026-09-12, below.

| Mod | Result |
|---|---|
| Water Features | **Conflict.** Its ten WaterSource tools sit under Landscaping's WaterTool tab in vanilla and are missing from our index (`[MENU-COVERAGE] category="WaterTool" vanilla=10 missing=10`): the prefab type is one no processor indexes. Our Landscaping panel has no water tools. |
| Extra Assets Importer (with ExtraLib) | **Conflict.** Adds a toolbar menu "ExtraAssetsMenu" whose tabs are ExtraLib parent/child categories (`UIAssetChildCategoryPrefab`). We take the menu over and draw "No buildings in this category"; vanilla draws its decals, net lanes and surfaces. 13 of the 23 missing entries are its child categories. |
| Asset UI Manager | **Mismatch.** It regroups assets into its own categories at runtime (Police & Administration becomes Local Polices, Intelligences, Police HQs, Prisons, Administration). Our tabs keep the stock layout; the audit reports 18 "misplaced" lines. Every asset is still present, so nothing is lost, but its reorganisation does not show in our panel. Same mechanism as Zone Organizer below. |
| Zone Organizer | **Mismatch, harmless.** Its ten density tabs appear in vanilla's Zones; our Zones surface groups by family and density itself and shows all 22 zones, so its tabs are not represented. |
| Asset Icon Library | Works: 85 of 100 Landscaping tiles and 7 of 11 Water & Sewage tiles draw from its `coui://ail` host. |
| Road Builder | Works: its generated roads appear in our Roads panel (8 tiles from its thumbnail host, total 217 vs 204 without it). |
| Anarchy | Works: its sections sit in the options bank beside ours when a tree is armed from our panel. Its "place multiple unique buildings" option reaches this panel too, measured both ways in 0.1.10 — see the section at the end. |
| Extra Landscaping Tools, Extra Detailing Tools | Work: their tools and props are indexed (Landscaping missing=0 apart from WaterTool). |
| Zone Color Changer | As predicted: its opener button lives in vanilla's category tab bar, so it is absent while our panel is open. |
| Toggle Overlays, Unified Icon Library, I18n Everywhere | No interaction. |

## After the fixes (0.1.7 / 0.1.8, measured 2026-09-11)

Three fixes followed: yield a menu to vanilla when our catalog for it is
empty, which covers ExtraLib menus and any future menu we cannot fill; index
prefabs the menu tree places whatever their type; and take each asset's
category from the menu walk's placement (ECS `UIObjectData`) instead of the
managed `UIObject`, so runtime regroups are honoured. Re-run on Porterville
with the same mods installed as local packages.

| Was | Now |
|---|---|
| Water Features' ten water tools missing (`category="WaterTool" vanilla=10 missing=10`) | The catch-all processor indexes them: `[PROCESSOR-CENSUS] MenuPlacedPrefabCategoryProcessor indexed=10 lens=10`, audit `0 missing`, and a Landscaping search for "water" lists all ten. |
| Extra Assets Importer's menu taken over and drawn empty | We yield it: with its companion tools installed the menu shows 18 items across 7 vanilla tabs, ours draws nothing. Verified twice, opened first and after our panel had been open. |
| Asset UI Manager's regroup ignored (18 "misplaced") | The panel groups by its categories (Intelligence Services, Local Police Departments, Police Headquarters, Prisons, Administration); audit `0 misplaced`. |
| Zone Organizer likewise | Its ten Zones tabs come through; all 22 zones still listed. |

### The tab icons, and a wrong turn

The first build of the placement change drew three of Asset UI Manager's
five tabs as blank placeholders. Cause, from the live bindings: a category's
icon has two addresses, an `assetdb://global/<hash>` content hash and an
`assetdb://user/Mods/<mod>.cok@<file>` archive path. The hash draws nothing
and the game's own tool button swaps it for `Media/Placeholder.svg`; the
path draws. The prefab's `UIObject.m_Icon` holds the hash, and the image
system's entity call `GetIconOrGroupIcon(Entity)` returns the path.

Two attempts missed before that landed: preferring the image system's
static `GetIcon(PrefabBase)` (same hash, since that is what the game's own
toolbar writes too) and then rejecting every `assetdb://` URL as undrawable,
which threw away the good path along with the hash. `CategoryIcon` now
rejects only the `assetdb://global/` hash form. Measured after: Police 0
placeholders, Zones, Landscaping and Roads unchanged at 0.

### Road Builder, roads created while playing (2026-09-12)

**Yes, without a reload.** Driven through Road Builder's own Discover panel,
which fetches a community road and calls its add-prefab path at runtime, so
no world interaction is needed: `Discover.SetPage` to fill the list, then
`Discover.Download` with an item id.

The road arrived as "Six-Lane Divided Bus Road". Our Roads catalog went 213
to 214 and the index count 17,703 to 17,704, through partial passes of 43
and 45 ms. Our menu then listed ten Road Builder items where only nine
configs exist on disk, the extra being that road, which is still only in
memory. A search finds it and it draws with its own thumbnail
(`compat/probe/rb-runtime-road.png`). No exceptions, no JS errors.

The earlier attempt failed because `CreateNewPrefab` takes a world entity
that the tool supplies from a road the player clicks, so calling it bare did
nothing. Roads it discards are removed again through the
`DiscardedRoadBuilderPrefab` component the indexer checks; that half is by
code reading, not measured.

One thing the listing shows that is not a defect: several Road Builder roads
share a display name (two "Custom Two-Lane Road"). They are distinct configs
with distinct ids, and the panel lists them separately, as vanilla does.

## All four together on 0.1.8 (2026-09-12)

One run, twelve mods, no init errors, no exceptions, no JS errors. Audit:
`844 assets across its menus; 13 missing` and `0 misplaced`. The thirteen are
ExtraLib's nested child categories, which are tabs rather than things a tool
can arm, so the catch-all leaves them alone by design.

| Menu | What is drawn |
|---|---|
| Landscaping | Ours, 346 entries. Strip carries Water Features' `WaterTool` tab beside the vanilla ones, count 8, and the water sources list and search (`compat/probe/after-Landscaping.png`, `after-WaterSearch.png`). Extra Landscaping Tools' resource brushes sit in Terraforming. |
| Police & Administration | Ours, grouped by Asset UI Manager's categories, its own tab icons, 0 placeholders (`after-Police.png`). |
| Zones | Ours, 22 zones, Zone Organizer's ten tabs in the strip (`after-Zones.png`). |
| ExtraAssetsMenu | Vanilla's, 18 items across its own tab bar; we stand aside (`after-ExtraAssetsMenu.png`). |

## Zone Color Changer, integrated (0.1.9, 2026-09-12)

Its "Edit Zone Colors" button is appended to the game's `AssetCategoryTabBar`,
which this panel stands in for, so it had nowhere to draw. `VanillaTabBarHost`
mounts that component inside the panel's top bar with no categories of its
own, and the stylesheet hides the vanilla bar it brings along, so only what
another mod appended is seen. Any mod extending that export benefits, not
just this one.

Measured: with a zone armed from our panel the zone tool goes active,
`ZoneToolActive` flips true and the button appears beside the header
(`compat/probe/zcc-final.png`); its colour panel opens and works. The host's
two children read `container` visible and `asset-category-tab-bar` hidden.

The first build shipped a camel-cased selector (`assetCategoryTabBar`) that
matched nothing, so an empty bar and a stray close button showed inside the
panel. The game's DOM class is hyphenated. A render test now pins the
selector.

## Tree Controller and Advanced Line Tool (0.1.9, 2026-09-12)

| Mod | Store id | Version | For game | Updated | Subscribers |
|---|---|---|---|---|---|
| Tree Controller (yenyang) | 75993 | 1.7.4 | 1.6.* | 23 Aug 2026 | 344.8k |
| Advanced Line Tool (algernon) | 75816 | 1.2.3 | 1.6.* | 6 Jul 2026 | 525.5k |

**Why they were missed on 2026-09-11.** Line Tool is now published as
Advanced Line Tool, so a search on the old name found nothing, and the
package cached here was build 18 (0.9.8.4, declaring game 1.1), which fails
to load on 1.6. Tree Controller publishes to Paradox Mods only; its GitHub
releases stop at 2024 pre-releases.

Both now installed from the store and run beside this mod: Tree Controller
1.7.4 (75993) and Advanced Line Tool 1.2.3 (75816, package 75816_41), with
Unified Icon Library 1.0.14, on 0.1.9. No init errors, no exceptions, no JS
errors.

**Why the installs looked broken.** Each lists Unified Icon Library under
"Required mods", and the store had it as "Not added". Pressing "Add to
active playset" then flips the button to INSTALLING and silently does
nothing: no package, no playset change, nothing in `PdxSdk.log`. Installing
the dependency first and restarting (the wedged INSTALLING state survives in
the view) let both through immediately. A control mod with no unmet
dependency installed normally throughout, which is what separated "these two"
from "downloads are broken". Beware also of look-alikes: an exact title match
is needed, since "Tree Controller - SAC Managed [Deprecated]" (157482, 79
subscribers) outranked yenyang's original in the search.

**The interaction that was in doubt.** Both patch `ToolbarUISystem.Apply`,
which a click in this panel does not go through. It does not matter here,
because both hang their controls off the tool options bank rather than that
patch. Arming a tree from the panel gives a bank holding Tree Controller's
Sets 1-5, Age, Min Slope, Max Slope and Change, Advanced Line Tool's section,
and this mod's Availability together
(`compat/probe/treeline-armed.png`).

Pressing a line mode switches the active tool to Line Tool and its full
options appear, spacing, rotation, elevation and the variations. Arming a
different tree from the panel afterwards keeps the tool on Line Tool with its
options intact (`compat/probe/line-mode-on.png`), so line mode survives
picking an asset here, which was the specific worry.

That closes the survey: every mod on it with a menu touch point has now been
measured.

## Anarchy's "place multiple unique buildings" (0.1.10, measured 2026-09-13)

Anarchy 1.7.24 as a local package, its option enabled through the options
widget, on Porterville.

**What it does.** Three Harmony patches carry that option. A postfix on
`UniqueAssetTrackingSystem.IsPlacedUniqueAsset` answers `false` while the
option is on. A postfix on that system's `OnCreate` disables the system
outright, and a prefix on `ToolbarUISystem.OnUpdate` re-enables it every
frame when the option is off (and keeps it off, plus clears
`m_UniqueAssetStatusChanged`, when it is on).

**Why our panel refused what Anarchy allows.** Our placed-unique set was
seeded by reading the tracker's `placedUniqueAssets` collection directly.
The accessor Anarchy overrides never came into it, so the option could not
reach us, and because the system is disabled at create, the collection we
read was empty and `EventUniqueAssetStatusChanged` never fired. The log said
`Placed unique assets: 0` on every pass.

**Measured, on Porterville with Anarchy 1.7.24 installed as a local package.**
A unique asset (Early Disaster Warning System) was placed in the city through
the QA bridge's synthetic input, and Anarchy's option was then flipped through
its settings object with the city still running — no reload between readings.

| Anarchy's option | The game's `IsPlacedUniqueAsset` | Our panel's `isAlreadyBuilt` | Clicking the tile |
|---|---|---|---|
| off | `True` | `true`, tile badged and dimmed | refused; the armed prefab stays what it was |
| on | `False` | `false`, tile drawn normally | arms the asset |

Screenshots: `compat/probe/anarchy-off-refused.png` and
`compat/probe/anarchy-on-placeable.png`. The panel followed each flip within a
publish, with no city reload, which is the case the old code could not reach:
the entry came in on the tracker's event, and with the option on the tracker is
disabled and raises no event to take it away again.

**The fix, and why it is generic.** The set is now built by asking the game
`IsPlacedUniqueAsset(prefabEntity)` for each unique asset in the index, and
the scan re-runs on every catalog publish rather than only on a city load, so
a tracker that is switched off and raises no events cannot leave us stale.
Any mod that overrides the same public accessor changes our answer with it;
nothing here names Anarchy. `PlacedUniqueScan` holds the rule,
`PlacedUniqueRegistry.Reset` reports whether the set moved so the snapshot
cache is only dropped when it did.

