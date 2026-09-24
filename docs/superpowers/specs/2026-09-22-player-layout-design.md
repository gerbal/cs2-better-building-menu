# Player layout: re-categorising the build panel

Date: 2026-09-22. Ticket: cm-uact.4. Status: design approved in conversation;
revised after critical review (same day); awaiting owner review.

## Goal

Let players re-categorise the panel, as asked on the forum ("allow for
re-categorization of entries to reduce tab clutter"). Four operations, all
in scope:

1. Move an asset to another tab in the same menu.
2. Move an asset to a tab in another menu.
3. Create new tabs.
4. Edit existing tabs: rename, reorder, merge, hide.

Background and prior art: `docs/customisation-prior-art.md`.

## Constraints and decisions

- Planning assumes this mod is the only one altering the build menu.
- Changes apply to **our panel only**. The game's menu data is never
  modified; turning the panel or the layout off shows vanilla exactly. The
  stock icon row ignores the layout.
- Editing happens in an **edit mode in the panel**. Whole-layout actions
  (switch, reset, export, import) live in **Options**.
- The layout is a **declarative overlay**: the stored end state, not a log of
  edits and not rules.
- Stored **once per install**, in the mod's data folder
  (`ModsData/BetterBuildingMenu`). Nothing goes into save files, which keeps
  the store description's promise.

## Slices

Built and shipped in this order; each slice is usable on its own.

1. **Layout core.** File, resolution, propagation, the Options switch, reset
   and summary. The file can be edited by hand, so the whole feature set is
   reachable for enthusiasts from slice 1.
2. **Tab editing** in the strip: rename, icon, hide, merge, unmerge, reorder,
   new tab, delete. The most direct answer to "tab clutter".
3. **Asset moves** in edit mode: selection, drag to tab, Move to…, undo.
   Starts with the arming spike (section 4, Move limits).
4. **Export and import.**

## 1. Data model and resolution (slice 1)

### File

`ModsData/BetterBuildingMenu/layout.json`:

```json
{
  "version": 1,
  "menus": {
    "<toolbar menu id>": {
      "tabs": [
        { "id": "<category prefab name>" },
        { "id": "<category prefab name>", "name": "Street furniture", "hidden": true },
        { "id": "<category prefab name>", "mergedInto": "<tab id>" },
        { "id": "bbm:4f2a", "name": "Harbour", "icon": "<icon path>" }
      ]
    }
  },
  "assets": {
    "<prefab name>": { "menu": "<toolbar menu id>", "tab": "<tab id>" }
  }
}
```

- A vanilla tab's id is its category prefab name, the id the strip and
  `BuildingCatalogEntry.UiCategory` already use.
- A player-made tab's id is `bbm:` plus a short generated id; `name` is
  required.
- `name`, `icon`, `hidden` and `mergedInto` are optional overrides.
- **Order.** Tabs listed in `tabs` come first, in the listed order. Vanilla
  tabs the list does not name follow, in vanilla's priority order. One rule
  covers partial lists and tabs a DLC adds later.
- Anything the file does not mention follows vanilla. An empty or absent file
  is a no-op.

### Icons

The icon picker offers the icons the index already holds: every vanilla
menu's and category's icon. An `icon` that no longer resolves after a game
update falls back to the menu's own icon.

### Resolution

One pure function beside `Domain/MenuPlacementOverride`, applied at the same
index step (`PrefabIndexingSystem`, where `Resolve` is called today):

1. The player's asset entry, if present and valid.
2. Otherwise the game's live placement, then the prefab's own group (today's
   rule).
3. Then follow `mergedInto` to the target tab.

Merges never chain: merging A into B when B is merged into C writes A into C,
and merging B later rewrites every tab merged into B. The resolver still
guards a hand-edited cycle: the first tab seen wins.

The index keeps each entry's **unresolved** placement (live placement and
prefab group) beside the resolved one, so an edit can re-resolve without
re-indexing, and so vanilla's own answer is always at hand (yielding, audit).

### The Roads gathering

Our Roads menu gathers every network in addition to its own menu
(`Domain/NetworkMenuExtension`); none leaves its own menu. An override moves
the asset's **home**, the menu the game would file it under. The gathering
is a second appearance and is unaffected, with one exception: an override
whose menu is Roads replaces the gathered appearance, so the network shows
once, in the player's tab.

### Hidden and merged tabs

- A hidden tab leaves the strip; its assets stay in the menu, under All, in
  search and in grouped headings. The All tab shows a count of hidden
  entries. Hiding reduces tabs, never reachability.
- A merged tab leaves the strip; its assets show under the target tab.

### Propagation

- An edit re-resolves only the menu and tab of the entries it touches, in
  the in-memory index, then republishes. No re-index: the existing
  incremental pass is driven by the game's changed-prefab query, and a layout
  edit changes no prefab.
- The strip builds its tab list from the layout's order, names and icons,
  falling back to vanilla's.
- Group by "Game category" headings use the resolved tab.
- The menu audit compares against the unresolved placement and learns the
  layout: moved assets are not "misplaced", and coverage numbers stay
  honest.
