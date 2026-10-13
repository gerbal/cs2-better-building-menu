# Design notes

Rationale that is too long for a code comment. The code carries one-line pointers to the headings below.

## Escape

An Escape is two presses at once: the game's own, which cancels an armed tool or opens the pause
menu and which BBM's listener cannot consume, and BBM's, which one rule decides (`escapeAction` in
`domain/vanillaMenuWatch.ts`), run by a capture-phase listener in the always-mounted
`VanillaMenuWatcher`.

- **From the search field,** in order: an open list closes, in the top row's popover or over the
  pane, since one list is open at a time across both; else a typed query clears; else the field
  blurs and the menu closes. The game masks its keyboard while a text field has focus, so that press
  is BBM's alone. The game's `TextInput` blurs itself on Escape, so on the first two steps the
  listener stops the press at the document, short of the field, which keeps the keys for the next
  press. The box hands the watcher its open list's close (`openListCloser`), since the watcher sits
  beside the box, not inside it.
- **From anywhere else** the menu closes, and an open list with it. It clears the *game's* toolbar
  selection rather than hiding the box, reusing the path the toolbar button takes:
  `VanillaMenuWatcher`'s close branch picks up the resulting null, so the box has one way to close
  rather than two. `ClearAssetSelection` nulls menu, category and asset together, so no vanilla grid
  appears in the gap. While Find It's own panel is up, Escape is theirs.

The absence of a second condition away from the field is the point. Vanilla keeps its menu open when
a tool is cancelled, and matching that would mean holding on the press that disarms the tool and
closing on the next. Telling those two presses apart from a DOM listener is not possible: both
available signals — elapsed time since the tool disarmed, and what the tool last reported as —
depend on the game's disarm notification, which races the keypress. Closing on every Escape is
deterministic, and the divergence is accepted: cancelling a tool with Escape also puts the menu
away. The pause menu still works, because the game opens it when Escape finds nothing to close, and
the box is gone after the first press. A list closed alone would leave the box up under a cancelled
tool, so away from the field a list goes with the menu.

**This changes 0.2.x:** Escape from the search field closed the menu at once; it now closes an open
list, then clears the query, and closes the menu on the press after.

## Tools that take the screen

A tool change closes the build menu only for a tool that brings a screen of its own: Road Builder
and Move It (`MenuTools.TakesTheScreen`). Every other tool keeps it, as the game keeps its own
menu: `ToolbarUISystem.OnUpdate` re-selects the armed prefab's menu whenever the active tool is not
the area tool, so the game's menu stays up under a terraforming brush, and BBM's stays up and keeps
answering the search and the filters. The Zone tool keeps it too: picking a zone arms it, and
closing there would close the Zones menu the moment it was used. Back on the default tool (Escape,
a right-click, a finished placement) the box closes as before.

## Locked artwork for vector thumbnails

Vanilla silhouettes an unplaceable asset by filtering its thumbnail. Cohtml
rasterises an SVG at draw time, and any compositing effect over one forces a
re-rasterise per composite, which the surface does not survive: a `filter` makes
locked vector tiles flicker and sometimes never draw at all, a `mask-image`
flickers, and an `opacity` below 1 makes the icon vanish outright. Raster
thumbnails under the same rules are stable, which is what isolates the cause.

This is not a corner case — networks use vector icons throughout, so a large,
permanent slice of the Transportation catalog is vector-thumbnailed. Any locked
treatment that filters the thumbnail is therefore broken for that slice.

`hasVectorThumbnail` in `domain/buildingLockState.ts` splits the two paths.
Rasters keep vanilla's filter, which works over them. Vector entries swap to a
pre-blackened copy of their own icon, which the backend makes from the player's
install (`SilhouetteIcons`, sent as `silhouetteThumbnail`; `lockedThumbnail`
picks it), giving the same silhouette with no compositing effect, and fall back
to the ordinary thumbnail when no blackened copy exists. The remaining locked
signals — a lighter tile ground, locked label colour, padlock — cost nothing on
either path. The grid's, list's and table's stylesheets carry the rule this
drives.

## Patching vanilla's layout for the asset menu

`useVanillaLayoutForAssetMenu` in `mods/BuildingMenu/vanillaLayout.ts` makes two changes to
elements the game owns, each applied while it is needed and undone when it is not and on unmount:
imperative and scoped to the mount, because a stylesheet rule would restyle the game for the whole
session, and for any other mod looking at the same node. A missing module or class makes a patch a
silent no-op.

**The game's own centring is left alone.** Vanilla centres its side + main + side trio, which puts
its build menu's slot at the screen's centre. Its rem width follows the pixel ratio: 704 at x 608 on a
1920 × 1080 screen (1 px per rem), 712 at x 604 in a 1280 × 720 window (1.5 rem per px). The asset
menu's row keeps a 706 layout width at every Width step and sits at the slot's left, and the box and
the pane draw at an offset from it (see "The box at its Width step, and the control pane"). The box places itself, so nothing about
the trio needs to change.

**The tool options column moved left of a box that reaches left of the slot.** The game's
`toolLayout` (`game-main-screen.module.scss`) centres its children, a `toolSideColumn`, the slot and
a second `toolSideColumn`, with 6 rem either side of the slot. So the tool options column sits right
beside the slot, ending 6 rem short of it (x 602 at 1 px per rem, 598 at 1.5 rem per px), and grows left with the text scale: 380 wide at the game's
own size, wider by half the scale's increase. The Width steps' room (see "The Width steps") takes
the column to run from x 16 to the tool options' edge, 396 at the game's own size, growing right,
which is where 0.2.x put it by left-aligning the whole `toolLayout`. Without a move, steps 3 to 5,
and step 2 beside the pane, which reach left of the slot, would cover the column's buttons.

- **Only the column moves, and only then.** While the box reaches past the column's right edge,
  `toolOptionsShift` in `widthSteps.ts` gives the column a `left` that
  ends it at the tool options' edge, so it runs from x 16 to that edge at every text scale; where the
  box stays clear of it the game's layout is untouched, step 2's rem left of a 704 slot included. It is the first child of
  `toolLayout` carrying the module's `toolSideColumn` class. The game's stylesheet gives the column
  `position: relative`, so a `left` moves it without moving anything else.
- **Why not left-align `toolLayout` again.** That moves the slot too, by an amount that changes with
  the text scale, so `boxPlacement`'s offsets would have to measure from a slot that is no longer at
  the screen's centre. Moving the column alone keeps the slot where the game centres it, so the
  placement, its tests and the game's own menu under a gamepad all keep one slot.
- **The column right of the slot holds nothing.** The game renders it empty, a spacer that keeps
  the slot centred, so the steps that grow right cover nothing there and it is left alone.

