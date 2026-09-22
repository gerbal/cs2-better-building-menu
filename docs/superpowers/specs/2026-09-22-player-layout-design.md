# Player layout: re-categorising the build panel

Date: 2026-09-22. Ticket: cm-uact.4. Status: design approved in conversation,
spec awaiting review.

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

## 1. Data model and resolution

### File

`ModsData/BetterBuildingMenu/layout.json`:

```json
{
  "version": 1,
  "menus": {
    "<toolbar menu id>": {
      "tabs": [
        { "id": "<category prefab name>" },
        { "id": "<category prefab name>", "name": "Street furniture", "hidden": false },
        { "id": "<category prefab name>", "mergedInto": "<tab id>" },
        { "id": "bbm:4f2a", "name": "Harbour", "icon": "<game icon path>" }
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
  required and `icon` is chosen from the game's own category and service
  icons.
- `tabs` order is the strip order. `name`, `icon`, `hidden` and `mergedInto`
  are optional overrides.
- Anything the file does not mention follows vanilla. An empty or absent file
  is a no-op.

### Resolution

One pure function beside `Domain/MenuPlacementOverride`, applied at the same
index step (`PrefabIndexingSystem`, where `Resolve` is called today):

1. The player's asset entry, if present and valid.
2. Otherwise the game's live placement, then the prefab's own group (today's
   rule).
3. Then follow `mergedInto` to the target tab. Merge cycles are refused when
   edited; if one reaches the resolver, the first tab seen wins.

### Hidden tabs

A hidden tab leaves the strip; its assets stay in the menu, under All, in
search and in grouped headings. The All tab shows a count of hidden entries.
Hiding reduces tabs, never reachability.

### Propagation

- An edit re-resolves only the menu and tab of the entries it touches, in
  the in-memory index, then republishes. No re-index: the existing
  incremental pass is driven by the game's changed-prefab query, and a layout
  edit changes no prefab. The index therefore keeps each entry's unresolved
  placement (live placement and prefab group) so it can be re-resolved.
- The strip builds its tab list from the layout's order, names and icons,
  falling back to vanilla's.
- Group by "Game category" headings use the resolved tab.
- The menu audit learns the layout: moved assets are not "misplaced", and
  coverage numbers stay honest.
- Menu routing (`MenuRouting.ShouldYield`) counts assets moved into a menu,
  so a menu that gains assets only by moves is not handed back to vanilla.

## 2. Edit mode in the panel

### Entering and leaving

- An "Edit layout" toggle in the control pane.
- A bar across the top of the catalog: an editing label, Undo, Select all
  shown, Move to…, Done.
- In edit mode a tile click never arms the build tool.
- Edits save as they happen. Done, closing the panel, or Escape leaves edit
  mode and loses nothing. Escape keeps its rule of closing the panel
  unconditionally (`docs/design-notes.md`).

### Selecting

- Click toggles a tile's selection (check mark). Shift-click selects a range
  in display order.
- Select all shown selects everything the current search, filters and tab
  show. This is the bulk tool: filter by pack, or search a word, then select
  all. It writes plain per-asset entries.

### Moving

- Drag the selection onto a strip tab: the tab highlights, dropping moves the
  selection. Within the current menu.
- Move to…: a two-step picker, menu then tab, with "New tab…" at the end of
  each tab list. Across menus.
- After a move, a notice says what moved where, with Undo. Moved tiles leave
  the current view.

### Tabs

Clicking a tab in edit mode opens a popover:

- Rename (text field); vanilla tabs also get "Restore name".
- Icon, from the game's own icons.
- Hide / Show.
- Merge into… (this menu's other tabs).
- Delete, player-made tabs only; their assets return to vanilla homes.

Tabs reorder by dragging within the strip. A "+" at the end of the strip
creates a tab in this menu. Hidden tabs show dimmed in edit mode.

### Empty player-made tabs

Shown in edit mode as drop targets; hidden in play mode.

### Undo

Session-only stack of layout snapshots, used by the edit bar and the move
notice. The stored file stays declarative.

## 3. Options

A "Layout" group on the mod's Options page, using only the game's settings
controls:

- **Use my layout**: toggle; off shows vanilla's organisation exactly, file
  untouched.
- **Summary**: read-only, e.g. "3 menus changed, 12 tabs edited, 148 assets
  moved", plus "N entries for assets not loaded" and file problems.
- **Reset one menu**: dropdown of changed menus, button, confirmation.
- **Reset everything**: button, confirmation; the current file is backed up
  first.
- **Export**: writes `exports/layout-<date>.json` in the mod data folder; the
  description shows the path.
- **Import**: dropdown of files in `imports/`, button, confirmation. Replaces
  the current layout after a backup. No merge.

Options does not move assets or edit tabs. "Open folder" buttons are left out
until opening a system folder is verified under Proton.

## 4. Reconciliation and errors

### The world changes

- **Asset not loaded** (pack unsubscribed): entry kept, counted in the
  summary, exported.
- **Vanilla tab gone**: entry dormant; its assets fall back to vanilla homes;
  recovers if the tab returns.
- **New vanilla tab** (DLC): appended after the player's ordered tabs.
- **Player-made tab emptied**: kept; drop target in edit mode, hidden in play.

### Move limits

Move to… offers only targets whose menu draws the same kind of catalog:

- Buildings and props: any building or prop menu.
- Networks: network menus.
- Zones: Zones only (it draws its own zoning surface).

Refused targets show greyed with the reason. Upgrades (building extensions)
are in no menu and are not movable.

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

## 5. Testing

Tests first; watch each fail before writing the code.

### C# unit (Domain)

- Resolution precedence: override, then live placement, then prefab group.
- Merge following; cycle refused at edit, guarded at resolve.
- Hidden tabs keep assets reachable; dormant tabs fall back; new vanilla tabs
  append; missing assets keep entries; moves outside kind refused.
- File: round trip, version handling, unreadable file set aside and not
  overwritten, temporary-file-then-rename write.
- Audit: moved assets not misplaced; coverage totals hold.

### TypeScript unit

- Strip order, names and icons from the layout.
- All tab's hidden count.
- Empty player-made tabs hidden in play mode.
- Edit-mode state and undo stack.

### Render

- Edit bar and selection marks.
- Tab popover.
- Move to… picker with refused targets greyed and explained.
- A tile click in edit mode never arms the tool.

### Live (QA bridge)

- Drag from catalog onto a strip tab in Cohtml.
- Keyboard focus in the rename field.
- One building, one prop, one network moved, then placed from the new menu.
- Use my layout off and on.
- Layout survives a restart.
- Bulk move of 500 assets: re-resolve and republish time.
- A pass needs a DOM probe and a screenshot.

## Out of scope

- Changing the game's own menu data or the stock icon row.
- Rules, tags, favourites, kits, recents (see the prior-art doc; separate
  features).
- Merging imported layouts into an existing one.
- New toolbar menus.

## Open risks

- Drag and drop between catalog and strip in Cohtml (resize drag works; drop
  targets are untested).
- Text focus in popovers without the game capturing keys.
- Placing a moved asset from a menu whose tool options differ.
- The first per-asset state the mod keeps: support and migration cost.
