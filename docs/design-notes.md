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
either path. The grid's and the list's stylesheets carry the rule this
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
  bottom, so the hand-off moves only the right edge. On a 1920 × 1080 screen the box is 608-1,314
  and the game's slot 704 wide, so its menu ends 2 rem short of BBM's; in a 1280 × 720 window the
  slot is 712 wide and its menu ends 6 rem past. At a wider step the game's menu draws at its own
  width, and the switch is a visible jump.
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
Until the first reading the centred 712 (`VANILLA_SLOT_WIDTH`) stands for it, which draws the box
4 rem right of its place at 1 px per rem; the view store keeps the last reading with the window's
size, so a later open on the same screen starts from it and only a session's first open draws the
fallback, for the frames until two readings agree. On a 1920 × 1080
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
the hook's own state, so what reads the stored step, the Auto rule's Cards from width among them,
changes at the release, not on every frame of the drag.

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

**Named tabs.** Above the first Width step, the box drawn wider than the first step's 706, where every
tab fits with its name and the readout's range still fits beside them (`tabForm`, on the same estimate
as the rest of the row), each picture cell draws its picture, its name and its count in a line: the
row's 5 rem padding, the picture in a slot as wide as it is, 4, the name at the worded cells' size, 4,
the count. The All cell names itself on its plate; a cell that already says its name keeps its form,
and Education's plate keeps its own. Short of room the row keeps the picture over the count, never part
named and part not, so names never push out the range, which always shows. Nor do they take the
legend's room (see "Numbers said once"): the tabs are named only where the legend keeps the form it has
beside them as pictures, since a name is the row's look and the legend decides what the rows print, so
a wider box never drops it. The form follows the drawn width, so a stored step drawn narrower beside
the pane, and a width drag, read as what is on screen. The developer knob Tab names turns the names off
at every width. "New N", which then draws right after All, is increment 15's.

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
transparent sides, each a longhand, since Cohtml drops a border shorthand fed by `var()`. Cohtml has
no `content-box`, so the box is sized border-box: its width is the 38.4 top with the sides inside it,
which leaves the 26.4 foot, and the stylesheet guard rejects `content-box` anywhere.

Its place is read, not computed. The button is the game's own: inside the bar (`findVanillaToolbar`),
the button strip, matched on its stylesheet module's class, then its `button.selected`, which the
game sets on the button whose menu is open (`findLitToolbarButton`); a prefix match on a hashed class
name could also match BBM's own. Its rectangle and the box's are read over ten frames whenever the
game's selected menu, the text scale, the screen's width or height, or the box's width or place
changes (the bar relights its button a frame or two after the binding moves, and a rectangle reads
zero before layout), keeping the last good reading, and turned into rem by the screen's 1,080 rem
height (`notchLeft`). Centred on the button, the notch is held inside the box's ends, as the box's
rectangle measures them (its drawn width until the rectangle reads above zero), so at the first step
a button right of the box (Communications, Landscaping) puts it at the box's right end. With no lit
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
1, and a Default view or At large text the rows do not offer reads as shipped, and is saved; a later
release's file is not touched.

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

**Version 4, the bodies.**
- Every stored Tile size becomes 64, the new default, which draws two rows of ten tiles in the game's
  own box; 0.2.x shipped 100 for its grid, a picture with a label under it.
- The view 0.2.5 kept becomes Default view, mapped: Cards stays Cards, Grid draws as Tiles, List and
  Table as List. With none kept, an upgrader opens in Cards, as 0.2.4 did, and a new player in Auto.
  The view's key stays in the file, declared and hidden, so this step can read it.

**This changes 0.2.x:** every player's Tile size moves to 64, once.

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

0.2.5 kept the view the player last picked, Cards, List, Grid or Table, in the hidden setting
`AssetMenuViewMode`. The settings migration's version 4 reads it once into Default view (see "The
settings migration"); nothing else reads it and nothing writes it, and it stays declared so the game
keeps its key until then. Each menu's own VIEW took its place (see "Each menu's own view and group").

## Reset the build menu

Every setting's shipped value lives in `SettingsDefaults`, whose constants the settings class's
initializers read, so the two cannot drift; `SetDefaults` is `SettingsDefaults.Apply`.