**The toolbar sunk to `z-index: -1`.** The chirper hangs off `toolbar` and the
asset menu hangs off `main-container`. Both are children of `game-main-screen` at
`z-index: auto`, so they paint in tree order and the toast covers the box's
wider steps and the control pane — no z-index on our own row can change that. Raising `main-container`
instead breaks the game's portalled dropdowns, which rely on tree order to win,
while lowering the toolbar changes exactly the one pair. The toolbar still
renders (the screen paints no background behind it) and stays hit-testable.
Moving the chirper's toasts out of the pane's way would make this unnecessary; see
[issue #104](https://github.com/gerbal/cs2-better-building-menu/issues/104).

## The game's own menu under a gamepad

BBM's menu has nothing a gamepad can reach: on PC the game never mounts its console menu, and BBM's
controls take no focus. So while the player uses a gamepad, the game's own build menu stands in for
the toolbar's open menu, and moving the mouse brings BBM's back on the same menu.

- **Picking up a gamepad.** `InputManager.EventControlSchemeChanged` reports it. If BBM stands in
  for a menu, it records that menu's toolbar index and gives it up (`YieldMenuToVanilla`):
  `OwnsCurrentMenu` goes false, and the UI, which draws the game's menu whenever it is false, draws
  it. The toolbar's selection is left alone, so the game's menu opens on the same menu.
- **Under the gamepad.** A menu the toolbar opens is recorded and left to the game; a menu it
  closes clears the record, before anything else `VanillaMenuDeselected` checks.
- **Back to the mouse.** A recorded menu is opened again as a fresh open, past the echo guard, and
  the record goes. It reopens only while the toolbar still has a menu open
  (`ToolbarUISystem.hasActiveSelection`), and with Replace the vanilla build menu off nothing
  reopens.
- **Forgetting without a deselect.** Two events can leave the record behind with no deselect to
  clear it. A load, or a return to the main menu, clears the toolbar while the UI is unmounted,
  and the UI's watcher ignores its first answer when it mounts again; with Replace off the watcher
  sends nothing. So the game's preload forgets the record, as does every settings apply with
  Replace off, whoever had the menu.
- **The rule** is `MenuOwnership`, which is pure: BBM stands in for a menu only while Replace is on
  and the scheme is not the gamepad. `GamepadMenuRecord`, pure too, keeps the record through each
  event that sets or forgets it.
- **Where each menu sits.** At the first Width step BBM's box takes the game's own slot's left and
  bottom, x 608-1,314 on a 1920 × 1080 screen, so the hand-off moves only the right edge, by the
  2 rem the game's 704 slot is narrower (6 rem wider at 712 in a 1280 × 720 window). At a wider
  step the game's menu draws at its own width, and the switch is a visible jump.
- **A nudged stick** flips the scheme, and BBM follows each change as the game does. If that makes
  the menus flicker, the fallback is to wait for a scheme to hold 250 ms before handing over.
- **The handler runs inside the game's input code**, so it does nothing once the settings are gone
  and logs one warning per session if it fails.

## The Width steps

The build menu draws at one of five widths, the same rectangle in every menu. The setting holds
the step's number, 1 to 5, never a width, because the widths follow the screen: a screen is
1,080 rem tall at any aspect, so 16:9 is 1,920 rem wide, 21:9 about 2,520 and 32:9 about 3,840.

- **The room** runs from the tool options' right edge at the game's own text size (x 396) to 1 rem
  short of the social column, which starts 48 rem from the screen's right edge. On 16:9 it is
  1,475 wide.
- **A step's width** is 706, drawn at the left of the game's slot, plus its share of the room beyond 706,
  rounded to the whole rem. The shares are the 16:9 steps' exact ones, 0, 187, 385, 574 and 769
  over 769, so 16:9 gives 706, 893, 1,091, 1,280 and 1,475; 21:9 gives 706, 1,039, 1,391, 1,728
  and 2,075; 32:9 gives 706, 1,360, 2,052, 2,713 and 3,395. The first step is 706 on every screen,
  and a screen with no room beyond 706 draws 706 at every step.
- **The nearest step** to a width is the one whose width on this screen is closest, a tie going
  to the narrower. The settings migration uses it to turn an earlier release's width into a step.
- **One rule, two copies.** `WidthSteps` in C# holds the numbers and the rule. The UI computes the
  same widths from the generated copy, in `widthSteps.ts`, which a test holds to C#'s own widths
  at 16:9, 21:9 and 32:9, and decides where the box sits for a step.

## The box at its Width step, and the control pane

The build menu draws at its Width step (see "The Width steps"), the same rectangle in every menu.
The step is Options › Width (`AssetMenuWidthStep`, a dropdown of the five, "1 · the game's size" to
"5 · covers the chirper") and the pane Options › Control pane (`ControlPaneShown`), each greyed out
while Replace is off and pushed to its binding whenever Options applies. The UI turns the step into
a width on this screen, in `widthSteps.ts`.

**Where the box sits.** A step keeps the left edge of the game's slot for its build menu while its
right edge stays 6 rem short of the chirper (x 1,500 on 16:9); a wider step grows left from there,
never past the tool options' edge (x 396 at the game's own text size, 415 at 110%, 453 at 130%; that
column is 380 wide and grows by half the text scale's increase). The slot is measured, not assumed:
the game centres it, but its rem width follows the pixel ratio, 704 at 1 px per rem and 712 at 1.5
rem per px, so `useGameSlotLeft` reads the left edge of the element the row sits in, again when the
screen or the text scale changes, and the placement takes it as an input (`WidthStepScreen.slotLeft`).
Until the first reading the centred 712 (`VANILLA_SLOT_WIDTH`) stands for it. On a 1920 × 1080
screen, a slot at x 608, the steps draw at 608-1,314, 607-1,500, 409-1,500, 396-1,676 and
396-1,871; from the 712 slot at x 604 step 1 is 604-1,310 and step 2 604-1,497, the rest the same,
so steps 3 to 5 sit at the same screen edges whatever the slot. Beside the shown pane the box grows
right only as far as leaves the pane room before the social column (x 1,487), so step 2 sits at 594
and step 3 at 396, which is 0.2.4's own row. Wider screens follow the same rule from the game's
centred slot: 704 wide at x 928 on 2560 × 1080 and 1,568 on 3840 × 1080. The row the game lays out
keeps a 706 width at the slot's left, and the box and the pane draw at the offset `boxPlacement`
gives, negative for a box that reaches left of the slot. The box never starts left of the tool
options, even on a screen where the game's own slot would. The game's slot sits at the screen's
centre at every text scale.

**Where a step stops.**
- Steps 1 to 3 stop 6 rem short of the chirper, which starts 414 rem from the screen's right edge
  (x 1,506 on 16:9): the box's limit is 420 from the edge, x 1,500 on 16:9. Steps 4 and 5 run on
  over it, by the player's choice, to the room's right edge, 1 rem short of the social column.
- A step wider than its room narrows to it, never below 706. So at larger text step 3 narrows
  rather than reach the chirper (1,085 at 110%, 1,047 at 130%), and step 5 ends at the room's edge.
- Beside the pane, which is 379 wide with a 6 rem gap and may run to the social column's edge,
  steps 1 to 3 narrow to the room left beside it, and a step 4 or 5 that does not fit draws as the
  widest step that does. The stored step is kept and comes back when the pane hides. On 16:9 at
  the game's own text size, steps 4 and 5 draw as step 3, which is 0.2.4's own row: the box to
  1,487 and the pane to 1,872.

**The right edge snaps.** A drag shows the box following the pointer, between the narrowest and the
widest step the edge can snap to; beside the pane those are only the steps that fit. Until the
pointer has travelled 12 rem from the press, in either direction, the box keeps the width it was
pressed at, so a release there sends nothing: where two steps share a right edge, a nudge of a few
pixels would otherwise take the wider or the narrower. Past 12 rem the dragged box is the one whose
drawn right edge is under the pointer, as far from it as the press was; where the box grows left
with its edge fixed, as between steps 2 and 3 on 16:9, no width moves the edge, so a pointer at that
edge or past it takes the widest box that holds it. The release snaps by width to the nearest step,
a tie to the narrower, and sends one `SetAssetMenuWidthStep`, which C# keeps and saves only when it
changes. A release on the step the box already draws sends nothing: beside the pane a stored step 4
or 5 draws as 3, and a drag back onto 3 would otherwise store 3 over the step the pane keeps for
later. A menu closed mid-drag follows the same rule. The box keeps the snapped width until the
stored step comes back from C#, so it does not flash the old width for the round trip. The drag is
the hook's own state, so the catalog's table, which budgets its columns from the stored step, moves
its columns at the release.

**The width strip runs down the box's right edge.** A 6 rem strip from under the top row, so close
keeps its presses, to the box's bottom, past the tab row's band: a child of the box, not of the
body, whose box would cut it short. 6 rem lies inside the catalog's own right margin, and leaves a
body's 3 rem scroll track at the box's edge clear. It carries the top edge's pill on its side. While
the pane is shown, the grab area continues across the 6 rem gap to the pane, as far down as the
strip runs, so that column of city takes no world click; it lights, hints and measures a press as
the strip does, and it is absent with the pane hidden, so nothing reaches past the room's edge.

**The controls follow the game's own UI.** Audited against the game's stylesheet:
- The width strip and the upgrades panel's top strip draw as the game's one panel resizer does:
  nothing until the mouse is on them, then a white fill (10 %, 15 % while dragging, whether or not
  the mouse is still on them). Their pills are the scrollbar thumb's at rest and brighten in white
  as it does, at once, never in the accent. The upgrades panel's strip keeps the dark paint of the
  header under it. The build menu's top edge draws nothing at rest and a pill under the mouse (see
  "The top edge").
- At rest the width pill looks like a scrollbar thumb; the white fill under the
  mouse is what marks it as a handle. The owner chose that over a dark band, which
  the game draws nowhere.
- The close × is a 24 rem glyph in the look's light ink on the round highlight theme the game's
  close buttons use (see "The top row").
- The filter rail's count badge is the game's number badge (`_numberBadge.scss`): light bold text on
  the accent with a soft shadow, sized by the text scale.

**The row is never wider than the box.** It keeps step 1's 706 at every step, and every step is at
least 706, so no stretch of the row lies beside the box to take a click meant for the city.

**The table's arithmetic still counts the pane.** The column widths, the density tier
and the name budget were tuned against the whole row with the pane in it, so they are
handed the build menu plus the pane (`catalogLayoutWidth`) whether or not the pane is
shown. At step 3 that is the number they always had.

**A narrow table drops columns.** Table view draws at the step's width and shows as many
metric columns as fit beside the name at their comfortable widths, grown by the game's
text scale (`visibleTableMetrics`). Parking, Level, Lot, Workers and Capacity go first;
the column the table is sorted by always stays. Below the comfortable set, a road's
per-km cost ("¢3,500 /km") clips in every row, even at the columns' minima. At step 3
all seven fit; at 125 % text step 3 narrows to 1,043.5 beside the pane and three fit; at
the first step, cost and upkeep.

**Cursors and the hint.** The game draws its own cursors, so the strip uses
`cursor://horizontal-can-resize` and `cursor://horizontal-resize`, from the game's own
stylesheet, as the height strip uses the vertical pair. A press becomes a drag only once
the pointer has moved three pixels, so the wobble inside a click moves nothing. Only the
left button drags, as in the game's own drags, and a move that reports no button held
ends the drag where it was, for a release the blocker never saw. The strip's hint is the
game's Tooltip, since the game draws no `title` attribute; it says the edge snaps.

**A drag cut short is saved.** If the asset menu closes mid-drag, by a key or by the
game, both the width and the height drag end as a release does, so the step or the
height the player dragged to is kept.

## Tab counts

The menu's tabs, its strip, and the tabs drawn in a category's place (zones' densities, a service's
branches) each show a count, and every count is what a click on that tab lists: the search, every
facet and every range applied. `CatalogView` answers all of them from two sets.

- **`PresentSet`**: the menu as the game's toolbar row leaves it, with no tab, level, search, facet
  or range. Which tabs draw, in what order, and on which strip axis comes from here, so a filter or
  a keystroke never moves a tab under the pointer: a tab they empty stays where it was, at 0, drawn
  faint. A tab the menu never fills gets no count, and the row leaves it out, as the game does. The
  pane's category picker reads the same list, so the two agree on which tabs exist.
