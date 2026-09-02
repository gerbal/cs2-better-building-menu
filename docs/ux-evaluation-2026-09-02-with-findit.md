# UI/UX evaluation — the building lens beside upstream Find It

Date: 2026-09-02
Build: worktree `findit-remediation` at `60b0d20` (coexistence commit), deployed
to prefix `949230-c` with upstream Find It 1.5.8 (pdx `77240_58`) copied into
the same Mods folder. Porterville 3, game 1.6.0f1, UI canvas 1280×720.
Every finding here is **[LIVE]**: read from the running game's DOM through the
QA bridge and captured from the Gameface page. Screenshots are UI-only (the
3D scene is black in them); they sit in `ux-evaluation-2026-09-02/`.

This is an evaluation, not a work order. The user's steer stands: the lens UI
is good enough for now. The findings are ranked so the ones that would earn a
change first are at the top.

## Method

The game was driven from the bridge (`toolbar.selectAssetMenu`, our
`SearchChanged` / `ClearBuildingLensMenuScope`, upstream's
`FindItIconToggled` / `FindItCloseToggled` / `PickerIconToggled` /
`SearchChanged`), tiles and buttons were clicked through their React handlers,
and after each state the bindings were read, the DOM measured, and a frame
captured. The simulation was paused first so the city did not change under the
shots.

| # | State | Screenshot |
|---|---|---|
| 1 | Idle, nothing selected | `01-idle.jpg` |
| 2 | Roads open in our lens (403 assets) | `02-roads-lens.jpg` |
| 3 | Our search `tre` inside Roads (28) | `03-roads-search-tre.jpg` |
| 4 | Same, Table view | `04-roads-search-table.jpg` |
| 5 | Upstream panel alone (24,814 items) | `05-upstream-panel.jpg` |
| 6 | Upstream search `hospital`, 3 s after typing | `06-upstream-search-hospital.jpg` |
| 7 | Upstream panel opened over our Roads lens | `07-upstream-over-ours.jpg` |
| 8 | Upstream panel closed again | `08-after-upstream-close.jpg` |
| 9 | Upstream picker armed | `09-picker.jpg` |
| 10 | Alley armed from our lens | `10-road-armed.jpg` |
| 11 | Our "All menus" scope (10,539) | `11-ours-everything.jpg` |

## Coexistence: what the player sees with both mods

**The two mods do not collide.** Every state below was checked against the
bindings as well as the frame.

- **One toolbar, no duplicate magnifier.** The right cluster holds upstream's
  picker (x 1186) and magnifier (x 1217) next to the vanilla photo-mode button;
  our toolbar icon is absent because `FindItPresent` read true. Shot 1.
- **Upstream's panel takes precedence and hands back cleanly.** Opening it over
  our Roads lens unmounts our panel and control pane entirely (no element left
  in the DOM); closing it remounts ours at the identical rectangle
  (panel 264,327 727×309; pane 995,485 253×151). The toolbar's Roads selection
  and our `BuildingLensMenu` survive the round trip. Shots 7 and 8.
- **Upstream's picker closes our lens.** Arming the picker clears the toolbar's
  asset selection, so `BuildingLensMenu` reads empty and our panel is gone;
  upstream's filter bar takes the tool-options slot at (145,604). This is the
  same thing vanilla does when a tool is picked; nothing of ours is left behind.
  Shot 9.
- **Arming a road from our lens works beside upstream.** Clicking Alley armed
  the Net Tool (`activePrefab: Alley`) and the vanilla tool options appeared at
  (7,472 253×164), left of the panel, with no overlap on our pane. Shot 10.
- **Mixed signal while upstream is open [minor].** With upstream's panel over
  our lens the toolbar still highlights Roads (shot 7, x 553) while the panel
  lists hospitals from every menu. That highlight is vanilla's and upstream's
  choice, not ours, but a player will read it as "Roads is open".

Two things in the screenshots are upstream's, not ours, and are recorded so
nobody chases them here:

- Upstream's category row is blank rectangles (shots 5–7). Its icons come from
  the Unified Icon Library mod, which is not installed on this prefix; the 48
  failed `coui://uil/...` requests in Player.log are that.
- Upstream's search was still showing the unfiltered list 3 s after `hospital`
  was submitted (shot 6, "24,814 items"); the result was correct the next time
  the panel opened (shot 7, "12 items").

## Findings on our lens, ranked

### 1. Search results: nested group headers collide  [high]

Shot 3. Searching `tre` inside Roads groups the 28 hits by category, and the
second-level headers are laid out inline with the first: "SMALL ROADS 2" sits
on one row, then "CUL-DE-SACS 3" shares its row with sub-headers "Cul De Sacs 1"
and "Roundabouts 2", and the next header is clipped to "ROAD SER… 1". The band
reads as two overlapping rows and the counts at the right edge no longer line
up with the header they belong to. This is the state a player reaches most
(type, look), so it outranks everything below.

### 2. Strip tabs wrap into rows of tiny icon-only targets  [high]

