# Compatibility with popular mods

Surveyed 2026-09-11. Subscriber counts are Paradox Mods totals as cached by
the game on this machine. "Touch points" are what each mod does to the
surfaces this mod also uses: the vanilla AssetMenu export, the tool options
bank (`MouseToolOptions`, `useToolOptionsVisible`), the toolbar's C# side
(`ToolbarUISystem`), and the prefab menu tree (`UIObject.m_Group`,
`UIAssetCategoryPrefab`). Sources read from the mods' GitHub repositories
where public; "closed" means not read.

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

## Ranked, by likely trouble

| Mod | Subs | Touch points | Risk | Why |
|---|---:|---|---|---|
| Tree Controller (yenyang) | high | Harmony postfix on `ToolbarUISystem.Apply`; extends `MouseToolOptions`, `useToolOptionsVisible` | **High** | Its postfix registers a tree picked in the toolbar with its own tool and keeps Line Tool active. A tree picked from our Landscaping panel never passes through `Apply`, so that step is skipped. Needs a live check of picking trees with Tree Controller and Line Tool active. |
| Line Tool (algernon) | 525k | Harmony postfix on `ToolbarUISystem.Apply`; extends `MouseToolOptions`, `useToolOptionsVisible` | **High** | Same `Apply` bypass: its age-mask sync runs only for toolbar picks. Line Tool mode may drop when a prefab is chosen from our panel. Live check. |
| Anarchy (yenyang) | 1.10M | Harmony postfix on `ToolbarUISystem.ActivatePrefabTool` and `OnUpdate`; four `MouseToolOptions` extensions; `useToolOptionsVisible` | Medium | Its "place multiple unique buildings" postfix re-activates a built unique when picked in the toolbar. Our tile click bypasses it and our own `canPlace` guard blocks already-built uniques, so that Anarchy option has no effect through our panel. Tool-options bank ordering with four extra sections is worth a look. |
| Zone Organizer (Mimonsi) | 259k | Creates `UIAssetCategoryPrefab` tabs under Zones and regroups every zone asset (`m_Group`, priorities) | Medium | Our Zones surface inherits categories from the menu tree, so its tabs should appear, but we also split by density ourselves; expect doubled tiers. Live check. |
| Water Features (yenyang) | 454k | Harmony prefix on `ToolbarUISystem.BindAssets` for its "WaterTool" tab under Landscaping; extends `MouseToolOptions`, `useToolOptionsVisible` | Medium | It repairs its tab's group elements lazily when the toolbar binds that tab. We never call `BindAssets`, so its assets may be missing or misplaced in our Landscaping panel. Live check. |
| Asset Icon Library (TDW) | 756k | Rewrites `UIObject.m_Icon` for thousands of prefabs | Medium | Our thumbnails are read at index time; if its replacer runs later, our tiles keep the old icons. Live check. |
| Zone Color Changer (TDW) | mid | Extends `AssetCategoryTabBar` with its panel button | Medium | That tab bar is vanilla's; while our panel is open the button is not drawn, so its panel has no opener. Not a crash, a hidden feature. |
| Asset UI Manager (StarQ) | 67k | Reorganises menus and categories (closed) | Medium | Unknown mechanism; it rewrites the same tree we read. Live check only. |
| Find It (TDW) | 731k | Extends `AssetMenu`, `MouseToolOptions`, `useToolOptionsVisible`, `ToolOptionsPanel`, `RightMenu` | Low | Already handled: this mod yields while Find It's panel is shown; measured earlier. |
| Asset Menu Tweaks (Luca) | 5k | Extends `AssetMenu`, `AssetGrid`; body-class CSS | Low | Measured 2026-09-10 in both load orders and with every option on: no effect on our panel. |
| Road Builder (TDW) | 605k | Generates road prefabs with `UIObject` groups at runtime; own right-menu button | Low | Our change-driven index picks up new prefabs; its tool is already special-cased. Worth one live check that a freshly built road appears in our Roads panel. |
| Extra Networks and Areas (Mimonsi) | 403k | Assigns `m_Group` to its prefabs at load | Low | Runs before our index; nothing dynamic. |
| Recolor (yenyang) | high | Extends `MouseToolOptions`, `useToolOptionsVisible`; adds palette prefabs | Low | Palettes are not toolbar assets. |
| Platter (Luca) | 130k | Adds a Zones category; Harmony on tool systems | Low | Read 2026-09-10; no menu conflict. |
| Toggleable Overlays (TDW) | 152k | Harmony prefix on `ToolBaseSystem.UpdateInfoview` | None | Orthogonal. |
| Traffic, Better Bulldozer, Move It, Plop the Growables, 529 Tiles, Historical Start, Unified Icon Library, I18n Everywhere, ExtraLib, Skyve, Extended Tooltip, Detailed Descriptions, Region Flag Icons, First Person Camera, Time & Weather Anarchy, Realistic Parking, Traffic Lights Enhancement | 176k–1.33M | No asset-menu or menu-tree hooks found | None | Move It's tool is already special-cased. |
| Extra Landscaping Tools, Extra Detailing Tools, Extra Assets Importer (Triton) | 479k–578k | Closed; add tools, props, decals and surfaces to Landscaping | Unknown | Closed source; the Landscaping panel with them installed needs a live look. |