- **`FilteredMenuSet`**: the menu with the search, the facets and the ranges, and no tab. Every count
  counts here; the All cell's is its length. Each entry counts under the tab it answers to in this
  menu, so Roads' gathered networks count under their extra tab. The tabs add up to All only when
  every row answers to a tab the menu declares: a row filed under no tab, or under one the menu does
  not declare, counts in All and in no tab.

**A tab splits into its branches only when they are its own.** A service tab whose rows sit on two
or more development-tree branches draws them in its place, each counting and listing its rows (a
branch's click picks the branch across the menu). That holds only while every row of the tab sits on
a branch (a row on none would land in no cell) and no other tab's rows sit on any of those branches:
the game files a train station on the subway's node under Train, and a split Train would draw a
second "Subway" tab counting that station alone beside the Subway tab, and its click would list both
tabs' subway rows. So `ExpandedCategoryId` passes over a tab with a shared branch or a row on none,
which then draws whole, as the game draws it, and every row of the menu is in exactly one cell: the
cells add up to All.

C# sends a count for each tab the row draws, in the menu's order (`menuCategories`), rather than for
every tab the menu declares: 0 then means "emptied by the filters", and no count "never filled".

**The Content facet narrows the menu before the row.** Its packs and DLCs choose which assets the
menu holds at all, as the game's own pack filter does, so they apply before `PresentSet` is taken,
where the rail's other facets apply after it. A pack or DLC pick that leaves a tab nothing therefore
removes the tab rather than drawing it at 0.

**Education's levels** (`TierBracket`) draw as chips beside the tab that holds the schools. That tab
is found from the data, the one with the most rows carrying a level of 1-4, so a menu whose schools
sit under another name still gets its levels. Each level counts that tab's own schools under the
filters and the search, so the levels add up to the tab, and a level the filters empty reads 0. A
level's pick sets the tab as well as the level, so both read lit and the tab's own pick shows them
all; a school a mod files under another tab therefore leaves that level's list and count. C# keeps
the tab from the last refresh (`_tierParent`), so the trigger needs only the level.

## Tab icons

Every tab draws the picture its binding carries, and every tab binding passes through one chain,
`CategoryIcon.Chain`: the tab's own icon when it can be drawn, else its menu's, else the game's own
placeholder (`Media/Placeholder.svg`). "Can be drawn" is `CategoryIcon.IsResolvable`: not empty and
not an unresolved `assetdb://global/` content hash. The game's `UIExtensions.ResolveUri` resolves an
address with exactly that prefix, compared case for case, before its tab bar draws it, and hands
anything else on as it is; a mod's `assetdb://Global/…` icon is one it hands on, and the page loads
it, so BBM's tab draws it as the game's does. The game's categories
(`GetMenuCategories`, Roads' extra tabs included), the strip tabs, the tabs drawn in a category's
place, and each menu's own icon (`AssetMenus`, which the All cell draws) all pass through it, so no
binding publishes a blank or a hash. Where the game's toolbar would draw its placeholder for a
category with no icon, the row draws the menu's.

C# cannot tell that a well-formed address names a file that is missing, such as a mod's PNG that
was never shipped, so the row finds out: each picture is drawn as a background, which says nothing
when it fails, and probed with a detached `Image` of BBM's own, whose `onerror` moves that cell to
the chain's next step, the menu's icon, then the placeholder.

A tab left with its menu's picture or the placeholder, or one that would repeat another tab's, says
its name on the row instead, so no two cells show one picture with nothing to tell them apart; the All cell draws the
menu's icon on a round plate, which tells it from the rest.

A development branch's tab takes the category's glyph rather than a photograph: `IsPhotograph`
refuses a `thumbnail://` render and Asset Icon Library's PNG building renders (`coui://ail/...png`),
which that library hands the game's development tree for its nodes. Its SVGs stay glyphs.

## The looks' tokens

A look is one class of `--bbm-*` custom properties on the build menu's root (`looks/looks.module.scss`,
built from the maps in `looks/_looks.scss`). The menu's sheets read the tokens, not the game's own
colours, so a look change is a class change and nothing remounts. Standard is the first look; the
tab row and its readout, the top row and the box's body read it, and the other sheets move to it as
their increment restyles them. The per-look geometry table waits for the increments that add the other
looks; only Standard's tokens are written here.

- **One kind of value per key.** Each key holds a colour, a gradient, a shadow, a length or a filter
  in every look and every style, and is read by one longhand: a gradient by `background-image`, a
  colour by `background-color` or `color`, never by the `background` shorthand. Cohtml drops any
  border or background shorthand a `var()` feeds (`border-color`, `border-radius`, `border`,
  `background`) with a UI.log warning, so a radius token is one length read by each corner's
  longhand, and a colour reaches a border through `border-colors`, which writes each side's.
  `lookTokens.test.ts` and the stylesheet guard in `stylesheetContracts.test.ts` hold this.
- **The game's interface styles.** The game puts `style--<name>` on the body, and its Bright blue
  and Dark grey-orange styles redefine its panel, ink and accent tokens. Under either, the root's
  `followStyle` class applies one follow map (`$standard-follow`): the list from
  `--panelColorNormal`, its plates from `--menuPanel1-3`, the ink on them from `--menuText1Normal`
  and `--menuText2Normal`, the head and the popovers from `--panelColorDark`, the accents from
  `--accentColor*`. Ink pairs with the surface under it: Bright blue turns the list light and its
  ink dark, while the head, and the tab row, its readout and the top row on it, stay dark under
  every style and keep the look's light ink. The control pane's labels, chips and summaries sit on
  the list's material, so they take its body inks (`bodyLabel`, `bodyChip*`, `bodyWord`,
  `bodyCtl*`), which follow to `--menuPanel*` and `--menuText*`, while the FILTER popover's chips
  keep the look's light ink. The armed fill and the lit tab's gradient are game tokens no style
  changes (`--selectedColor`, `--gradientHighlight*`). The map leaves the entity ring to the look,
  and its selector names the two style classes without `body`, which the game puts them on. Plates
  under each interface style are settled with the restyle of the list.
- **The game's interface transparency.** The game sets `--panelOpacityNormal` and
  `--panelOpacityDark` from its slider, and its own panels carry them. A look's panels would draw far
  lighter than designed if they took those values as they are, so `surfaceAlphas` scales each
  panel's own alpha by the game's opacity against its value at the default 50%, capped at 1, and
  the root carries the result as `--bbm-a-head`, `--bbm-a-body` and `--bbm-a-popBg`, which the panel
  tokens read inside `rgba()`. At 0% the panels are opaque; at 100% they keep a little over half
  their alpha. The class declares the look's own alphas, so the panels draw as designed before the
  root sets them. Transparency reaches the stylesheet as root variables set from script, because
  `calc()` inside a colour is not measured in Cohtml. The blur follows already: `bodyBlur` is
  `var(--panelBlur)`, which the game sets to `none` at 0%. Under a style the panels are the game's
  own, which carry its opacity already.
- **Plain selectors.** The tokens' rules use class selectors only: Cohtml has no grid, `:not()`,
  `:has()`, `:is()` or `an+b` selectors, and no `text-overflow` on a flex item.

## The tab row

The menu's tabs sit in a band along the box's bottom edge, under the list, next to the bar: All
first, the menu's icon on a round plate over the menu's count; then the game's tabs in its order,
each its icon over its count; a category split into branches draws the branches in its place, and
Education's tab and its levels draw as one plate, the levels as worded chips. A cell whose picture
would not tell it apart (none, the menu's own, or another cell's) says its name instead, with its
count on the same line. A click sends the cell's pick (`SetAssetMenuCategory`,
`SetAssetMenuStripTab` or `SetAssetMenuSchoolTier`), and All's clears every narrowing. Hover labels
are the game's Tooltip ("Medium Roads · 34"): `title` never draws in Cohtml. A tab the filters or
the search empty draws faint, where it was; while a search is typed the counts are match counts.
Until C# sends the menu's counts a tab's count draws blank rather than as a faint 0, so a menu
change does not flash zeroes across the row.

**The box keeps its height.** The band is 29.75 rem: a 1.5 gap under the list, the 26 rem row, a
2.25 pad above the bar, and the body gives it up (see "The box's height"). The row is one line of
a fixed height that cuts at the box's edge rather than wrap, so no menu's tabs grow the box. The
band is the box's bottom edge, so it carries the box's bottom
rounding and the list's bottom corners are square: a rounded list above the band's square top
would notch the seam.

**The cell.** At least 28 wide, 5 each side of its count, 2 from the next, and the full row tall.
A cell is the game's `Button`, whose one class pins 24 × 24, so the cell states its own width
(`auto`) and height with two classes, which outrank it whichever sheet loads last. Cohtml sizes the
row from each cell's own width and skips a min-width, so the 28 floor sits in the content: the icon
slot is 18 wide, the picture centred in it.
Its icon takes what the count leaves of the row, `26 − 10 × text scale`, over a count of
`10 × text scale`: 16 over 10 at 100%, 13 over 13 at 130%, 11 over 15 at 150%. A worded cell's
name is `11 × text scale`, 4 from its count, and Education's plate keeps 4 more from the cells
beside it. A line box rounds up to whole pixels, so a count can run half a rem past the row; the
cell cuts it. A picture draws as its slot's background, contained and centred, so a mod's picture
that is not square keeps its shape: Cohtml has no `object-fit`, and its images report no natural
size to fit one by. Every one of these lengths is stated once, in `_assetMenuGeometry.scss`: the stylesheet draws
them, and the layout arithmetic reads the ones it needs through `assetMenuLayout.module.scss`.