Shot 2 and shot 11. Roads publishes 21 strip tabs, so the strip wraps to two
rows (y 289 and 311) above the first group header. "All menus" publishes about
70 and the strip becomes four rows (y 240–311); the panel grows upward from
327 to 219 to fit. Each tab is a ~22 px icon with an 8 px count badge and no
label, so at this density the row is a wall of thumbnails whose counts overlap
their icons. The Roads case is usable; the "All menus" case is not a strip any
more, it is a second catalog.

### 3. Chirps are hidden behind the control pane  [medium]

Shot 8. The chirper popup appears at (1005–1228, 495–558); the control pane
occupies (995–1248, 485–636). While the lens is open a chirp shows only its top
~10 px above the pane and its click target is under it. The measurement
matches what the open-beads pass recorded (`cm-2xvs.12`); this run confirms it
is the pane, not the popup, that wins the stacking.

### 4. "All menus" keeps the toolbar's menu highlighted  [medium]

Shot 11. After Search everything, `BuildingLensMenu` is empty, the pane's chip
says "All menus", the catalog holds 10,539 assets, yet `toolbar.selectedAssetMenu`
is still Roads and the toolbar highlights it. The lens says one thing and the
toolbar another. The Net Tool armed from Roads (Alley) also stayed active
across the scope change, which is fine on its own but adds to the sense that
the player is "in Roads".

### 5. A group header that repeats itself  [medium]

Shots 2, 8, 10. "MEDIUM ROADS" is followed by a subtitle line "Medium Roads",
with "15" and "12" stacked at the right. The subtitle is the sub-group's name
when it equals the group's; it should be dropped when it repeats, and the two
counts need a label or one of them needs to go.

### 6. Tile names break in the middle of a word  [medium]

Shots 2, 3. Tiles are 67×53 with a 30 px thumbnail and two name lines
(`tileNameLine`); long names are split then clipped, producing "One-Way Al…",
"Two-Lane Perpen…q …", "Four-Lane Asymme…c…". The DOM reports no overflow
(`scrollWidth == clientWidth`) because the clipping happens in the split
itself, so this will not show up in a truncation probe. The name is the only
text on a tile, so a fragment like "Perpen…q …" costs the player the one thing
the tile is for.

### 7. The control pane's controls are under the size a mouse wants  [medium]

Measured: pane row labels 10.7 px; the four view-mode buttons 15 px tall with
12 px labels; the "Reset menu" link 8 px in a 48×13 hit box (1192,616). The
view-mode buttons carry a 16 px `<img>` that draws nothing visible in any
frame, so they read as four text stubs. The pane itself sits flush against the
right-menu column (its right edge is the column's left edge at x 1248).

### 8. Table view shows columns the scope cannot fill  [low]

Shot 4. In Roads the table offers Cost, Upkeep, Workers, Capacity, Lot, Level,
Parking; for roads four of those are dashes on every row. Rows are ~62 px so
three fit in the 309 px panel, and the header row is set at about 8 px. The
table earns its place for buildings; for networks it is mostly empty cells.

## Player journeys walked

| Journey | Result |
|---|---|
| Open Roads, scan, arm a road, place | Works. Panel and tool options do not overlap; the armed tile is highlighted. |
| Search inside a menu, switch views | Works; results in under 3 s (`tre` → 28). Grouping band is the problem (finding 1). |
| Search everything | Works (10,539); strip becomes four rows (finding 2); toolbar highlight lags (finding 4). |
| Open upstream Find It while our lens is up, then close it | Ours yields and returns at the same place. |
| Use upstream's picker | Our lens closes like vanilla's menu would. |
| Escape with the lens open | Not driven live this run; covered by the unit tests in `escapeClosesLens.test.ts`, including the upstream-panel-open case. |

## What this run did not cover

- Keyboard-only use and gamepad: the lens has no focus order of its own beyond
  what the vanilla slot gives it; not measured.
- Other resolutions: the UI canvas is a fixed 1280×720 on this host.
- Upstream's own layout beyond what it does to ours.

## Addendum, later the same day: findings 1, 2 and 5 fixed

Branch `findit/ux-eval-fixes` (spec
`superpowers/specs/2026-09-02-ux-evaluation-fixes-design.md`), verified live
in the same two-mod configuration; the DOM readings are in
`verification.md` under the same date. After-frames sit beside the originals:

| Finding | Before | After |
|---|---|---|
| 1 search headers collide | `03-roads-search-tre.jpg` | `after-03-roads-search-tre.jpg` — a two-level group takes its own row, a one-tile group keeps three tiles of label room ("ROAD SERVICES" whole) |
| 2 strip wraps under All menus | `11-ours-everything.jpg` | `after-11-ours-everything.jpg` — no strip while the lens is unscoped |
| 5 repeated header | `02-roads-lens.jpg` | `after-02-roads-lens.jpg` — a nested group named like its parent draws no heading and reserves no row |

Finding 3 stays as recorded: cm-2xvs.12 measured it and the fix is a toast
lane, not a pane move. Findings 4, 6, 7 and 8 wait.
