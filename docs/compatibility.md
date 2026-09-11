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