**The readout** sits at the row's right: the lit tab's name over the window the list holds, with
the true total ("Medium Roads" over "1–100 of 779"), so a list that stops is never silent; while a
search is typed its first line reads "37 here". Until increment 9's bodies, which place every cell
from a slot index, the range is the window the list has loaded rather than the rows on screen. Its
two lines fit the 26 rem row only at 100% text, so from 110% it keeps the range alone. The row ends
6 rem inside the box's right edge, clear of the width strip that lies over the band's last 6 rem.

**When the row is short of room** (`planTabRow`), the readout's name gives way first, leaving its
range, which always stays. Only then do the last tabs run past the room the range leaves, where the
row cuts them; it never wraps. The plan estimates text at 0.55 em a character, erring wide, so the
worst an estimate does is drop the name a little early, and the row's own clipping covers the rest.
By that estimate a Roads with All and nineteen tabs keeps one line at the first step at every text
scale the game offers, the name going from 110% and the last tabs clipping from 130%. "+N ▾", which
folds the last tabs into a list, is increment 20's. The All count, like the others, draws blank
until C# sends it: its binding starts negative.

**Named tabs.** Above the first Width step, the box drawn wider than the game's 706, where every tab
fits with its name and the readout's range still fits beside them (`tabForm`, on the same estimate
as the rest of the row), each picture cell draws its picture, its name and its count in a line: the
row's 5 rem padding, the picture in a slot as wide as it is, 4, the name at the worded cells' size,
4, the count. The All cell names itself on its plate; a cell that already says its name keeps its
form, and Education's plate keeps its own. Short of room the row keeps the picture over the count,
never part named and part not, so names never push out the range, which always shows. The form
follows the drawn width, so a stored step drawn narrower beside the pane, and a width drag, read as
what is on screen. The developer knob Tab names turns the names off at every width. "New N", which
then draws right after All, is increment 15's.

## The box's height

The box is the stored height and 63.75 rem, in every look. The stored height (`AssetMenuHeight`)
is the body's, as Standard draws it; 63.75 is the top row's band (a 2 rem pad, the 28 rem row, a 4
rem gap) and the tab row's (29.75). The default body, 144.25, makes the box 208, the game's own
menu's height. The body draws at the box less the chrome the box draws (`drawnBodyHeight`), never
below the drag's floor of 108, so a look that spends its chrome differently changes its body,
never the box. With the top row's band and the tab row's, that chrome is the 63.75, so the body is
the stored height exactly, over the whole drag: the top edge follows the pointer from the floor up.
The upgrades panel keeps the stored height as its cap. The settings migration's version 3 moves version 2's default, 149, to 144.25
(see "The settings migration").

**A tall box stops under the top HUD.** The box draws at the stored height and the chrome or at the
room between its bottom edge (954 on the layout's frame) and the top HUD's band (`TOP_HUD_ALLOWANCE`,
60), whichever is less (`drawnBoxHeight`), and the body at that less the chrome. So the top row
never sits under the HUD: a stored body past 830.25 draws at 830.25. The stored height and the
drag's ceiling of 960 are kept, and the popovers hang from the box as drawn. The top edge drags from
the body as drawn and stops at the room (`useAssetMenuHeight(drawnBodyHeight)`), so the edge moves
at once from where it is drawn, and a stored height above the room comes down to where the first
drag lands. The upgrades panel drags from the stored height, as before. The HUD's 60 is an
estimate, to be measured in game.

## The top row

Along the box's top edge, in a band of the look's head material: a 2 rem pad, the 28 rem row, a 4
rem gap above the body. The row holds the search field, Sort, Filter, Group and View, whatever other
mods add to the game's tab bar, and close. It runs from 4 rem inside the box's left edge to 4 rem inside its right, and where
the box runs over the chirper it stops 10 rem short of the chirper (x 1,496 on 16:9), so no
control sits over it (`topRowRightInset`).

- **The field** takes what the row leaves. It is the game's `TextInput`, drawn bare inside a field
  of the look's `fieldBg` and `fieldRing`. Its placeholder names the menu ("Search Roads &
  Networks"), then the menu's first word, then the word alone, whichever fits; in a language with
  no translation of ours, the game's own word for a search field, and where only our menu name is
  untranslated ("Roads & Networks"), the game's name for the menu (`placeholderWords`). The game
  fills a language's gaps from English, so a key of ours answers in English everywhere; C#
  publishes the keys the active language lacks (`UntranslatedKeys`, from
  `LocaleFallback.UntranslatedKeys`, at load and at each language change), and those count as
  missing. While a query is typed it names, at
  its right, the building Enter will arm, once the page answers the query: the mark and the name
  ("↵ Four-Lane Road 2"), or "All matches locked". The target is cut, to one "…", only when the
  query leaves it no room. Widths are the tab row's estimate, 0.55 em a character, erring wide.
- **Close** is vanilla's round X, 24 rem, 4 rem after what comes before it, its glyph in the look's
  `tQuery`, the light ink the query is typed in. The band is the style's dark panel under every
  interface style, so its ink is one no style follows: the list's name ink, `tName`, follows the
  style and turns dark under Bright blue.
- **One material.** The top row's band and the tab row's are the look's `head`, and the body is its
  `body` under its blur, so the box reads as one panel; the views inside the body keep their own
  colours until they are rebuilt. **This changes 0.2.x:** the body drew the game's panel colour
  with the game's gradient. In the game's default style it draws the look's own dark panel; under
  Bright blue and Dark grey-orange, which the look follows, it draws the style's panel colour,
  without the gradient.
- **The controls.** One strip after the field: each a word ("Sort", "Filter", "Group", "View") and
  its value, then a caret, 1 rem dividers between. From 110% text a 12 rem glyph takes the word's
  place, and at 100% too where the words would leave the field under its 150 rem floor, or while a
  typed query's Enter target would not fit whole beside them; a planner decides it, on the same
  estimate as the field (`planControls`). Each value sits in a slot as wide as the widest value the
  control can show in this menu (the menu's own sorts and groupings, which a numeric sort such as
  "Households" or "Sewage capacity" makes wider than "Default"), so a pick never moves the strip;
  the field gives up that room between menus. A sort set away from Default, or any filter on, turns
  its value white with a 4 rem dot. Group and View carry no dot: C# publishes the grouping in force,
  never whether the player chose it, and the view is one pick for every menu, so a dot there could
  not tell a pick from a default. A cell's label is the game's Tooltip ("Group · By tab"). Each
  cell is the game's icon button with its hover and press.
- **The popovers.** A press on a control opens its popover, and a second press closes it; a press on
  another control switches. One list is open at a time across the top row and the pane: opening
  either home's list closes the other's (`toggleList`). A popover is 240 wide, a child of the box so
  it takes the look, opening upward from 2.25 rem above the box, anchored by a fixed bottom offset
  as the pane's own menus are (a surface hung from `bottom: 100%` is untried on this engine). A box
  too tall for that, whose top edge leaves less than FILTER's 300 rem and the gap below the top
  HUD's 60, hangs it by a fixed top offset under the top row instead, opening down over the body;
  VIEW's Width sub-list follows its list (`popoverAnchor`, on the box as drawn). Its
  left edge sits under its control's, as drawn at the press, pulled left to end at the box's right
  edge or 6 rem short of the chirper (`popoverRightLimit`); a control that cannot be measured
  right-aligns it there. It sits over the top edge's strip and the top row (z-index 50 over 45 and
  40). A press anywhere else closes it: a capture-phase `mousedown` on the document, since the
  game's input sends mouse events and no pointer events, which a press inside the popover or on the
  controls never triggers (`isWithin`, by the marks `data-bbm-popover` and `data-bbm-controls`).
- **The SORT and GROUP lists.** SORT lists Default and the sorts that can move this menu's rows, the
  current one lit with its direction (▲ or ▼), which picking it again flips; GROUP lists the
  groupings the menu offers, its own lit. A pick closes either. A sort starts the list at its
  top (see "Opening on the building's tab"). **This changes 0.2.x:** the pane's separate
  reverse-sort button is gone, since the lit row flips the direction; and the first grouping is
  named "By tab" and the last "No groups", in the strip, the popover and the pane alike, where the
  pane said "Category" and "None".
- **FILTER** holds the filter rail of the game's dropdowns, then a chip for each filter on and
  Clear filters once two are (`FilterPanel`), scrolling past 300 rem. A pick keeps it open, since a
  filter is often one of several. The game draws a dropdown's menu outside the popover, so while one
  is open the popover ignores presses outside it: the first press on the map closes the dropdown, as
  anywhere in the game, and the next closes the popover. Whether a menu is open is read off the
  document at the press (`gameMenuOpen`), by the class of the game's dropdown theme the rail hands
  its dropdowns (`dropdownMenu`), or cs2/ui's own dropdown theme's when the game's gives none,
  never from a flag the dropdown's `onToggle` sets: the game's
  dropdown closes itself on a pick or an outside press without calling it. The popover's listener
  is captured, so it runs before the dropdown's own and still finds the menu on the press that
  closes it.