- **Yielding.** `MenuRouting.ShouldYield` decides from the **unresolved**
  placement: a menu the game files assets under is never handed back to the
  vanilla grid, even when every asset has moved out. Otherwise the vanilla
  grid would show the moved assets in their old place. A menu left empty by
  moves shows an empty state: "Everything in this menu has moved. Edit
  layout", with the count. A menu that has assets only because of moves is
  not yielded either.
- **Sub-tabs.** Density tiers and development-tree branches are computed
  after resolution, from the menu's resolved entries, as today. A move or
  merge can therefore change which category expands; that is accepted. A
  sub-tab row must still cover its category: when moved-in entries lack the
  row's value (no tier, no branch), the row gains an "Other" sub-tab for
  them.
- **Where tab editing applies.** Tab edits apply where the strip shows the
  game's categories. Menus whose strip is drawn from another axis
  (Education's school tiers, the development-tree axis when a menu has no
  categories) accept moved assets but offer no tab editing.

## 2. Edit mode in the panel (slices 2 and 3)

### Ownership

C# owns all state: the layout, edit mode, the selection, the undo stack and
the last notice. The UI renders bindings and sends triggers. Contract (names
indicative):

- Bindings: `LayoutEditMode`, `LayoutSelectionCount`, `LayoutSelectedOnPage`
  (ids on the current page), `LayoutCanUndo`, `LayoutNotice`, and per-tab
  `hidden` / `mergedInto` / `custom` flags on the existing strip categories.
- Triggers: `SetLayoutEditMode(bool)`, `ToggleSelect(id)`,
  `SelectRangeTo(id)`, `SelectAllShown()`, `ClearSelection()`,
  `MoveSelection(menu, tab)`, `CreateTab(menu, name, icon)`,
  `RenameTab(menu, tab, name)`, `RestoreTabName(menu, tab)`,
  `SetTabIcon(menu, tab, icon)`, `SetTabHidden(menu, tab, bool)`,
  `MergeTab(menu, tab, into)`, `UnmergeTab(menu, tab)`,
  `DeleteTab(menu, tab)`, `MoveTab(menu, tab, index)`, `UndoLayout()`.

### Entering and leaving

- An "Edit layout" toggle in the control pane.
- A bar across the top of the catalog: an editing label, Undo, Select all
  shown, Move to…, Done. (Slice 2 shows only the label, Undo and Done.)
- In edit mode a tile click never arms the build tool.
- Edits save as they happen. Done, closing the panel, or Escape leaves edit
  mode and loses nothing. Escape keeps its rule of closing the panel
  unconditionally (`docs/design-notes.md`).

### Selecting (slice 3)

- Selection is a set of prefab ids held in C#, not a property of rendered
  tiles: the catalog is paged.
- Click toggles a tile's selection (check mark). Shift-click selects the
  range between the last clicked tile and this one, in the **query's**
  order, across pages.
- Select all shown selects the **whole query result**, every page: filter by
  pack or search a word, then select all. It writes plain per-asset entries.
- The selection clears when the menu changes or edit mode ends.

### Moving (slice 3)

- Drag the selection onto a strip tab: the tab highlights, dropping moves the
  selection. Within the current menu.
- Move to…: a two-step picker, menu then tab, with "New tab…" at the end of
  each tab list. Across menus. Hidden tabs are offered (moving into one is
  legitimate); merged tabs are not, since their assets show elsewhere.
- After a move, a notice says what moved where, with Undo. Moved tiles leave
  the current view.

### Tabs (slice 2)

Clicking a tab in edit mode opens a popover:

- Rename (text field); vanilla tabs also get "Restore name". The name saves
  on Enter and when the field loses focus; closing the panel with a rename
  in progress saves it first, so Escape never discards typing.
- Icon, from the icons described in section 1.
- Hide / Show.
- Merge into…: this menu's other tabs, excluding hidden and merged ones.
- Unmerge, on a merged tab.
- Delete, player-made tabs only; their assets return to their vanilla homes.

In edit mode, hidden **and merged** tabs show dimmed in the strip (a merged
tab labelled with its target), so both stay reachable and reversible after
the session. Tabs reorder by dragging within the strip. A "+" at the end of
the strip creates a tab in this menu.

### Empty player-made tabs

Shown in edit mode as drop targets; hidden in play mode.

### Undo

Session-only stack of layout snapshots, in C#, used by the edit bar and the
move notice. The stored file stays declarative.

## 3. Options (slices 1 and 4)

A "Layout" group on the mod's Options page, using only the game's settings
controls:

- **Use my layout** (slice 1): toggle; off shows vanilla's organisation
  exactly, file untouched.
- **Summary** (slice 1): e.g. "3 menus changed, 12 tabs edited, 148 assets
  moved", plus "N entries for assets not loaded" and file problems. Whether
  the settings screen can show text that changes at runtime is unverified;
  slice 1 checks it first. If it cannot, the summary moves to the edit bar
  and the log, and Options shows a static description.