- **What a reset puts back.** `Apply` writes every stored setting's shipped value: the height,
  the Width step, the upgrader flag, the control pane, Default view, At large text, each menu's own
  VIEW and GROUP, Replace the vanilla build menu, Searching widens automatically, Tile size and the
  knobs. It leaves `SettingsVersion`, which records the migration, and the legacy
  `AssetMenuCatalogWidth` and `AssetMenuViewMode`, which only the migration reads.
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
- **The bodies' knobs** (see "The bodies"), each read through `Knobs.Value` into `AssetMenuTuning`, a
  value a hand edit left outside a knob's range reading as the nearer end or as shipped:
  - **List share** (30 to 90%, step 5, ships 50): Auto draws a list where at least this share of a
    menu's rows carry what counts.
  - **What counts** (cost or capacity, as it ships, or capacity only): what a row needs to count toward
    the list.
  - **Auto at large text** (the look's own, as it ships, the list, or the tiles): above 100% text, the
    body Roads and Parks draw.
  - **Cards from width** (never, as it ships, or steps 2 to 5): the step from which Auto draws Cards.
  - **List plate height** (23 to 34, step 0.25, ships 27.25): the list plate's height at 100% text.
  - **Name lines** (the form's own, as it ships, or 1 or 2): the lines a list name takes.
  - **Tile name line** (on, as it ships, or off): the line naming the pointed or armed tile under the
    tiles.
  - **Block labels** (inline, as it ships, or own line): a label plate takes one slot in line with the
    buildings, or starts a line and takes the whole of it (see "The bodies").
  - **Card height** (46, as it ships, or 50): a card's height at 100% text; 46 makes three rows in the
    game's own body, 50 two.
  - **Small menus grow** (on, as it ships, or off): a list in a menu with few rows grows its plates,
    and in a menu of one tab draws no groups unless picked.
  - **Search flow on wide boxes** (nearest the field first, as it ships, or row order): where a typed
    search's results fill at the wider Width steps.
  - **Said once at** (67%, as it ships, off, or 50 to 90%): the share of a view's unlocked rows one value
    must hold for the readout to say it once (see "Numbers said once"). C# reads it, as it counts the
    shared values over the whole view.
  - **Dim the typed word** (off, as it ships, or on): a search result's name dims what was typed, so the
    rest of the name stands out (see "Names").

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

## Search over the whole menu

A search runs over the whole menu, ranked, so a strong match in a later tab ranks above weak ones in
an earlier tab, and the best match is the list's first row.

- **The first letter** keeps the tab, level and strip tab the search began on and the menu's sort
  (`SearchStart`), then clears the tab, so the search covers every tab, and turns the sort to Match.
- **Match** is relevance over the whole menu, then the shorter name, then the game's own order: its
  tabs in their order (`UiCategoryTab`), then its order within each (`UIOrder`). The Sort list offers
  it second, after Default, while a query is typed, and its control draws no dot for it. Relevance has
  no reverse, so Match has no direction: Sort draws no arrow beside it, picking it clears the direction
  a sort picked during the search left, and picking it again changes nothing.
- **Groups wait.** While a query is typed the page is ordered by no grouping
  (`BuildingCatalogGrouping.WhileSearching`), and the Group control says so; the player's choice is
  kept, and applies again when the search clears. A GROUP pick while a query is typed is ignored, so
  the None the control lights then is never stored as the menu's own.
- **Under Match every new query is a start:** the list goes back to its top, its best match first,
  however the open or the player had placed it. A sort picked during the search keeps the list where
  it is as the query narrows, as any narrowing does.
- **A tab picked during the search** narrows it to that tab, its list at the top.
- **Clearing the search** brings back the tab and the sort it began on, the list starting at the armed
  building as a tab pick does. A search whose start was forgotten, by Search everything dropping the
  menu, clears to the game's own order.

**This changes 0.2.x:** a search ran within the open tab, kept the sort and the grouping, and ranked
only inside each group; typing now searches the whole menu as one ranked list, and clearing brings the
tab back.

## Each menu's own view and group

Each menu keeps its own VIEW and GROUP across sessions, and its own sort for the session, so no menu
inherits another's.

- **GROUP** is kept in the hidden setting `MenuGroups`, one `Menu=grouping` line per menu with a pick
  of its own (`MenuPicks`; a line splits on its last `=`, since menu names hold spaces and `&`). A pick
  saves once, and a pick of the menu's own default grouping takes the menu's pick away, so the control
  marks only a grouping set away from how the menu opens (its dot). An open sets the menu's own, or its
  default (`OpenMenu`'s `MenuMemory`). `AssetMenuGroups` carries the picks to the UI. The default is
  read over the whole menu, not the open tab (`CatalogView.GroupFor`), so a menu with no pick draws
  one grouping on every tab, and a pick means the same on each.
- **VIEW** is kept in the hidden setting `MenuViews`, a `Menu=kind` line per menu with a pick of its
  own, the kind one of `list`, `tiles` and `cards` (`BodyViews.SanitizePick`; a stored `icons` reads as
  none until the icons have a body of their own, as Default view's does). VIEW's first row, "Default
  view · <body>", names the body Default view gives the menu and is lit while the menu has no pick; a
  press on it takes the menu's pick away (`SetAssetMenuView("")`). A press on a body keeps it as the
  menu's pick, saved once; the save re-pushes `AssetMenuViews`, which redraws the body. The control
  names the body drawn, with its dot while the menu has a pick of its own. With no menu open, as under
  Search everything, VIEW lists no body, since no menu would keep the pick. Reset the build menu… takes
  every menu's pick away.
- **SORT** is kept per menu for the session (`SessionSorts`): an open brings back the sort the menu last
  had, and every launch starts each at the game's own order. A sort picked while a query is typed is
  the search's, and is not kept; nor is Match, which only a query gives meaning. Reset the build menu… leaves this session's sorts; they end with it.

**This changes 0.2.x:** the grouping and the sort followed the player from menu to menu; each menu now
keeps its own.

## The bodies

A menu draws its buildings in one of four bodies: the list, the icons, the tiles or the cards. Which,
strongest first (`chooseBody`):

1. **A typed search** draws the list, or the cards where the menu's view is Cards.
2. **The menu's own VIEW pick** (see "Each menu's own view and group").
3. **Default view** in Options, unless it is Auto: one body for every menu without a pick.
4. **The look's Auto rule** (`autoBody`), over the menu's share: the list where at least half its rows
   (the List share knob) carry a cost or a capacity (a capacity only, by the What counts knob); the
   icons for a menu over 200 rows where fewer carry either, a prop catalogue; the tiles otherwise. Auto
   never draws the cards, which hold fewer buildings than a screen of the list or the tiles, unless the
   Cards from width knob names a step. Above 100% text the Auto at large text knob can force Roads and
   Parks to the list or the tiles.

The icons draw as the tiles until they have a body of their own.

**The shares.** `MenuShares` holds, for every menu, its rows and how many carry a cost or a capacity, a
capacity, or a lock (`MenuShare.Of`), counted over the whole menu as the catalog lists it, with nothing
of the toolbar's row, a filter or a search, so a filter never changes a body. C# counts them on the
refresh that opens a menu, once per index generation (`PublishMenuShares`, `MenuShareLedger`): the open
menu only, since a unique placed or removed or an unlock moves the generation and the Auto rule reads no
other menu's share. With the toolbar's row untouched the count reads the snapshot the refresh already
projected. `MenuShares` carries every share counted so far; a menu counted on an older generation is
counted again when it next opens. The refresh's `shares=` stage times it, and a line of its own logs
each count.

**Grid and Table leave.** VIEW offers Default view, List, Tiles and Cards; the table, its columns and
their arithmetic are gone, and with them `flattenGroupedRows`, which laid the table's group headings out
as lines with their counts (the unused-export guard allows no export without a caller). Grid's drawing
(`BuildingGrid`) is gone too, the tiles drawing in its place, and with it `stripRedundantNamePrefix`,
which told look-alike names apart on Grid's tiles by dropping the theme and category words a name
repeats. The label plates derive the first again from the page's sections (`bodyCells`, see "Label
plates"); until the name planner derives the second, the tiles' name line tells look-alikes apart.

**Slots.** The list and the tiles place each building from its index alone (`bodyGrid`,
`slotPosition`): left to right, then down, a cell and a 2 rem gap apart, inside the box less 8 rem
each side. Cohtml has no CSS grid, and a slot is an exact place. Wider boxes add columns, never lines:
the lines are the body's height.

- **The list at 100% text:** plates at least 171 rem wide, four across the game's own 706, 27.25 tall
  (the List plate height knob), five lines: 20 a screen. At the five 16:9 Width steps, 4 / 5 / 6 / 7 /
  8 across.
- **The list above 100% text,** by At large text: More buildings, one-line plates 22.375 tall and at
  least 228 wide, 3 × 6 = 18; Whole names, two-line plates 34.56 tall, 3 × 4 = 12.
- **The tiles:** Tile size square, ten across the game's own box from 16 rem in at 64, two lines: 20.
  13 / 16 / 19 / 22 across at the wider steps; 68 gives 9 × 2, and 72 one line of 9.

**A search at a wider step** fills nearest the field: a screen at a time, its results take the first
Width step's columns down the screen first, as at the first step, then the columns the wider step adds
(`nearFieldSlot`); they never run along the whole row, where the fifth result would sit a box's width
from the field. A result past the first screen fills the next screen's lines the same way. The flow
starts once the page answers the query, so the last query's rows never reflow for a frame; it moves
where a result draws, never the order the keys walk or Enter's target (see "The search field's keys").
The list only, where no label is drawn, which a search never has; the cards pack their own rows. The
Search flow on wide boxes knob runs them along each row, to compare.

**Small menus grow.** A menu whose whole row count (its share's rows) fits the first Width step's
columns in one line fewer than the list shows grows its list: its plates take as many lines as its rows
fill there, two at least, and share the body's height less a device pixel, so the scroller, which
reads its height in whole pixels, finds nothing to scroll. A plate with room for two name lines, two
number lines and 10 rem to spare (59 at 100% text) draws the big form: the picture as tall as the plate
allows up to 66, the name over the numbers beside it. The growth is the menu's, counted once over the
whole menu, so no tab or filter resizes its plates, and a wider step adds columns, never taller plates.
Labels take slots too: where the slots a grown list draws, its labels' among them, need more lines than
its rows, it gains them, so a grown list never scrolls; one that needs more than the form's own lines
does not grow. Above 100% text the rule is the same at the large-text form's three columns and its own
lines, and a grown one-line plate with room for two name lines takes them. The tiles and the cards do
not grow. The Small menus grow knob turns it off, to compare.

**A small menu's list draws no groups unless picked.** The growth is the point of a small menu, and
its labels take the slots it grows into: Garbage's 7 rows under its four development branches take 11
slots, three lines of small plates where its rows alone take two lines of the big form. So a small
menu (one that opens on All, below) with no tabs of its own, drawn as a list with Small menus grow on,
groups by none (`BuildingCatalogGrouping.DefaultDimension`): Garbage, Water and Electricity, whose
development branches add little in a menu of one category. The UI names these menus too
(`menusDrawingNoGroups`, `SetMenusDrawingNoGroups`), since which body a menu draws is its rule; C#
counts each menu's tabs with its share (`MenuShare.Tabs`), and the open menu redraws when it joins or
leaves them. A small menu with two tabs or more keeps All's labels naming them, as All names each
tab, and their slots count toward the screen it must fit. A GROUP pick of the player's still applies,
and its labels take their slots, so the list grows less or not at all; its dot shows only for a pick
other than "No groups", which these menus draw unpicked. The set is judged at 100% text and the first
Width step, as the menus that open on All are, so a menu in it that Auto draws as cards or tiles at a
wider step or larger text draws no groups there either. In the tiles at 100% text, or with the knob
off, the menu's own grouping stands. **This changes 0.2.x:** 0.2.x grouped these menus by their
development branches by default.

**The window holds a screen.** The UI tells C# how many buildings one screen of the drawn body holds
(`SetCatalogScreen`); the cards say how many the packer puts in a screen's rows. The window reaches two
screens past its first row where a screen holds more than half a step, a step otherwise
(`BuildingCatalogQuery.Reach`):
a fresh result's first window, and an anchored start's from its row. So a body dragged tall with small
tiles (22 × 14 = 308 a screen) always has rows below its screen to scroll to, and the poll that loads
more can see the bottom coming. A screen is no predicate and no start: it only grows the window.

**The list.** Each building on a plate: its picture, 25 rem (24 above 100% text); its name, planned
over up to two lines at 100% text and one under More buildings (see "Names"); and a right-aligned
number column, the cost over the view's
key number by its glyph (see "Numbers said once"), or under a sort by a number the value sorted by, so the order reads down the column (`plateNumbers`),
with a locked building's milestone ("MS 7") in the cost's place, in amber, while the city has not
reached it (the game's `achievedMilestone`), or the locked word where only the development tree or
another requirement holds it back (`lockedFact`; never "MS 0", nor a milestone the city has: a
prefab's milestone stays whatever the city reaches). A one-line plate is one number tall, so it says
one, as a tile's tag does: the value sorted by under a sort by a number, else the cost or why the
building waits (`oneNumber`). The amber and the "↵" mark are body inks
(`bodyMilestone`, `bodyEntMark`) that follow an interface style to its own ink, dark on Bright blue's
light plates. A unique carries the game's own mark on its picture, faint under the pointer, and one
the city already holds the already-built mark, as 0.2.x's list drew them; a plate that cannot be
placed, locked or built, keeps its dim plate under the pointer. The armed building is filled. Enter's
target carries "↵" beside its numbers while the page answers the query in the box. Names are plain
text, never in spans: Cohtml drops the space after an inline element and never breaks at a hyphen.
The game's Scrollable scrolls the slots, its track over the box's right margin and its thumb on the
slots' right edge, clear of the width strip; the region, the scroller and the slots' box are
one mixin (`_bodyShell.scss`), as the locked and already-built words and the digit separators are
one hook each (`useStateWords`, `useNumberSeparators`), for every body that places its buildings in
slots.

**Labels.** The list and the tiles draw a label plate in a slot of its own before each section's
first building, and the cards a plate in the rows among them: the groups' names in All, and "Locked
N" in a half-locked tab (see "Label plates").

**Markers.** The live check and the render tests count what a body shows through these markers:
`data-bbm-view` on the visible region, and on each building `data-bbm-item`, with `data-bbm-pic`,
`data-bbm-name` (the whole name's length) and `data-bbm-fact` inside it. No count reads
`data-bbm-fact` yet; it marks the numbers for the said-once rule to come.

**The tiles.** Each building is a picture tile of Tile size, the picture 4 rem smaller and inset 2. A
tag at its foot says the plate's first number (`plateNumbers`, `tileTag`): the cost, or for a locked
building its milestone ("MS 4", by the list's rule, `lockedFact`) or the locked word, in the look's
amber, which reads on the tag because the tag stays dark under every interface style. Under a sort by a
value other than the cost or the lot the tag says the value sorted by, as 0.2.x's Grid did, so a re-sort
says why the tiles moved. A money figure the tag cannot hold whole at the text scale is said in
thousands or millions with one decimal, in the game's own template for a total ("¢1.2M"): a cut
figure reads as another number, a rounded one as itself. Where that is still too wide, as large text
makes it on the smallest tile, the figure shortens a step at a time before the tag cuts anything: to no
decimal, then the next unit up ("¢1M") (`compactMoneyForms`). A tag drops a unit only where every tile
beside it shares it, and keeps every unit that tells tiles apart: under a sort by upkeep every bill is
monthly, so a building's reads without its month ("¢4,612", "¢16.5k"); a network's cost and upkeep read
per cell ("¢44/c", "¢36.9/c"), the cell telling a network's figure from a building's whole one. A road's
cost or upkeep and a building's bill fit the smallest tile at every text scale; only a mod's road dearer
than ten thousand a cell outruns the tag at 150%, where the tag clips it: a figure is never cut, as a
cut number reads as another number. A sorted value whose unit
does not fit beside it keeps its whole number and drops the unit ("1 000", not "1 000 stu…"), which the
Sort control names, unless the unit scales with its size (see "Numbers said once"). The fit is judged from the glyph advances of the
game's own fonts, the wider of Overpass and Noto Sans per character, so it errs toward the short form;
a word too wide (a long locked word) is cut once by the name planner, with "…", as Cohtml draws no CSS
ellipsis. The advances are the one table
the cards are sized from (`textWidth`, see "The cards"), so every letter of a unit counts its own
measured width rather than a flat 0.65 em: a figure with narrow letters can fit whole where a flat
width would shorten it, and one with a wide letter ("W") takes a short form sooner.

A locked tile draws a padlock that is a raster, since a masked vector is what Cohtml cannot draw. A unique
carries the game's own mark (`UniqueMark`, and the `unique-mark-states` mixin the list shares), sized
from base.scss's ratio as a share of the picture's box, since Tile size moves the picture, and one the city
holds the already-built mark, as 0.2.x's Grid drew them; locked and built tiles in their silhouette,
rasters only.

Under the tiles, where 14 rem or more are left (`TILE_NAME_LINE_MIN`: two lines of 64 leave 14.25, 68
leaves 6.25) and the Tile name line knob is on, a line names the tile the pointer is on, else the armed
one, then the numbers a tile does not show, its capacity, upkeep and lot (`tileFacts`). The name takes up
to 60% of the line and is planned on it at the line's own font (see "Names"); its box hugs its line, so
the numbers follow the name, and only a line drawn past the box narrows its room.

**This changes 0.2.x:** Grid drew each tile's name under its picture; a tile now draws only its picture
and its tag, and the name is the line's under the tiles, for the tile pointed at or armed. Under a sort by
the lot Grid said the lot on each tile; the tag says the cost there, and the lot is the name line's.

**The cards** draw each building on a card as wide as its words (see "The cards").

**This changes 0.2.x:** one view, picked in VIEW, drew every menu, and every session opened in Cards
(0.2.5 kept the pick); each menu now draws the body its pick, Default view or Auto gives it, and Grid
and Table are gone, Grid's place taken by Tiles and Table's by List.

## The cards

The Cards body draws each building on a card in the look's tokens: a 40 rem picture, the whole name on
one line at the game's `fontSizeS` (cut only past the list's cap on a name), and under it one facts line
at `fontSizeXS`, the lot, the cost and the capacity where the building has each, a "·" between; under a
sort by a number, the lot and the cost among them, the value sorted by in a column at the card's right,
so the order reads down the rows. A locked card keeps its cost and says its milestone beside a padlock
("MS 4" while the city has not reached it, else the locked word, `lockedFact`, in the milestone's ink);
a unique carries the game's mark and one the city holds the built mark; Enter's target carries "↵" on a
dark badge at the picture's top left; the armed card is filled. Its face, fills and inks are the list's
plate's (`cell-face`, `cell-lit`, `tName`, `tNum2`, `tCost`, `bodyMilestone`).

**Placed by a packer.** Each card is as wide as its name or its facts line, whichever is longer, with
its picture and padding, so the rows end ragged. Cohtml lays out no flex-wrap a body can trust, so each
card is placed from the widths its words draw at (`cardText`, `cardWidth`, `packCards`): the widths come
from each character's advance in the game's own fonts (`textWidth`, measured from Overpass and Noto
Sans), never from the drawn card, so the packer is pure and no frame re-packs. A character the table
lacks counts 0.65 em, an ideograph or a syllable block a whole em. A card a few rem wider than its words
costs nothing; one narrower would cut its last letter, so the estimate keeps 2 rem of slack. A card
wider than the row (a long name in a script the table counts a whole em a character, or a long name at
large text on the first step) is held to the row, and its name is planned on its one line in the room
the card has (`cardNameBox`, see "Names"), cut with "…" as a label plate's is. Only a held card's name is
cut, so an estimate a rem short runs into the card's padding rather than losing letters to "…". The tiles' tag
judges its fit from the same table, the wider of the two fonts.

**Its height** is the Card height knob's: 46 rem, three rows in the game's own 144.25 body a little over
3 apart; or 50, two rows 4 apart, the block centred. Above 100% text a card grows where its two lines
need more: the lines are the stylesheet's 18 and 15 rem times the text scale, the one pitch the sheet
draws them at, so two rows still fit the game's body at 150% (56 rem cards). The type grows a little
faster than its lines, as the game's own sizes do, and stands a little over its line at 150%. The rows a
screen shows are counted as the list's lines are (`wholeLines`, a device pixel forgiven), then spread at
most 4 apart; a page steps by whole rows and their gap, so the rows keep the place the page found them
in, a 50 rem block's centring offset with them. A screen of one row starts at the top, 4 above the next,
so a page shows whole rows. The labels (see "Label plates") sit in the rows with the cards, at a card's
height, each as wide as the words its plate draws (`sectionLabel`, so the game's word in the player's
language sizes its own plate); under the Block labels knob's own line a label takes a row of its own.
The catalog lays the cards out (`useCardsLayout`) and tells C# how many buildings a screen's rows hold;
the cards fill the rows the packer gives them, so a screen holds more short names than long.

**This changes 0.2.x:** 0.2.4's cards were 50 rem tall in two rows, under headings that took a row of
their own; they are 46 tall in three rows, the headings label plates in the rows. The Card height knob
keeps 0.2.4's 50 to compare.

## Label plates

A page carries its labels as `Sections`, counted over the whole result rather than the window, so a
label says its true count whatever the window has reached (`CatalogSection`: an id, a kind, the
group's heading and the game's id behind it, where its rows start, how many it holds, and whether they
are collapsed). Two kinds:

- **A group**, one per group of the grouping the page is ordered by, where the result holds two or
  more; one group names nothing the tab does not. Only the outer level: a tab's tiers (its milestones,
  branches or densities) keep their order under it with no label of their own. So All, grouped by tab,
  names each tab with its count, and a tab names nothing but its locked rows.
- **The locked rows.** In a tab (not All), in the game's own order with no search, where half the
  rows or more are locked and the tab has no groups to split, the buildable rows come first, then a
  "Locked N" label, then the locked rows by milestone, each milestone in the game's order
  (`BuildingCatalogQueryEngine.ListsLockedLast`). A row the development tree alone holds, its
  milestone reached or none, sorts first among them, as the nearest to opening. Elsewhere locked rows keep their place, dimmed: a sort
  the player picked keeps its order, and a search ranks a locked match where it falls. A click on the
  label collapses the locked rows out of the window (`SetCatalogSectionCollapsed`, kept in
  `BuildingCatalogQuery.LockedCollapsed`); the label stays, with its count, and any new start or
  narrowing shows them again. A fold is no start: the list keeps its place and its anchor. While
  folded, the page's `VisibleCount` is its total less the locked rows: the window, Load more and
  Enter's target count over it, and `TotalCount` still counts every row.

**The plates.** The list and the tiles place their cells with `bodyCells`, and the cards with their
packer, from the page's sections rather than the window's own headings (`bodyOrder` is the one
interleave): a label goes in the slot
before its section's first row once the window has reached that row, and every building after it moves
a slot on. A section's start counts from the result's first row, so it is read less the page's offset:
a section that ends before the window draws nothing, and the one the window starts inside draws first.
After the window's last row only a collapsed section's label is drawn, which is all a fold leaves; a
group whose first row the window has not reached waits for it, so no label sits above Load more with
nothing under it. A tab whose rows are all locked and folded draws its Locked label alone, never the
empty line. A plate says the group's name, in the game's words where the game has one
(`sectionLabel`, from the section's label id), or the locked word, in caps at 10 rem, then the
count. The name is planned in its caps, their tracking counted, in the room the count leaves
(`labelNameBox`, see "Names"), cut once with "…" where it runs past the plate: Cohtml computes an
inline-block as flex and draws no CSS ellipsis on a flex item, so none of the bodies' text relies on one.
In a tile's square it is planned over two lines in the square's width: a tab's word wider than the
square ("INTERSECTIONS") is cut inside it, the other words whole, never mid-letter at its edge. The
plate's fill
(`labBg`) follows an interface style, and so do its inks, body inks (`bodyWord`, `bodyChipDim`; Locked
in `bodyMilestone`, the ink of "MS n"). In the tiles it takes a tile's square, its name over its count. The
Locked plate is a button that lights under the pointer as a plate does: a press collapses the locked
rows, another brings them back. The plate reads its words and digit separators itself, so every body
draws it from its section and its place alone (`LabelPlate`, `labelPlace`); the cells and the Block
labels knob are one hook (`useBodyCells`). A label is no building: it carries `data-bbm-label`, never
`data-bbm-item`.

- **Inline, one slot,** as it ships: a list of four across and five down loses one building a screen
  per label, never a line. The Block labels knob's other value, own line, starts each label on a fresh
  line and gives it the whole line, so no line holds two blocks, at the cost of the slots it leaves
  empty.

**This changes 0.2.x:** a half-locked tab listed its rows in the game's order, locked among buildable;
its buildable rows now come first. 0.2.x's List and Grid drew a heading over each group and each tier
of a group; the list and the tiles now label the outer groups only, in a slot of the body, and a tab's
tiers keep their order without a label.

## Numbers said once

A page carries its view's facts (`ViewFacts`), counted over the whole result, the tab or All with the
filters, or a search's result, since the UI only ever sees a window of it:

- **The key kind,** the number each row shows second: capacity where half the view's rows carry one,
  else the first of speed, workers and lot that half carry, else none. Each tab, All and each search
  result has its own.
- **The shared values.** For speed (in whole km/h), capacity, workers, the lot (its two sides) and the
  cost, the value the Said once at share of the view's unlocked rows hold, two thirds as it ships,
  counted as the game rounds a percentage (half to even), and held by three rows at least: a statement
  in the readout costs more than two numbers. Locked rows count on neither side, as their slot says why
  they wait. None while a search is typed, whose rows each print their own, and none for the kind the
  list is sorted by, whose order every row's value explains. Only C# counts the share, so moving Said
  once at in Options redraws the open menu at once. A value carries what its unit follows, as the
  rows print it: whether it is a network's figure, which they print per cell, and the role a
  capacity's unit follows. A network and a building at one figure, or two capacities in different
  units, are two values, and a legend no loaded row holds still says the rows' unit.

**One reading of each figure.** A body reads every figure it draws of a row through `rowNumbers`: the
cost, the capacity, the lot, the value sorted by, and the key number. A list plate's second number is
the view's key number, its digits beside a glyph for the unit the readout names once: a gauge for a
speed, a person for a capacity that counts people or things, a case for workers, a grid for a lot.
The glyph is BBM's own picture drawn as a mask, in a box of its own beside the number, never inside a
run of text, in the glyph ink, a step behind the number's digits. A capacity that is a measure (power,
weight, water, data) says its own unit and draws no glyph, and the lot is left out where the name already says it ("Parking Lot
1x3"). Under a sort by a number the second is the value sorted by, with its unit, as Sort names the
kind; under a sort by upkeep without the month every row shares, one convention for the list, the cards
and the tiles' tags ("¢1,200", "¢3.9/c"). A unit that scales with its size (kW or MW, t or kt) is never dropped: where a tile's tag is
short of room the number loses its decimals instead (`compactUnitForms`), since two such figures bare
side by side read as one scale. The cards and the tiles' name line read their figures through the same
functions.

A network's cost is said per cell (`formatCostPerCell`): the index carries a kilometre's worth, 125
cells, and a row divides it back, "¢44/c", short enough to leave a road's name the room for two whole
lines, and the same in miles. A network's monthly bill is said per cell too, to one decimal since a
cell's share of a cheap road's bill is under a coin: under a sort by upkeep in the list, the cards and
the tiles' tag without the month Sort names ("¢0.3/c", `formatUpkeepPerCell`), and on the tiles' name
line, which no Sort stands beside, with its month in the game's own spacing ("¢3.9 /c/mo.",
`formatMonthlyUpkeepPerCell`). The hover card keeps the per-kilometre figures the game's own panels
state. A tile's tag short of room shortens the number as it
shortens a total and keeps the cell ("¢10k/c" past ten thousand a cell).

**This changes 0.2.x:** a list row said its capacity with its unit word ("400 patients"); it now says
the view's key number, a road its speed, by the glyph for its unit. A road's cost and upkeep read per
kilometre in the list, the tiles and the cards; they now say them per cell. Under a sort by upkeep a
building's bill read with its month in the list; every row's now reads without it.

**The readout's legend.** Before the range, the readout says the shared values of the kinds the body
shows (`shownKinds`): the cost and the key number on a list plate with two numbers, the cost alone
where a sort by a value takes the key number's place, on a one-line plate or a tile's tag the cost
(nothing under a sort by a value), and nothing in the cards, whose card says each of its own. The list
tells the readout the form it draws (`setDrawnForm`), so a small menu's grown plate, which keeps both
numbers at large text, has its key number explained. Each value is said by its glyph: "100 km/h unless
shown". Where it says none, it names the key kind by its glyph and the hover card's word ("Speed
limit"); where it says values, a key number of a kind it does not state is explained by its glyph
alone. Short of room it shortens a step at a time ("others 100 km/h", then "others 100"), then drops
the legend, then the place line, and only then do the last tabs clip (`planTabRow`). The legend's
widths come from the tab row's own estimate, as the rest of the row's do. What the readout says it puts
in the view store (`setReadoutSaid`), and the rows read it there: a row leaves blank only a cell whose
value the readout said (`holdsBack`), and a row with no value of a kind the readout states says "–"
there (`missingCost`, `missingFigure`; a lot its name already says prints), so a blank cell only ever
means the readout's value. C# counts a row that lacks the kind against the share, so a stated kind can
still be missing from a few open rows. A legend short of room says nothing, and every row prints its
own. A locked building's slot still says why it waits. A one-line plate shows one number: under a sort
by a value that value; else the cost, or where the readout said the cost, the key number by its glyph;
it is blank only where the readout said both (`oneLineNumber`).

**This changes 0.2.x:** every row printed every number; where most of a view's open rows share one,
the readout now says it once and only the rows that differ print it.

## Names

**The distinguishing word.** Each row of a page carries the word that tells it apart from its nearest
look-alike (`DistinctWords`, beside `DuplicateNameNumbering`, whose numbers it reads): the nearest is
the row of the whole result that shares the most leading words with it, which in name order is a
neighbour, and the row's word is the one after those. "Pedestrian" against Covered Bicycle Bridge; "2"
for Four-Lane Road 2. A row with no look-alike, or that is all of what it shares, has none. Words match
whatever their case and however many spaces part them. C# finds it over the whole result, as a
look-alike past the window still decides which word a cut name keeps, and counts each run of leading
words once in one pass over the rows' words, so a refresh sorts nothing more.

**The planner** (`planName`) lays a name out in a box of a width and a number of lines, at the box's
own font, from the one advance table (`textWidth`), and draws each line as a box of its own
(`PlannedName`), never left to the engine to wrap: Cohtml never breaks at a hyphen, and Chromium does,
so the renders and the game draw the same lines. In order:

1. **Whole,** broken between words, where it fits its lines. An ideograph breaks on either side, as the
   engine breaks it, and never stands alone on the last line.
2. **Cut once,** between words, the mark ending the head ("Four-Lane… Parking Road"), never leading:
   every word a cut must keep stays (the distinguishing word, and in a search each word typed, as a
   search matches its phrase anywhere in the name); the head never ends on a word like "of" or "and"; a
   cut keeping the last word comes first, where catalog names say which of a family a building is, then
   the one keeping the most. Twins that differ in their last word get one shape ("Wide… Road 1",
   "Wide… Road 2"). The tail never opens on a separator ("Small… Mirrored", not "… - Mirrored"), and no
   line opens with one: a lone "-", "–" or "," stays with the word before it.
3. **At a hyphen,** whole, only where every cut keeps under 60% of the name.
4. **Inside a word,** its head and its tail kept (`shortenTileLabel`), the last resort, and never one a
   cut must keep nor a number, a level or a size ("01", "L1", "2x2"), which cut would read as another
   building: the other words are cut inside them, the widest first, to a letter each side of the mark
   at the least ("F…e Extradosed / Bridge" for a search of "bridge"). A kept word is cut inside only where
   it alone is wider than a line; a number never is, and where nothing else gives, the line clips it. A
   name with nothing to guard has a word too long for its line cut on it, else the whole name cut, so a
   one-word name never runs into the numbers beside it. A box with no room, or a width that is no number,
   draws the name's shortest cut.

The room is the body's estimate (a plate's width less its padding, picture, gaps and number column,
`plateNameRoom`) until a frame has drawn the name; then it is the name's box as drawn, which the plate's
flex row sizes whatever the name holds, narrowed by the most any line ran past it (`drawnRoom`), a
narrowing that never widens again, so it cannot spiral. A box that hugs its line (the tiles' name line)
gives no room as drawn, and only a line drawn past it narrows the plan. It never reads widths in the
render's own tick, where Cohtml reports the previous text's, nor where the screen's rem is unknown. A
name planned to its lines draws no third line at any text scale. The plate's markers stay:
`data-bbm-name` on the name's box carries the whole name's length, a building's only (a label's planned
name carries none). A room drawn for one name, type and line count starts from the estimate again for
another.

Each line, and the name's box, clips across but never above or below. The game's sheets show no
`overflow-y: visible` beside `overflow-x: hidden`, and a browser scrolls that pair, so each box is an
eighth of an em taller each side than its line, which a negative margin gives back: the font's ascent
and descent run past a line-height under 1.3 em (the list's names draw at 12.5 on 11), and an accent or
a descender is never cut.

The same planner cuts every name the bodies draw: the list's plates, the tiles' name line, a label
plate's name and a held card's, which keeps its distinguishing word as a row does. None relies on a CSS ellipsis, and a test fails on one in the bodies'
stylesheets.

**Dim the typed word** (developer, off as it ships) draws each word a search typed in a span of its own,
dimmed. Cohtml drops a space that opens a text node after an inline element, so the run after the span
opens with U+200B before its space (`nameRuns`, `AFTER_SPAN`), which keeps it.

**This changes 0.2.x:** a list row's name was drawn whole and clipped at its box; it is now planned to
its lines and cut once, keeping the words that tell it apart, with "…" where words were dropped.

## The search field's keys

The game masks its keyboard while a text field has focus, so while the search field has focus the
keys are BBM's, and everywhere else they stay the game's: there the arrows and PageUp and PageDown
move the camera. Focus comes from a press on the field only. The listeners are captured on the
document, since the app container stops keydown from bubbling, and read the key by `key` or by
`keyCode` (`searchFieldKey`); held with Shift, Ctrl, Alt or the Windows key, the keys stay the
field's.

- **Up and Down** move Enter's target, the building the field names after "↵", a row a press through
  the rows that can be placed, in the result's order, past locked rows and built uniques, stopping
  at the list's ends. The move is C#'s, as the target is (see "Search and sort over the whole
  result"): the query carries `EnterStep`, how many such rows past the best match the target sits;
  the engine walks the whole result from the best match and serves the step it takes, which the
  state keeps, so a key held past an end moves back on the first press the other way. Any new result
  (typing on, a filter, a sort, a grouping, a tab, an open) puts the target back on the best match;
  Load more and an index refresh keep it. The keys send nothing until the field names a target, the
  page answering the query in it. One move is in flight: a key held down sends the next move only once
  the page answers the last (its step changes, or a page lands for a new query), or after a quarter
  of a second when a move past an end changes no page; the repeats in between are dropped, and still
  kept from the caret, so a held key moves at the refresh's pace. A move is no start: the window and
  the list's place stay. The field names the moved target and Enter arms it, by id, wherever its row
  is. Its row carries "↵", and when the keys move the target its row comes wholly on screen, the list
  moving as little as it takes (`revealScrollTop`, `useRevealEnterTarget`); a target past the window is
  armed by id all the same, and the list stays. The reveal follows the page that answers a move (any
  new step, a move back to the best match's step 0 included), never a dropped repeat, and sets the
  scroll once, on the first frame it can measure: plates are placed by slot, so a late wrap moves no
  row. A typed search's best match needs no reveal: it is the list's first row under Match, where the
  search's start puts the list.
- **PageUp and PageDown** scroll the list a screen of the body's whole lines, counted as the body
  counts them (`wholeLines`: the last line needs no gap below it, and a device pixel of shortfall is forgiven, since
  the scroller reports its height in whole pixels), so lines land on the top edge as
  they were (the cards' whole rows and the gap between them, `bodyLines`), held inside its ends
  (`pageScrollTop`); a page that reaches the end lets the window load more, as scrolling there does.

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
Two later starts call `OpenMenu` with a building of their own when they land: the warm
start, a building armed for the player on a menu's first open, and the follow, a menu that follows a
building armed from another menu.

**Opening on All** (`OpensOnAll`). Before any of that, two kinds of menu open on All, anchored on the
armed building where the menu holds it, as the open rule anchors it on a tab: a menu whose view is
Cards, by its own VIEW pick or by Default view, its cards under their tabs' labels; and a small menu,
whose rows all fit one screen of its body at 100% text, the first Width step and the game's own body
height (`menusOpeningOnAll`), so neither the text scale, the Width nor a drag changes which tab it opens
on. The rows and All's labels must fit together: C# counts the rows under each label All draws in the
menu's own grouping with its share (`MenuShare.GroupRows`), and the set places them as the open body
would (`bodyCells`), so a menu of two tabs that would scroll on All by its labels opens on its tab. A
menu of one tab drawn as a list with Small menus grow on draws no labels unless picked (see "The
bodies"), so there its rows alone must fit.
Which body a menu draws is the UI's rule, so the UI names the small menus (`SetMenusOpeningOnAll`, one
name a line), from the menu watcher, which is mounted before any menu opens; it names only the menus C#
has counted, so a small menu opens on its tab the first time a session opens it, and on All from then
on; the watcher tells C# the set again whenever it changes and when it mounts again, as C# keeps the
last set it was told. A menu in the Cards from width knob's cards opens on All only where it is small:
the rule reads the stored picks, not the knob.

**This changes 0.2.x:** 0.2.4 opened every menu on All; a menu now opens on its tab, but a menu in Cards
opens on All, as an upgrader in Cards had it, and so does a small menu.

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
  sort and the range filter need one number. A network whose sub-objects hold a power plant,
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
  where the card draws one line with a unit. The range filters keep our cost and upkeep labels,
  which are shorter.
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