- **VIEW** lists the four views, the drawn one lit, a pick closing it; then, under a divider, the
  doors to what applies to every menu: "Width · 1" with a dim "every menu ›", and More options…,
  which opens the mod's Options page (`OpenModOptions`, through the game's
  `OptionsUISystem.OpenPage`, on the page the settings register under, `Mod.Settings.id`, and its
  one tab; closing Options lands on the pause menu). Width opens "Width, every menu" to the list's
  left: the five steps, the stored one lit, "default" beside 1 and "covers the chirper" beside 4
  and 5; beside the pane the steps that do not fit are dimmed, and a stored one among them draws as
  the widest that fits. A click sends one `SetAssetMenuWidthStep` and keeps both lists open.
- **The pane** draws the same four lists: Filters inline, the chips under them in their Active row,
  and Group by, Sort by and View as summaries that open theirs over the pane, on the popovers'
  surface. One of its lists is open at a time, and a press outside leaves it open, since the pane's
  lists are not popovers; Escape from the search field closes it as it closes a popover (see
  "Escape"), and arming a building leaves it open. While a search is typed, its caption names it
  ("Results for road"). A summary cuts its value inside itself, so a row's label is whole at every
  text size. Its lists, VIEW's Width sub-list furthest, open left over the box's top row; the pane's
  blur makes it a stacking context, so they paint at the pane's own order, z-index 46: over the top
  row's band (40) and the top edge (45), under the popovers (50). The pane is beside the box, never
  over it, so nothing else moves. The game's dropdowns are portalled outside the menu's own stacking
  order, as over the top row, so the pane's order stays under them. Its root carries the look's
  class (`useLookRoot`), since custom properties reach only a root's own children, and the pane sits
  beside the box, not inside it; its own surface is the look's `body`, the box's beside it. The row
  labels, the chips and the summaries sit on that body, which Bright blue turns light, so they take
  the body's inks (`bodyLabel`, `bodyChip*`, `bodyWord`, `bodyCtl*`), whose plates and text follow
  the style together: under Bright blue and Dark grey-orange the game's menu plates and its text.
  The FILTER popover stays dark under every style, so its chips keep the light ink.
  **This changes 0.2.x:** the pane's surface draws without the game's gradient in every style, and
  in the game's default style it is the look's dark panel; its lists draw their rows in the look's
  ink, 24 rem tall, the lit one in the game's selected colour with white text, on the popovers'
  surface; its chips draw in the body's inks, and Clear filters loses the accent colour; the sort's
  summary names its direction (▲ or ▼); two of its lists can no longer be open together. The pane
  draws no scope chips (the search reaches other menus), no Reset menu (Options' Reset the build
  menu… puts everything back) and no row of view buttons (VIEW carries the views, on the top row and
  in the pane), and the triggers `SetAssetMenu`, `ClearAssetMenuScope` and `ResetAssetMenu` are
  gone.

## The top edge

The height drag starts on a strip over the box's top edge, from 6 rem above it to 2 rem into its
top pad, the box's full width. It is an overlay, the box's last child, with a z-index above the top
row's band (45 over 40) and below the popovers' (50), so an open popover paints over its upper part
and the top row's controls, which start below the pad, keep their own presses. The game's input
delivers mouse events and no pointer events, so the strip and the drag listen for the mouse. A
press raises the drag's full-screen blocker, which carries the drag and its cursor. At rest the
strip draws nothing; under the mouse, a 75 × 4 pill on the edge and the game's resize cursor; its
label is the game's Tooltip. The drag measures rem against the strip's own 8 rem. The upgrades
panel keeps its strip as its first row.

## The notch

Under the box's bottom edge a small trapezoid marks the lit bar button: 38.4 rem across its top,
26.4 at its foot, 4 tall, in the look's `notch`, the game's selected colour, which no interface style
changes. It is a child of the box at `top: 100%`, so it follows the box at every Width step and
height, and it takes no presses. It is drawn with borders, a 4 rem top border in the colour and 6 rem
transparent sides, each a longhand, since Cohtml drops a border shorthand fed by `var()`.

Its place is read, not computed. The button is the game's own: inside the bar (`findVanillaToolbar`),
the button strip, matched on its stylesheet module's class, then its `button.selected`, which the
game sets on the button whose menu is open (`findLitToolbarButton`); a prefix match on a hashed class
name could also match BBM's own. Its rectangle and the box's are read over ten frames whenever the
game's selected menu, the text scale, the screen's height, or the box's width or place changes (the
bar relights its button a frame or two after the binding moves, and a rectangle reads zero before
layout), keeping the last good reading, and turned into rem by the screen's 1,080 rem height
(`notchLeft`). Centred on the button, the notch is held inside the box's ends, so at the first step a
button right of the box (Communications, Landscaping) puts it at the box's right end. With no lit
button found it draws nothing. A look that sets `notchLine` draws its line with that look.

## The release marker and the settings version

A release leaves two signs that it ran, so a later release can tell a player who upgraded from
one who installed it fresh.

- **`SettingsVersion`**, a hidden setting: the settings file's format version, 0 in a file no
  release has stepped. 0.2.5 writes 1; the settings migration stores this release's version once
  it has run, and keeps a higher value, a later release's (see "The settings migration"). Its
  initializer stays 0 and `SetDefaults` never touches it: the game writes a key only once it
  differs from the default object's, and from then on rewrites it at every save.
- **`release.json`**, in ModsData: `version` (the format, 1), `first` (the release that first
  wrote it), `last` (the release that loaded last) and `stampBefore` (whether the silhouettes
  stamp existed before the first release that wrote the file ran). `first` and `stampBefore` are
  kept once written, since every later load finds a stamp its own cache wrote; `last` moves at
  every load. A release is the assembly version in three parts, which a later release compares.
  A marker in a later format is left as it is, and one that cannot be read is replaced.

**The order in `OnLoad`.** What ModsData holds is read first (`ReleaseMarkerFile.ReadPrior`, see
"Who is an upgrader"), then the marker is written, both before the silhouette cache writes its
stamp as it is built. The settings migration runs after the settings load and before the systems
are created, so nothing is subscribed to the apply.

**Nothing here stops a load.** A failure is one warning. `FolderUtil` is first touched inside
`ReadPriorInstall`'s guard, since its static constructor creates the folder and can fail. The
file is written through `release.json.tmp`, then `File.Replace`, or `File.Move` when there is no
file yet: the mod runs on net48, where `File.Move` cannot overwrite.

## Who is an upgrader

A player who ran a release before the Width steps, 0.1.0 to 0.2.5, keeps the width they had; a
new player gets the game's own. `UpgraderTest.Decide` tells them apart from the signs earlier
releases left. It answers only while the stored settings version is below 2, before this release
has saved anything. The first sign that answers decides, and the answer names it:

1. **`SettingsVersion` 1,** which 0.2.5 writes.
2. **A `release.json` whose `first` is a release before 0.3.0,** the first with the Width steps. A
   marker this release or a later one wrote is no sign: a first launch whose settings save never
   landed leaves one. A `first` that is not one to three whole numbers answers nothing.
3. **A key an earlier release wrote,** among the key names the settings file holds: the six 0.2.4
   declares (`AssetMenuHeight`, `AssetMenuCatalogWidth`, `ControlPaneShown`,
   `ReplaceVanillaBuildMenu`, `AutoWidenSearch`, `AssetMenuTileSize`), 0.1.0-0.2.2's
   `BuildingLensPanelHeight` and `BuildingLensTileSize`, 0.1.0-0.1.3's `ShowCoverageOverlay`,
   `SelectPrefabOnOpen` and `HideRandomAssets`, and 0.2.5's `AssetMenuViewMode`. Development
   builds before 0.1.0 also wrote `ApplyMimic` and `DefaultAlignmentStyle`, which no release
   declared, so those are no sign.
4. **The silhouettes stamp as it stood before any release with the Width steps ran:** the marker's
   `stampBefore` when there is a marker, else whether the stamp existed when `OnLoad` began. Every
   release since 0.1.0 writes the stamp at load, so it finds a 0.2.4 player whose file holds no key.

Otherwise the player is new.

**Read before anything writes.** `ReleaseMarkerFile.ReadPrior` reads the marker and the stamp
first in `OnLoad`, before the marker is written and before the silhouette cache writes its stamp.
A marker that is corrupt or in a newer format reads as none. The key names come from the parsed
settings file (`SettingsFileKeys`): the fragments the game keeps on its setting asset, else the
file's own text, whose first line names the setting.

**What it cannot tell.** A 0.2.4 player whose file holds no key and whose ModsData folder is gone
reads as new; anyone who once ran 0.1 or later reads as an upgrader, however long ago.

## The settings migration

The game rewrites every key already in the settings file at its current value, so a changed
default never reaches a player whose file holds the key. `SettingsMigration.Migrate` moves a file
an earlier release wrote, once. At load, after the settings load and before the systems are
created, every step newer than the stored `SettingsVersion` runs, the version is stored, and the
settings are saved once, only if a value moved. It works on `ISettingsValues`, which the settings
class implements, so its tests never build the settings class. A second load finds the version
current and changes nothing; a version above this release's, a later release's, is left alone.
On every load of a file at this version or earlier, a stored Width step outside 1 to 5 becomes
1 and is saved; a later release's file is not touched.

