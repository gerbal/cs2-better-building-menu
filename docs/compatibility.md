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

Tree Controller and Line Tool remain untested for the reasons above.

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

## Tree Controller and Advanced Line Tool: versions found, install blocked (2026-09-12)

Both are current and target this game version, so the earlier "untested"
notes were about finding them, not about them being unavailable.

| Mod | Store id | Version | For game | Updated | Subscribers |
|---|---|---|---|---|---|
| Tree Controller (yenyang) | 75993 | 1.7.4 | 1.6.* | 23 Aug 2026 | 344.8k |
| Advanced Line Tool (algernon) | 75816 | 1.2.3 | 1.6.* | 6 Jul 2026 | 525.5k |

Two reasons they were missed before. Line Tool is now published as **Advanced
Line Tool**, so a search anchored on the old name found nothing; and the
cached package here is build 18 (0.9.8.4, declaring game 1.1), which is why
it failed to load on 1.6. The store carries build 41. Tree Controller was
never cached here, and its GitHub releases stop at 2024 pre-releases because
it publishes to Paradox Mods; its own project file reads 1.7.4.

Installing them is currently blocked, not refused. Pressing "Add to active
playset" flips the button to INSTALLING and nothing downloads: no package
appears under `.cache/Mods/pdx_mods`, the playset is unchanged, and
`PdxSdk.log` records no error. Tried twice either side of a restart, and on
the second attempt the detail page itself came up without its fields until
polled. `Player.log` shows unrelated modding-toolchain downloads timing out
over HTTP in the same session, which points at the game process's network
rather than at these two mods; downloads did work here earlier the same day.

Neither can be fetched from GitHub instead: Advanced Line Tool's latest
release has no build attached, and Tree Controller's only release asset is
a 2024 native library.

So the compatibility check for these two is still pending. Both patch
`ToolbarUISystem.Apply`, which a click in this panel does not go through, so
the questions to answer are whether a tree picked here registers with Tree
Controller's tool and whether Advanced Line Tool keeps its mode and age
mask. The quickest route is to subscribe to both from the Paradox Mods
website or in a normal session, after which the usual run answers it.

## Tree Controller and Advanced Line Tool: installed and passing (2026-09-12)

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

That closes the survey: every mod on the list has now been measured.
