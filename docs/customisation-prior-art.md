# Player customisation of the build catalogue: prior art and ideation

Research for cm-uact.4 (Loki's re-categorisation request), 2026-09-22.
Gathered by three research passes over the web and three cloned mod repos.
Claims are the sources' own; items the passes could not confirm are marked
[unverified]. Planning assumption: this mod is the only one altering the
build menu, so other menu mods appear here as design references only.

## Games and mods

| Product | What the player can change | State | Lesson |
|---|---|---|---|
| Find It (CS2, T.D.W.) | Favourite as a category; sorts MostUsed (per city, recounted each minute), LastUsed (lost on restart); class hides (vanilla, randoms, ads); Picker (Ctrl+P). Tags in the schema, search commented out. | `ModsData/FindIt/CustomPrefabData.json`, keyed by prefab name, global. | Favourites keyed by prefab name, per install. https://github.com/JadHajjar/FindIt-CSII |
| Find It! 2 (CS1) | Custom tags with add, rename, merge, delete, batch add/remove; With/Without tag filters; creator `#tags`; creator-hidden dependency assets (opt-in); Unused assets list; search tabs. | `FindItCustomTags.xml`, path shown in Options. | Tags only work with bulk operations and a visible file. https://github.com/sway2020/FindIt2 |
| Asset UI Manager (CS2) | Checkbox rules: move tab X to menu Y, split schools by level, parks by size, bridges into own tab. | Mod settings. | Curated rules give most of re-categorisation with no editor. https://github.com/qstar-inc/cities2-AssetUIManager |
| Picker (CS1) | Pipette opens the clicked object's own menu and selects it; recently built list (v4). | none | A pipette teaches where things live. https://steamcommunity.com/sharedfiles/filedetails/?id=2172488844 |
| Workers & Resources | Right-click a mod to favourite it; favourited mods' buildings join the normal menus; none / all / favourites switch. | settings | Opt-in promotion of added content cuts clutter at the source. https://steamcommunity.com/app/784150/discussions/6/2953789422400583855/ |
| Planet Coaster 1 / 2 | PC1: custom tags, one item at a time (top complaint). PC2: tags removed (backlash); favourites filter lost after restart until patch 1.4.1. | profile | Losing favourites destroys trust; removing tags angers the few who used them. https://www.planetcoaster.com/updates/1-4-1 |
| Sims 4 + Better BuildBuy | Middle-click favourite; un-favourited items stay until the view is left; Hide Maxis. | mod data | Lists must not reflow under the cursor. https://thesimstree.com/en/blog/the-sims-tips/better-buildbuy-mod-guide.html |
| Factorio | Quickbar of links, 10 pages by activity; ghost slots; blueprint pins; Q pipette. | per player | "Full control of the quickbar instead of the game trying to be smart" (FFF #278). https://direct.factorio.com/blog/post/fff-278 |
| Satisfactory | 10 hotbars; hover in the build menu and press a digit to bind; middle-click copy. | save | Binding from the catalogue itself is the cheap gesture. https://satisfactory.wiki.gg/wiki/Build_Gun |
| Minecraft creative | 9 saved hotbars, global across worlds. | `hotbar.nbt` | Working sets outlive a single world. https://minecraft.wiki/w/Saved_Hotbars |
| Space Engineers | Category tree + search feeding 9x9 toolbars; variants cycled by scroll. | per game; plugin adds save/load | Players want toolbars portable across worlds. https://spaceengineers.wiki.gg/wiki/Toolbar_Configuration |
| Anno 1800 mods | Building-menu Customizer: drag to reorder items and tabs, generates a mod. | generated mod | Full editing ended up in an external tool. https://www.nexusmods.com/anno1800/mods/652 [snippet] |
| Timberborn mods | Tool groups framework, same tool in several places; a curated layout on top. | mod | Framework plus curated preset. https://mod.io/g/timberborn/m/moddable-tool-groups [snippet] |
| CS2 vanilla 1.5.9f1 | Filter by Region Pack and asset mod in the build menu. | none | The game already treats source as a filter axis. |

## Creative tools

| Tool | Model | Lesson |
|---|---|---|
| Blender Asset Browser | Catalogs: one per asset, a tree independent of storage, keyed by UUID with a readable fallback name; tags for search. Dynamic catalogs planned, not shipped [unverified]. | Browse tree separate from storage; stable ids with a human fallback. https://code.blender.org/2021/06/asset-browser-workshop-outcomes/ |
| Unreal Content Browser | Folders plus Collections (references, many per asset; local/private/shared); dynamic collections shipped with an empty-results bug (UE-35869). | Collections reference, never move; a saved view must re-run its query. https://dev.epicgames.com/documentation/en-us/unreal-engine/filters-and-collections-in-unreal-engine |
| Unity | Labels; Favorites section holding items and saved searches; user vs project scope. | Saved searches sit beside favourites. https://docs.unity3d.com/6000.3/Documentation/Manual/search-manage-queries.html |
| Lightroom Classic | Folders mirror disk; collections as playlists; smart collections by rule. | Rule views are loved; hand filing is the chore. https://jkost.com/blog/2024/06/organizing-photos-using-collections-in-lightroom-classic.html |
| AutoCAD | DesignCenter browser; tool palettes; palette groups "limit the number of palettes displayed"; `.xtp` exports store paths and break. | Groups of tabs as workspaces; export by id, not path. https://help.autodesk.com/cloudhelp/2019/ENU/AutoCAD-Core/files/GUID-F31F2A7E-A346-4923-B662-7DE4AA695802.htm |
| Maya, Houdini | Shelves as files on a search path; studio vs personal; Houdini tool "Tab submenu path" is free text that creates the submenu. | Personal layer over a shared layer. https://www.sidefx.com/docs/houdini/shelf/customize.html |
| Figma, Sketch | Hierarchy from slash names, authored by the library owner; UI3 hid it by default and drew complaints. | Don't hide an organising view by default. |
| Finder tags | 56% never use them (TidBITS poll 2023). | Free tags go unused. https://tidbits.com/2023/11/10/do-you-use-it-finder-tags-see-focused-use/ |

## Research

- Static beats reordering: Mitchell & Shneiderman 1989 (81% preferred static); Findlater & McGrenere CHI 2004 (adaptive slowest; adaptable preferred, as fast as static once learned); Cockburn, Gutwin & Greenberg CHI 2007 (reordering sends experts back to visual search).
- Safe adaptation copies or emphasises, never moves: Sears & Shneiderman TOCHI 1994 (split menus); Gajos et al. AVI 2006 (copying frequent items preferred); Findlater et al. CHI 2009 (ephemeral adaptation).
- Personal layer plus a one-click full view: McGrenere, Baecker & Booth CHI 2002 / TOCHI 2007.
- Personalisation hides the unused: Findlater & McGrenere IJHCS 2010 (lower feature awareness).
- Few customise, and only when trivial: Mackay CHI 1991 (triggers: after a change, noticing a repeated pattern; experts share setups); Page et al. CHI 1996.
- Filing seldom pays back: Whittaker et al. CHI 2011 (complex folders did not improve refinding; scrolling most common); Bergman et al. JASIST 2013 (folders preferred to tags); Civan et al. 2008 (schemes must be reorganisable).
- Navigation over search: Bergman et al. TOIS 2008 (56-68% navigate); Teevan et al. CHI 2004 (orienteering).
- Facets fit many-axis items: Ranganathan; Yee et al. CHI 2003.
- Reminding is a job of arrangement: Malone TOIS 1983; Barreau & Nardi 1995 (ephemeral, working, archived).
- Categories are prototype-based and purposive: Rosch 1976; Lakoff 1987 [unverified this session].
- Vocabulary varies: Furnas et al. CACM 1987 [unverified].

## What the prior art agrees on

- **Two layers.** Mature tools leave the shipped structure alone and lay a
  personal layer of references over it (Blender catalogs keyed by UUID with a
  readable fallback, Unreal and Lightroom collections). Products that let
  players rewrite the tree pushed it into an external tool (Anno) or fixed
  rules (Asset UI Manager).
- **The favourite is the floor.** Its failure mode is persistence (Planet
  Coaster 2, Planet Zoo). Un-starring inside the favourites view marks the item
  and removes it only when the view is left (Better BuildBuy).
- **Tags serve a few.** They need bulk operations and a visible file (Find It!
  2); one-at-a-time tagging was Planet Coaster 1's top complaint, removing tags
  was Planet Coaster 2's backlash; most people never tag.
- **Games converge on the working set.** Pinned links bound from the catalogue
  with one gesture, portable across worlds, never guessed (Factorio,
  Satisfactory, Minecraft, Space Engineers).
- **The pipette** is a working set with no authoring, and teaches where things
  live (Picker).
- **Clutter comes in with added content.** Workers & Resources admits a mod's
  buildings into the normal menus only when the player favourites the mod.
- **Research limits:** never reposition automatically; adapt by copying or
  brief emphasis; always keep a one-click full view; hiding costs discovery;
  few customise, and only when it is trivial and on the object.

## Reframe

Loki asked to rebuild the shelf. The prior art says leave the shelf and build
a workbench.

- **Shelf:** vanilla's menus and tabs. Stable, shared, what spatial memory is
  built on. Untouched.
- **Catalogue:** search, the Content filter, Group by. Already strong.
- **Workbench:** what this player uses for this build. Missing, and where the
  round trips hurt.

## Idea space

1. **Star.** Star on the tile; a Starred tab leading each menu's strip; a
   cross-menu Starred view in unscoped search. Per install, keyed by prefab
   name; no reflow until the view is left. (Find It, Better BuildBuy)
2. **Recent row.** Last few placements, duplicated; originals stay put.
   (Sears & Shneiderman, Gajos, Picker 4)
3. **Placed in this city.** Filter or sort from the live city; reads the save,
   never writes it. (Find It most-used)
4. **Pipette into the panel.** Pick a placed object; the panel opens at its
   home tab with the tile armed and highlighted. (Picker)
5. **Kits.** Named, many-per-asset, cross-menu sets added from the tile, opened
   as a strip tab; optionally a number-key hotbar. References, not moves.
   (Unreal collections, Factorio, Minecraft)
6. **Saved views.** Current search, filters and grouping saved as a tab and
   re-run on open. Near free: the query state exists. (Lightroom smart
   collections, Unity saved searches; avoid UE-35869's stale results)
7. **Tab visibility.** Hide tabs per menu; hidden entries stay under All with a
   count; one click shows everything. (AutoCAD palette groups, McGrenere)
8. **Admit packs.** Per-pack switch: in the tabs, or only in search and the
   Content filter. (Workers & Resources)
9. **Shipped layouts.** A few alternative layouts as options (schools by level,
   parks by size, bridges on their own tab) instead of an editor. (Asset UI
   Manager, Timberborn curated layout)
10. **Re-home.** Loki's literal ask: a single-home override keyed by prefab
    name, vanilla fallback. Weakest evidence, highest cost. (Blender catalogs)
11. **Brief emphasis.** Highlight likely tiles instead of moving them.
    (Findlater, ephemeral adaptation)
12. **Tags.** Only with bulk operations and a visible file, or not at all;
    Kits cover the need with less upkeep.

Sharing cuts across all of them: one plain export file keyed by prefab name,
missing assets skipped quietly.

## Tensions

- **Per install or per city.** Stars, kits and layouts are the player's; placed
  in this city is the city's, read only. Both keep the store promise that
  nothing is saved to the city.
- **Gesture.** Right-click cancels the tool in CS2; the star's gesture needs a
  live test. A hover button on the tile is the safe default.
- **Discovery.** Ideas 7 and 8 hide things; each needs a count and a way back.
- **Scope.** Most players will use Star and Recent; a few will build Kits.

## Emerging shape (not decided)

Shelf untouched. Workbench first: Star, Recent, Pipette. Then Kits and saved
views. Tab hiding and pack admission as the direct answer to clutter, with a
count and a way back. Re-home and tags last, if ever.