**Version 2, the Width steps.**
- The hidden `Upgrader` is set for an upgrader (see "Who is an upgrader").
- A height within 0.1 of an earlier release's default, 420 (0.2.3 to 0.2.5) or 155 (an unreleased
  build's), becomes 149: the stored height was then the list and the tab row's band together,
  under a 14 rem top strip and a 45 rem header, and 149 made that menu as tall as the game's own,
  208. Any other height is the player's and is kept.
- An upgrader's width becomes the Width step nearest the one they had, on this screen. The legacy
  `AssetMenuCatalogWidth` of 0, 0.2.4's default, drew the room beside the pane, 1,091 on any
  screen: the third step on 16:9, the second on 21:9 and 32:9. A dragged width gives the step
  nearest it, 735 the first. Everyone else gets the first step.

**Version 3, the top row.**
- A height within 0.1 of version 2's 149 becomes 144.25: the body that makes the box, under its top
  row's band and above its tab row's, as tall as the game's own, 208 (see "The box's height"). Any
  other height is the player's and is kept, at least the drag's floor of 108.
- The control pane stays an upgrader's as loaded, and goes off for everyone else. The settings
  class starts the pane shown (`ControlPaneShownWhenMissing`), so an upgrader whose file never held
  the key keeps the pane 0.2.4 showed them; `SettingsDefaults` ships it off, the one setting whose
  shipped value is not its initializer, which the shape tests name. A new player's off differs from
  the initializer, so the game writes the key, and the next load reads it.
- Each step is gated on its own version and the target, so a test runs one step alone; version 3
  reads the upgrader flag version 2 stored, in the same run or an earlier one. Version 2 moves an
  earlier default to its own 149, and version 3 moves 149 on, so a file from before version 2 logs
  both moves.

**It cannot tell a choice from an old default.** A player who chose 420, 155 or 735 by hand moves
with the defaults, once.

**Legacy keys stay declared.** `AssetMenuCatalogWidth` stays a property, which only the migration
reads, so the game keeps its key in the file: it drops a key no property reads at its next save.
`SetDefaults` touches neither it nor `SettingsVersion`.

**An unreadable file.** A read of the key names that throws gives no keys and the migration still
runs, so the file is treated as one with no signs.

**What it logs.** One Debug line, `[SETTINGS-MIGRATION]`: the versions, the key names the file
held, the marker and the stamp as they stood, the sign that decided, and each value that moved.

## The remembered view

The view the player picks in VIEW (Cards, List, Grid or Table), on the top row or in the control
pane, is kept in the hidden setting `AssetMenuViewMode`, so the next session opens in it. Until the
player picks one it holds `""`, and the menu opens in Cards.

- **This session's pick draws first.** The UI's store keeps it, so a pick redraws at once, with
  no round trip. `chooseViewMode` draws that pick, else the stored view, else Cards, and both the
  catalog and the control pane read it, so they cannot disagree. A stored value the UI does not
  know, from a file edited by hand, draws Cards.
- **A pick saves once.** The click sends `SetAssetMenuViewMode`. C# keeps one of the four kinds,
  or `""` for anything else, and saves only when the stored value changes. The binding is
  read/write, like the sort's, so the stored view reaches the UI on its first frame; nothing is
  sent back from an effect, which would answer C#'s own echo.
- **A reset forgets it.** Reset the build menu… stores `""`, so the next session opens in Cards.
  This session's pick goes too: `StoredViewWatcher`, mounted for the whole session because Options
  opens while the menu is closed, drops it when the stored view empties (`sessionPickAfterStored`).
  No pick sends `""`, so nothing else empties it. The watcher lives in a city only, so its first
  answer counts too: empty beside a pick is a reset made at the main menu.

## Reset the build menu

Every setting's shipped value lives in `SettingsDefaults`, whose constants the settings class's
initializers read, so the two cannot drift; `SetDefaults` is `SettingsDefaults.Apply`.

- **What a reset puts back.** `Apply` writes every stored setting's shipped value: the height,
  the Width step, the upgrader flag, the control pane, the remembered view, Replace the vanilla
  build menu, Searching widens automatically and Tile size. It leaves `SettingsVersion`, which
  records the migration, and the legacy `AssetMenuCatalogWidth`, which only the migration reads.
- **Then the version.** `SettingsDefaults.Reset` stores this release's settings version after the
  shipped values, keeping a later release's, so the next load migrates nothing: an upgrader put
  back to a new player's values stays put back, even in a file whose migration never ran.
- **What it leaves.** It touches no file but the settings: `history.json` and `release.json`
  stay as they are.
- **Pure.** Both work on `ISettingsValues`, which holds every setting the class stores; a test
  holds the two lists equal, so a setting a reset would miss fails the tests.
- **The control pane.** `ControlPaneShown` starts shown, so a file without the key reads as 0.2.4's
  did, and Reset puts it off, a new player's value: the one setting whose shipped value is not its
  initializer, which `SettingsShapeTests` names.

**The button.** Options › Better Building Menu › UI / UX ends with Reset the build menu…, which the
game draws as a button that asks first (`[SettingsUIButton]`, `[SettingsUIConfirmation]`, the
question under its `Options.WARNING` key). Its property has a setter and no getter: the game's
settings diff skips what it cannot read, so the button is never saved. The setter resets, then
saves once.

**Rows that wait for Replace.** While Replace the vanilla build menu is off, every other row is
greyed out (`[SettingsUIDisableByCondition]` on Replace, inverted) and its description reads
"Off while Replace the vanilla build menu is off." The game asks a description getter with no
arguments and redraws it every frame, so each such row has its own one-line getter, through
`OptionRows.DescriptionId`.

## The placement history

The mod keeps, in `ModsData/BetterBuildingMenu/history.json`, how often the player places each
prefab, per game menu: the counts, the latest placement, and the two most placed, which hold the
menu's slots. It stays on the player's computer; nothing is sent anywhere.

```json
{ "version": 1,
  "menus": { "Roads": { "latest": "<prefab>", "held": ["<prefab>", "<prefab>"],
                        "counts": { "<prefab>": 6.5 } } } }
```

- **Keys.** A menu is the game's UIAssetMenuPrefab name as the index entry holds it
  (`PrefabIndex.UiMenuName`), not the catalog row's, which shows some extra networks under Roads.
  A prefab is its prefab name, so a prefab a mod renames starts again. Every city shares one
  history.
- **Slots.** The first two prefabs placed in a menu hold its slots, most placed first. A newcomer
  takes the weaker slot once its count reaches 1.25 times that holder's (5 against 4), so two close
  favourites do not trade places. In developer mode the Slot margin knob sets the 25%
  (see "Developer knobs").
- **Ageing.** Once a launch, as the file is read, every count halves, counts under a half go, and
  each menu keeps its eight most placed; the latest and the holders are never cut, and count
  towards the eight. Recent habits outweigh old ones, and a miscount fades. The halving alone
  does not write the file, so a launch that places nothing leaves it as it was.
- **Writing.** Only when something was placed since the last write: when the build menu closes,
  at a city load or an exit to the main menu, every two minutes, and at quit; never at each
  placement, and never through the settings. Through `history.json.tmp`, then `File.Replace`, or
  `File.Move` when there is no file yet. A crash loses at most two minutes. A write that fails
  warns once a session and is tried again at the next flush.
- **Reading.** A file that is not JSON, has no numeric `version`, or has a version below 1, is
  kept as `history.json.bad` and the history starts empty; if it cannot be kept aside either, it
  is left as it is and nothing is counted that session. In a readable file, what is not
  well-formed (a count that is not a positive number, a holder or latest with no count) is
  dropped and the rest kept. A file from a newer release is left as it is and nothing is counted
  that session, so going back to an older release never loses a newer one's data. A file that
  exists but cannot be read is not written over that session. When `history.json` is missing but
  `history.json.tmp` holds a version 1 history, as after a first flush killed before its move,
  that is read instead and written out at the next flush; any other `.tmp` is ignored.

## Counting placements

`PlacementWatchSystem` counts what the player places with the game's own tools into the placement
history, whatever "Replace the vanilla build menu" holds: it watches the tools, not the menu.

- **What counts.** The game's object, net, area and route tools, by exact type: a mod's tool can
  derive from one of them and inherit its id, and is not counted. The object tool counts placing
  and brushing, not moving, upgrading or erasing; the area and route tools count a new district,
  surface or line, not an edit. The prefab must be indexed and in a game menu. The bulldozer and
  the zone, terrain and upgrade tools never count, so Zones has no history. The editors use the
  same tools, so only a city counts.
- **When.** The game runs `ApplyTool` only on frames a tool applies, and the system counts there.
  It also runs at `PreTool`, every frame, to read what is armed before the tool updates: a tool can
  hand over to another in the update that applies, as a move does to the default tool.
- **One placement per burst.** A building, a district or a transit line is one apply. A brush
  stroke counts once, from the press to the release: the brush applies only on held frames where
  the object fits and the pointer is over the ground, so the stroke is read from the tool's held
  state, not from unbroken applies. A road applies once per segment and counts once while the net
  tool keeps drawing from the last point placed; a right-click that ends the road, or another
  prefab, starts a new one. An apply the game repeats on the next frame, as the net and area tools
  do after a focus change, counts once. A road upgrade counts once per drag, a removal included,
  which the tool's public state cannot tell apart.
- **The fallback.** If a game update changes which frames apply, `PlacementWatchSystem.Rule`
  is set to `PerArm`: a prefab counts once, and counts again after the player arms another tool
  or prefab, or leaves the tool.
- **Never in the way.** A failure warns once a session and the game goes on. The flushes are the
  placement history's: on a close of the build menu, at a load, every two minutes and at quit.