- **Reset one menu** (slice 1): dropdown of changed menus, button,
  confirmation. Resets that menu's tab edits and every asset entry whose
  **destination** is that menu. Assets moved out of it belong to their
  destination and are reset there. The confirmation says so: "Resets Parks'
  tabs and the 14 assets moved into it."
- **Reset everything** (slice 1): button, confirmation; the current file is
  backed up first.
- **Export** (slice 4): writes `exports/layout-<date>.json` in the mod data
  folder; the description shows the path.
- **Import** (slice 4): dropdown of files in `imports/`, button,
  confirmation. Replaces the current layout after a backup. No merge.

Options does not move assets or edit tabs. "Open folder" buttons are left out
until opening a system folder is verified under Proton.

## 4. Reconciliation and errors

### The world changes

- **Asset not loaded** (pack unsubscribed): entry kept, counted in the
  summary, exported.
- **Vanilla tab gone**: entry dormant; its assets fall back to vanilla homes;
  recovers if the tab returns.
- **New vanilla tab** (DLC): placed by the order rule in section 1.
- **Player-made tab emptied**: kept; drop target in edit mode, hidden in play.

### Move limits

An asset's **kind** comes from what the index already records: network, zone,
area, or placeable object (buildings, props, trees and the rest). Move to…
offers a menu only if the game already files at least one asset of the same
kind there. The rule follows the data rather than a hand-written table, so
Landscaping, which mixes props, trees, surfaces and terraforming, sorts
itself out. Refused menus show greyed with the reason. Upgrades (building
extensions) are in no menu and are not movable.

**Arming spike, first in slice 3.** Networks already arm from Roads when the
game files them elsewhere, so that path works. Whether arming a building or
prop from a menu that is not its home makes the game's toolbar jump to the
home menu is unverified; probe it live before building moves. If it jumps,
cross-menu moves are limited to networks until a fix is found.

### File failures

- **Unreadable**: logged, renamed aside, vanilla used; the summary says so.
  Never overwrite a file that could not be parsed.
- **Newer version**: applied as far as understood, never written back; the
  summary says why.
- **Writes**: to a temporary file, then renamed over the old one.

### Names

- Player names are stored exactly as typed, not translated.
- A renamed vanilla tab keeps the player's name in every language; "Restore
  name" returns the game's name in the current language.

### Timing

- The layout loads before the first full index.
- Edits re-resolve only the entries they touch; no re-index.
- Toggling Use my layout re-resolves every entry in one pass, no re-index.

### Known limitation

The game's unlock notices on toolbar buttons keep pointing at an asset's
vanilla menu after it has moved. Accepted: the notice belongs to the game's
toolbar, which the layout does not change.

## 5. Testing

Tests first; watch each fail before writing the code.

### C# unit (Domain)

- Resolution precedence: override, then live placement, then prefab group.
- Merges: flattened at edit; hand-edited cycle guarded at resolve.
- Tab order: listed first, unlisted vanilla by priority, new DLC tab placed.
- Roads gathering: override elsewhere keeps the gathered appearance; override
  into Roads replaces it.
- Yielding decided from unresolved placement; emptied menu not yielded.
- Sub-tab rows gain "Other" when moved-in entries lack the value.
- Kind rule: target menu must hold the kind; greyed reasons.
- Selection: range and select-all over the whole query, across pages.
- Reset one menu: destination rule.
- Hidden tabs keep assets reachable; dormant tabs fall back; missing assets
  keep entries.
- File: round trip, version handling, unreadable file set aside and not
  overwritten, temporary-file-then-rename write, icon fallback.
- Audit: moved assets not misplaced; coverage totals hold.

### TypeScript unit

- Strip order, names and icons from the bindings.
- All tab's hidden count.
- Empty player-made tabs hidden in play mode; hidden and merged tabs dimmed in
  edit mode.

### Render

- Edit bar and selection marks.
- Tab popover, including Unmerge and the merge list's exclusions.
- Move to… picker with refused menus greyed and explained.
- The emptied-menu state.
- A tile click in edit mode never arms the tool.

### Live (QA bridge)

- Slice 1: runtime summary text in Options.
- Slice 2: text focus in the rename field; Escape during a rename keeps it;
  drag to reorder tabs.
- Slice 3: the arming spike; drag from catalog onto a strip tab; one
  building, one prop, one network moved, then placed from the new menu.
- Use my layout off and on; layout survives a restart.
- Bulk move of 500 assets: re-resolve and republish time.
- A pass needs a DOM probe and a screenshot.

## Out of scope

- Changing the game's own menu data or the stock icon row.
- Rules, tags, favourites, kits, recents (see the prior-art doc; separate
  features).
- Merging imported layouts into an existing one.
- New toolbar menus.
- Per-playset layouts.

## Open risks

- Arming a building from a foreign menu (spiked first in slice 3).
- Drag and drop between catalog and strip in Cohtml (resize drag works; drop
  targets are untested).
- Runtime text on the Options screen.
- The first per-asset state the mod keeps: support and migration cost.