## Suggested live order

1. Tree Controller + Line Tool + Anarchy together (one yenyang/algernon stack): pick trees and a unique building from our panel, check Line Tool stays active and Tree Controller's selection follows.
2. Zone Organizer: open Zones, compare its tabs against our density tiers.
3. Asset Icon Library: open Roads and Landscaping, count tiles drawing its icons.
4. Water Features: Landscaping panel shows the WaterTool tab and its assets.
5. Extra Landscaping/Detailing Tools and Extra Assets Importer: Landscaping panel completeness.
6. Asset UI Manager: any menu at all.

## Method notes

Sources cloned to the session scratchpad under `compat/repos/`. Hooks found
with a grep for `moduleRegistry.(extend|override|append)` and Harmony
attributes; menu-tree writers with a grep for `m_Group`, `m_Menu`,
`UIAssetCategoryPrefab` and `AddPrefab`. The in-game "Most popular" page
could not be filtered to code mods reliably from the DOM, so the ranking
uses the cached subscriber totals.

## Measured 2026-09-11 (Porterville, main prefix, our 0.1.6 from the store)

Fifteen mods loaded together from the game's package cache as local mods
(the playset is server-side and ignores local edits; the store view was too
flaky to add eleven mods by hand). Zero exceptions in every mod log and
zero JS errors across both stages. Tree Controller and Line Tool could not
be tested: the store search never returned Tree Controller's card, and the
cached Line Tool package is an old build that fails to load on 1.6
(`TypeLoadException` on a moved game type, not ours).

| Mod | Result |
|---|---|
| Water Features | **Conflict.** Its ten WaterSource tools sit under Landscaping's WaterTool tab in vanilla and are missing from our index (`[MENU-COVERAGE] category="WaterTool" vanilla=10 missing=10`): the prefab type is one no processor indexes. Our Landscaping panel has no water tools. |
| Extra Assets Importer (with ExtraLib) | **Conflict.** Adds a toolbar menu "ExtraAssetsMenu" whose tabs are ExtraLib parent/child categories (`UIAssetChildCategoryPrefab`). We take the menu over and draw "No buildings in this category"; vanilla draws its decals, net lanes and surfaces. 13 of the 23 missing entries are its child categories. |
| Asset UI Manager | **Mismatch.** It regroups assets into its own categories at runtime (Police & Administration becomes Local Polices, Intelligences, Police HQs, Prisons, Administration). Our tabs keep the stock layout; the audit reports 18 "misplaced" lines. Every asset is still present, so nothing is lost, but its reorganisation does not show in our panel. Same mechanism as Zone Organizer below. |
| Zone Organizer | **Mismatch, harmless.** Its ten density tabs appear in vanilla's Zones; our Zones surface groups by family and density itself and shows all 22 zones, so its tabs are not represented. |
| Asset Icon Library | Works: 85 of 100 Landscaping tiles and 7 of 11 Water & Sewage tiles draw from its `coui://ail` host. |
| Road Builder | Works: its generated roads appear in our Roads panel (8 tiles from its thumbnail host, total 217 vs 204 without it). |
| Anarchy | Works: its sections sit in the options bank beside ours when a tree is armed from our panel. The "place multiple unique buildings" path was not exercised. |
| Extra Landscaping Tools, Extra Detailing Tools | Work: their tools and props are indexed (Landscaping missing=0 apart from WaterTool). |
| Zone Color Changer | As predicted: its opener button lives in vanilla's category tab bar, so it is absent while our panel is open. |
| Toggle Overlays, Unified Icon Library, I18n Everywhere | No interaction. |

Fixes suggested, in order: (1) yield a menu to vanilla when our catalog for
it is empty, which covers ExtraLib menus and any future menu we cannot
fill; (2) index prefabs the menu tree places regardless of type, or at
least `WaterSourcePrefab`; (3) take each asset's category from the menu
walk's placement (ECS `UIObjectData`) instead of the managed `UIObject`, so
runtime regroups by Asset UI Manager and Zone Organizer are honoured.

## After the fixes (0.1.7 / 0.1.8, measured 2026-09-11)

Re-run on Porterville with the same mods installed as local packages.

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

Still untested: Tree Controller and Line Tool (see above).

### Road Builder, roads created while playing (2026-09-11)

What is established. Its existing roads reach our Roads menu: 213 entries
with it installed against 204 without, 8 tiles drawing from its own
thumbnail host. The mechanism for runtime additions is there and observably
alive: the indexer re-runs a partial pass whenever any prefab carries
`Created` or `Updated`, Road Builder adds its roads through
`PrefabSystem.AddPrefab`, and a partial pass (0.013s) was logged moments
after its "Road Generation Data assembled" during this test. Roads it
discards are removed again, through the `DiscardedRoadBuilderPrefab`
component the indexer checks.

What is NOT established: a road created mid-session end to end. Its create
flow needs its tool active on a road selected in the world, which could not
be driven from the debugger; `ActivateRoad` + `CreateNewPrefab` and
`ManageRoads` as bare triggers did not produce one (catalog 213 before and
after). Anyone playing can settle it in one step: build a road in Road
Builder and open Roads. It should appear without reloading, and
`BetterBuildingMenu.log` should carry a "Partial Prefab Indexing completed"
line at that moment.
