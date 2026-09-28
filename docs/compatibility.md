# Compatibility with popular mods

How this mod meets other mods, and a record of how popular ones fared beside it.

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

## What lets other mods work here

- **A menu we cannot fill is left to vanilla.** A toolbar menu with nothing indexed under it
  draws as its mod intends (`MenuRouting.ShouldYield`).
- **Nested categories become tabs.** A menu built from nested categories, such as ExtraLib's, has
  a tab for each category that holds assets. See [indexing.md](indexing.md), "The vanilla menu
  walk".
- **Whatever the menu tree places is indexed**, whatever its prefab type: that is how Water
  Features' water tools arrive: `MenuPlacedPrefabCategoryProcessor` runs last and indexes what
  the menus place and nothing else claimed.
- **Entries sit where the game's menus put them now**, so a mod that regroups categories at
  runtime, as Asset UI Manager and Zone Organizer do, regroups the panel with them. See
  [indexing.md](indexing.md), "Partial passes".
- **A category's icon is an address that draws.** A category has two: a content hash
  (`assetdb://global/…`), which draws nothing, and an archive path, which does
  (`CategoryIcon`).
- **Buttons other mods add to the game's category tab bar** draw in the panel's top bar
  (`VanillaTabBarHost`), as Zone Color Changer's does.
- **"Already built" is the game's answer for each unique asset** (`IsPlacedUniqueAsset`),
  asked again on every catalog publish, so a mod that changes that answer, as Anarchy's "place
  multiple unique buildings" does, changes ours (`PlacedUniqueScan`).

## Test record

The most popular code mods, each run in game beside this one, or read from source where it
has no menu touch point. "Ours" is the version of this mod each result was recorded on; a
result can predate later changes, which are in `BetterBuildingMenu/Changelog.json`.

| Mod | Version tested | Ours | Result |
|---|---|---|---|
| Water Features (yenyang) | — | 0.1.8 | Works. Its WaterTool tab and water sources appear under Landscaping; the catch-all processor indexes them. |
| Extra Assets Importer, with ExtraLib (Triton) | — | 0.2.2 | Works. The panel takes over ExtraAssetsMenu: its 13 nested child categories are tabs, in ExtraLib's order, and hold what the game's own lists hold under the toolbar's theme (259 of 328 with the European theme on 2026-09-27, all 13 counts equal). |
| Asset UI Manager (StarQ) | — | 0.1.8 | Works. The panel groups by its runtime categories, with their own icons; the audit reports 0 misplaced. |
| Zone Organizer (Mimonsi) | — | 0.1.8 | Works. Its ten Zones tabs sit in our strip; all 22 zones are listed. |
| Road Builder (TDW) | — | 0.1.8 | Works, including a road created while playing. Removal of the roads it discards is by code reading only. |
| Zone Color Changer (TDW) | — | 0.1.9 | Works. Its button is hosted in the panel's top bar while a zone is armed. |
| Tree Controller (yenyang), Advanced Line Tool (algernon) | 1.7.4, 1.2.3 | 0.1.9 | Work. Their options sit in the tool options bank beside ours, and line mode survives picking a tree here. |
| Anarchy (yenyang) | 1.7.24 | 0.1.10 | Works. Its options sit beside ours, and "place multiple unique buildings" reaches this panel. |
| Asset Icon Library (TDW) | — | 0.1.6 | Works. Tiles draw its icons: 85 of 100 in Landscaping. |
| Extra Landscaping Tools, Extra Detailing Tools (Triton) | — | 0.1.6 | Work. Their tools and props are indexed. |
| Toggle Overlays, Unified Icon Library, I18n Everywhere | — | 0.1.6 | No interaction. |
| Asset Menu Tweaks (Luca) | 1.0.7 | 0.1.5 | No effect on our panel, in either load order and with every option on. |
| Find It (TDW) | 1.5.8 | pre-release | Both install together. Its panel takes the asset-menu slot while open and ours returns when it closes; its picker is the only one. |
| Platter (Luca), Extra Networks and Areas (Mimonsi), Recolor (yenyang) | — | — | Source read only. The first two add or regroup menu entries at load, before our index runs; Recolor's palettes are not toolbar assets. |
| Traffic, Better Bulldozer, Move It, Plop the Growables, 529 Tiles, Historical Start, Skyve, Extended Tooltip, Detailed Descriptions, Region Flag Icons, First Person Camera, Time & Weather Anarchy, Realistic Parking, Traffic Lights Enhancement | — | — | Source read only: no asset-menu or menu-tree hooks. |

### Method

Sources were cloned and grepped for `moduleRegistry.(extend|override|append)`
and Harmony attributes, and for the menu-tree writers `m_Group`, `m_Menu`,
`UIAssetCategoryPrefab` and `AddPrefab`. Subscriber totals from the game's
package cache ranked the survey, since the in-game "Most popular" page could
not be filtered to code mods reliably.