## Developer knobs

Options › Better Building Menu › Tuning holds values a developer tunes while the menu is built. A
knob's row carries `[SettingsUIDeveloper]`, so the game draws it only in developer mode
(`--developerMode`), and `[SettingsUISearchHidden]`, so the options search never finds it.

- **One rule reads every knob.** `Knobs.Value` passes the stored value and the shipped constant to
  `Tuning.Value`, which returns the stored one only in developer mode: a value left from tuning
  does nothing in a normal run, and before the settings load the shipped one holds.
- **Reset puts them back** with every other setting. The knobs stay live whatever Replace the
  vanilla build menu holds: they never wait for it.
- **Slot margin** (0 to 50%, step 5, ships 25): how many more placements than a menu's weaker slot
  holder a newcomer needs to take its slot (see "The placement history"). At 0 a tie
  is enough. A stored value outside 0 to 50, as a
  hand edit could leave, reads as the nearer end.
- **Pick logger** (off or on, ships off): see "The pick logger".
- **Interface styles** (on or off, ships on): whether the build menu follows the game's interface
  style (see "The looks' tokens"); off, the root drops `followStyle` and the look keeps its own
  colours under every style, to compare. It is the first knob the UI reads: C# resolves every such
  knob into one binding, `AssetMenuTuning` (`TuningValues`: whether this run is in developer mode,
  and each knob the UI reads), seeded when the system starts and pushed again whenever Options
  applies, so a stored value counts only in developer mode on the UI's side too.
- **Tab names** (on or off, ships on): whether a box above the first Width step names its tabs where
  they all fit (see "The tab row"); off, the tabs keep their picture over their count at every
  width, to compare. The UI reads it in `AssetMenuTuning`, treating a missing value as on.

## The pick logger

A developer knob, off as it ships, that writes what the player arms and places to
`ModsData/BetterBuildingMenu/picks.jsonl`, on this computer, so the share of picks that reach for a
building placed before, against those that shop for a new one, can be measured. Nothing is sent
anywhere. Like every knob, it stays live whatever Replace the vanilla build menu holds.

Each line is one JSON object with `t` (seconds since the game starts), `event`, `menu` (the game
menu the building is filed under) and `prefab` (its prefab name):

- **`arm`**: a placing tool armed with a building in a game menu, as the placement history counts
  them, with `source`: `bbm` when BBM's menu asks for it, `game` for any other arm (the game's own
  menu, its re-arm, another mod).
- **`swap`**, after an arm that replaces an armed building nothing is placed with, in the same
  tool or another: `from` names it.
- **`place`**: a placement the history counts, with `x` and `y` (where on screen, in rem from the
  top left: the tool's last point through the camera, else the pointer), `cameraMoved` (since the
  arm), `box` (`open` or `closed`: BBM's menu on screen), `tabSwitches` (in BBM's menu since the
  previous placement) and `sinceArm` (its number since the arm, from 1).

**How it reads them.** `PlacementWatchSystem` feeds `PickWatch`, which keeps what lies between
frames, and `PickLog`, which writes the lines; both are pure, and fed only while the knob is on in
developer mode. At PreTool each frame it compares what is armed and where the camera stands
(`CameraUpdateSystem`) with the frame before. It reads the arm from the frame rather than from the
tool's prefab event, which does not fire when a tool is armed again with the prefab it holds.

- **What is armed** is the prefab the object, net, area or route tool in hand holds, whatever it
  is doing, read before the placement filter. The area and route tools hold theirs between one
  district or line and the next, so their arm is written when the district or line is picked. A
  pick switches straight to the new tool, with no frame of nothing armed between, so a road armed
  and never placed, then a school, is a swap. The default tool, any other tool, and the object
  tool moving or upgrading hold nothing: the arm ends, and a building armed after it is no swap.
- **BBM's own arms.** BBM's menu notes the prefab it asks the tool for. The tool takes it at once,
  so the next frame's arm reads as BBM's, and the note marks that frame only. Its tab triggers
  count the switches; its open and close set `box`.
- **Where on screen.** At a placement the object, net, area and route tools' last control point
  goes through the camera. For a district, surface or transit line that is the pointer's ground
  point, not the area or line placed: after the apply that finishes it, the tool's list holds only
  the point under the cursor. Any other tool, an empty list, a point behind the camera or a read
  that fails leaves the pointer. Under a gamepad that pointer is the game's gamepad pointer
  position, the centre of the screen, and the line cannot tell it from a mouse resting there.

**The file.** A line is appended as each event happens. At 5 MB the file moves to
`picks.1.jsonl`, replacing the one before. A write that fails warns once a session and its lines
are dropped. Any other failure of the logger warns once too, apart from the counting's own warning,
and never stops a placement counting or the placement history's flushes. Reset the build menu…
never touches the file.

## Search and sort over the whole result

The window the UI draws is a slice of the whole ordered result, so what Enter arms, how a sort
starts and what a list that stops says are decided over the whole result, in C#.

**Enter.** `BuildingCatalogQueryEngine` chooses Enter's target from every match of the search,
before the window is cut, whatever the sort and the grouping: the best relevance, then the
shorter name, then the first in display order. Locked rows and built uniques are skipped, since
Enter on them does nothing. The page names the target as `BestMatch` (its id, name, menu and
place in the order) and as `BestMatchId`; `AllMatchesLocked` says a search matched only rows that
cannot be placed. The UI arms the id through `SetCurrentPrefab` whether or not its row is loaded,
once the page answers the search in the box.

**A sort starts best first.** One C# table, `SortDefaults.BestFirstDescending`, generated as
`SORT_FIRST_DESCENDING`, says which sorts start highest first: workers, capacity, households, and
water and sewage capacity. Every other sort starts lowest first, which for cost and upkeep is the
cheapest. The UI reads the table where a click becomes a column and a direction
(`nextSortState`); a second click on the same sort reverses it. Households, water capacity and
sewage capacity are offered where they can move a row.

**Ties.** A sort by a number breaks its ties by cost, rows with a cost first, then by the game's
own order (`UIOrder`), the name and the id, so equal capacities show the cheaper building first.
The game's order and the name and category sorts keep their own ties.

**A list that stops says so.** The window grows from 100 rows toward a ceiling of 2,000. The tab
row's readout states the window with the true total ("1–100 of 779"), so the list's end says only
what the readout cannot: while the window can grow it offers Load more; once it is at the ceiling
with rows past it (`Capped`), it says how to narrow the list instead: a tab, the search or a filter.

## The search field's keys

The game masks its keyboard while a text field has focus, so while the search field has focus the
keys are BBM's, and everywhere else they stay the game's: there the arrows and PageUp and PageDown
move the camera. Focus comes from a press on the field only. The listeners are captured on the
document, since the app container stops keydown from bubbling, and read the key by `key` or by
`keyCode` (`searchFieldKey`); held with Shift, Ctrl, Alt or the Windows key, the keys stay the
field's.

- **Up and Down** move Enter's target, the building the field names after "↵", a row a press through
  the rows that can be placed, in the order the list draws them, past locked rows and built uniques,
  stopping at the list's ends. The move is C#'s, as the target is (see "Search and sort over the whole
  result"): the query carries `EnterStep`, how many such rows past the best match the target sits;
  the engine walks the whole result from the best match and serves the step it takes, which the state
  keeps, so a key held past an end moves back on the first press the other way. Any new result
  (typing on, a filter, a sort, a grouping, a tab, an open) puts the target back on the best match;
  Load more and an index refresh keep it. The keys send nothing until the field names a target, the
  page answering the query in it. A move is no start: the window and the list's place stay. The field
  names the moved target and Enter arms it, by id, wherever its row is; no row is marked and the list
  does not scroll to the target.
- **PageUp and PageDown** scroll the list a screen, held inside its ends (`pageScrollTop`); a page that
  reaches the end lets the window load more, as scrolling there does.

**This changes 0.2.x:** in the search field Up and Down now move Enter's target and no longer move the
caret, and PageUp and PageDown, which did nothing, scroll the list.

**Giving the keys back.** The field blurs on Enter from it, whatever Enter arms, on any arm (the
catalog's one `armById`), on Escape's last step (see "Escape"), and as the box goes while it has
focus: the top row blurs it in a layout-effect cleanup, which runs while the field is still on the
page, so every way out (the close button, a tool that takes the screen, Replace switched off, the
gamepad hand-off) lets go (`blurSearchField`). A press elsewhere blurs it, as on any page. While the
field has focus it draws the look's `focusRing` in place of its `fieldRing`, from the game's
`TextInput`'s own focus and blur. **This changes 0.2.x:** the field kept focus after Enter, so the
camera keys stayed dead until a press elsewhere; it now lets go of them, and shows when it holds them.

## Opening on the building's tab

A menu opens where the player was, as the game's own does: a bar press re-arms the menu's last
building before the open reaches BBM, so the open rule reads the tool in hand at that moment
(`ArmedEntryId`). After a city load the game remembers nothing, and neither does the rule.

**The open rule** (`AssetMenuState.OpenMenu`, `CatalogView.Opening`). The search clears. The rule is
asked about the menu as it opens, with no tab and no search, and the first answer that applies picks
the tab: the armed building's tab, when this menu holds it (Roads' gathered networks open on the tab
Roads gives them, a school on its level); Education's first level with rows; the menu's first tab
with rows, passing over a tab the filters empty; All, for a menu that draws fewer than two tabs,
where the row draws All and its strip. The armed building's tab wins even when the filters empty it,
and its list then starts at the top. A tab the row draws no cell for (an asset whose category its
menu does not list) opens All instead, anchored on the building, so the readout names what the list
holds. A tab drawn as its branches or densities opens whole: no branch lights, and the readout names
the tab. The hand-back reopen when the mouse returns after a gamepad is an open like a bar press.
Small menus opening on All join the rule with increment 9's bodies, which decide what fits on one
screen. Two later starts call `OpenMenu` with a building of their own when they land: the warm
start, a building armed for the player on a menu's first open, and the follow, a menu that follows a
building armed from another menu.

**The anchor** is an entry id in the query (`BuildingCatalogQuery.AnchorId`). An open and a tab pick
set it to the armed building; a sort, a second click on the lit tab and a tab picked while a search
is typed clear it, so those lists start at the top. A search, a filter, a range and a grouping clear
it too and start nothing: its start is served, and a window grown for it would hold up to 2,000 rows
on every keystroke. It matches no row: the page names its place in the order (`AnchorIndex`, −1 when
the result does not hold it), and the start's window grows to hold it and a step of rows after it
(`CoveringAnchor`), up to the 2,000-row ceiling, so the row can sit on line 1 in any body. A row at
or past the ceiling no window holds: it grows nothing, and its list starts at the top. The state
keeps the window the page served (`CoverAnchor`), so Load more grows from there and not from the
first chunk.

**Starts.** An open, a tab pick and a sort move `ListStart`, which every page carries, and nothing
else does: a search, a filter, a grouping, more rows and an index refresh leave the list where the
player has it. A counter rather than a flag on one page, because two pages can land in one frame.
The UI's own anchor, the first visible row as scrolling settles (`SetCatalogAnchor`), waits for
windows that move by offset, which know that row.

**In the UI** (`planListScroll`, `useScrollAnchor`), a page whose start the list has not been put in
place for moves it once: the anchored row onto line 1 when the window holds it, else the list to its
top; in the list's last screen the row stays in view where the scroll stops. The start's first page
with rows decides its move, and the start is recorded only when the move is done, so a page that
lands mid-move carries the move on, a page whose anchor a search or a filter cleared too. Placing a
building unmounts the menu, so the view store keeps the row last armed, or last put on line 1, per
list; a remount within the same start brings it back into view once, on the mount's first page with
rows, a third of the way down when it is off the first screen. A row armed after that page is kept
for the next remount, not brought back by a search, a filter or more rows. Cohtml has no scroll
event: each move is a frame loop over `scrollTop` on the element that scrolls, found by walking up
from a row, within the restore's budget of frames. A move ends only when the list reads in place on
two frames running: on a fresh mount Cohtml can re-wrap the cards above the row the frame after the
set, which drops the row a line or more, and the move sets the scroll again. Until a new start's
move lands, the load-more poll holds: the page lands under the last start's scroll, which a shorter
list reads as its end.

**This changes 0.2.x:** every menu opened on All and kept the search; a tab pick and a sort left
the scroll where it was; a restore forgot the row it brought back, so the next placement's remount
opened at the top, where now each remount within a start comes back to the kept row, once.

## Hand-rolled floating surfaces in Cohtml

The filter rail's dropdown surface (`filterRail.module.scss`, `.menu`) states size
only, because the vanilla `Dropdown` owns its own positioning and painting. A
hand-rolled popover in this engine needs two workarounds that the vanilla control
already carries:

- Anchor by `top` plus a `translateY`, not by `bottom: 100%`. A bottom-anchored
  surface lays out correctly and then refuses to paint its head.
- Put `transform: translateZ(0)` on that head to promote it to its own layer.
  Without it the head's text does not rasterise at all.

Both held on Cohtml 1.64 (game 1.6.0). Cohtml 2.2 (game 1.6.2) lays out flex with a new
algorithm, and the two surfaces the mod builds by hand paint in full, text included, with
neither workaround: `ControlPane`'s `.pickerOptions` and the top row's popovers
(`controlPopover.module.scss`), each anchored by a fixed `bottom` offset (the popovers, under a
tall box, by a fixed `top`). A surface anchored by
`bottom: 100%` has not been tried on 2.2, so anchor a new one by `top` or a fixed `bottom` offset.

## The card against vanilla

The card's facts come in two tiers. Those in vanilla's tier follow the binder that draws the
same fact in the game's own tooltip (`PrefabUISystem`), and take the label key that binder
passes, so they read as vanilla's in each of the game's languages, with our English as the
fallback. A fact no binder shows, such as stormwater capacity or transport type, is in our tier
under our label. A test holds every fact in vanilla's tier to its binder's exact key, and every
other fact to ours.

Where the card differs from vanilla on purpose:

- **Upkeep is the budget-free figure.** Vanilla scales it by the service's current budget, which
  is city state rather than a fact about the building, and the base figure is the more useful
  reference. Vanilla's upkeep is also a range whose top prices the burned resources at market;
  the card names each resource and its amount under the upkeep instead.
- **A network's cost and upkeep are rounded once, per kilometre.** Vanilla rounds the
  per-cell figure first and multiplies it out after.
  - Upkeep: the card rounds the per-kilometre figure, which is what `NetUtils.GetUpkeepCost`
    charges (¢487/km/mo. where vanilla shows ¢500).
  - Cost: the card adds each auxiliary network's share before rounding. Vanilla rounds a cell's
    own cost before multiplying by 125, and truncates each share on its own, so a cell cost of
    12.4 reads ¢1,550/km on the card and ¢1,500 in vanilla.

  So a network whose per-cell cost or upkeep rounds to nothing still gets a line on the card,
  where vanilla leaves it off.
- **Power output is one figure**, the top of vanilla's range: vanilla shows the plant's own
  output up to that plus every source that can add to it, as 0–400,000 for an incinerator. The
  table's column and sort need one number. A network whose sub-objects hold a power plant,
  without one owning the network, shows no output or voltage; vanilla sums its sub-objects'.
- **A telecom facility's capacity keeps its decimal**; vanilla rounds it up.
- **Nothing is drawn for nothing.** A percentage effect that rounds to zero draws no line, where
  vanilla binds every one but `CriminalMonitorProbability`, zeros included. A transformer with
  no capacity draws no capacity line, where vanilla binds a zero.
- **Effect numbers are invariant**, beside English labels, so a comma-decimal language reads
  "1.5" in an effect line beside "1,5" elsewhere on the card. This waits on the translation
  work in [issue #98](https://github.com/gerbal/cs2-better-building-menu/issues/98).
- **Some labels stay ours.** "Voltage"; "Water pipes", where the game's "Pipes" would sit beside
  a road's own "Carries" line; a zone's upkeep, which its renters pay, where the game's
  `Properties.UPKEEP` names what the city pays to run a building; helicopters and purification,
  each one fact for several of vanilla's lines (`MEDICAL_`, `FIRE_` and
  `POLICE_HELICOPTER_COUNT`; `WATER_` and `SEWAGE_PURIFICATION_RATE`); and the headline
  capacity, which vanilla names per service (`PATIENT_CAPACITY`, `STUDENT_CAPACITY` and so on)
  where the card draws one line with a unit. The table's columns and range filters keep our
  cost and upkeep labels, which are shorter.
- **A network's cost takes the building's key**, `Properties.CONSTRUCTION_COST`. The key its
  binder passes, `Common.ASSET_CONSTRUCTION_COST`, is in no locale, so it would read "Cost" in
  every language.
- **Transport stops are one line per kind**, where vanilla draws one map of them.
- **An upgrade with both a pollution level and a pollution change** shows two lines under the
  same name, as vanilla's does; vanilla tells the change apart with an icon, which the card
  does not draw.

## Labels in the game's words

Where the game already has a word for what a label names, the label reads the game's word, so
it appears in each of the game's languages without a translation of ours: category and
subcategory names (the editor's `Editor.ASSET_CATEGORY_TITLE`, the toolbar's `Services.NAME` and
`SubServices.NAME`), the "All" tab and chip, themes (`Assets.THEME`), the school levels and the
building roles. `GameLocaleKeys` and `CatalogIndex.SchoolTierPrefabs` hold the keys. Our English
is the fallback, and a modded theme, which has no key, keeps its prefab name.

- **A key is used only where it names the same thing, in every language.** Each is read out of
  the game's `Locale.cok` in all twelve of its languages before it is added. So some ids keep
  ours although the game has a word nearby: Park and Lights; Fences, which the game leaves
  English in German; and Foliage, which leaves out the rocks and spawners the Trees category
  holds. Ids with no counterpart keep ours too, among them Networks, Pipes, Power Lines, Transit
  Lines, Seaways, the Misc groups and Rocks & Miscellaneous.
- **Roles take a building's name.** A role reads the name of the plain building it is built
  around, as a school level does, or the toolbar tab it sits under when it has no one typical
  building. No two roles may share a name in any language, or a filter would offer the same word
  twice. The Role filter orders its options by
  id, so outside English they are not alphabetical by what they say.
- **Density tiers keep ours.** The game has no word for a tier alone. Its zone names are whole
  phrases, the zone type, the tier and, for residential and commercial zones, the region, and the
  region sits somewhere different in each language, so cutting it out leaves fragments behind. A tier
  also spans residential, commercial and office zones, which no one zone name does. The tiers are
  to be translated as the mod's own strings instead; see
  [issue #99](https://github.com/gerbal/cs2-better-building-menu/issues/99).
