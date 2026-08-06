# Building Lens UX redesign — live findings and plan

Measured against a running game (Porterville, 4206 catalog entries, 19288 indexed
prefabs) on 2026-08-04 via the gameface MCP. Every number below is observed, not
estimated.

## Root cause

The lens was built to fit **inside FindIt's existing 718px asset-grid panel**
rather than asking for the room a data table needs. All four user complaints
descend from that one decision.

## Confirmed defects

### 1. Access is obtuse
Reaching the catalog takes: bottom-toolbar magnifier → hunt a 51px "Building
lens" toggle among icon buttons → catalog appears nested under CATALOG/TOOLS
tabs and a category bar. The mod also ships a **key binding conflict**
(main-menu notification), so the shortcut path is dead.

### 2. Chrome starves the data
Panel 625px tall; rows get **159px (25%)**. Chrome takes 334px:

| band | px |
|---|---|
| heading | 49 |
| sortBar | 35 |
| facet drawer | 163 |
| columnHeader | 29 |
| pager | 31 |
| categoryBar | 27 |

### 3. 255 clipped labels

| group | n | worst |
|---|---|---|
| metric cells | 234 | `15 000 students` 66px into 38px |
| facet option labels | 18 | `Creator Pack: Mediterranean Heri…` 270px into 152px |
| facet ✓ markers | 3 | 10px into 8px |

Columns are `rem`-sized (1rem = viewportHeight/1080). Required vs actual:
Cost ~68 vs 54, Upkeep ~82 vs 58, Capacity ~100 vs 58.

The unit tests asserted these strings were *correct* but never that they *fit*.
`/mo` and the capacity unit labels are both additions of mine that overflowed.

### 4. Type scale is incoherent and too small
Eight distinct sizes in one panel; **801 elements at 14rem (9.3px)** and 120 at
12rem (8px).

### 5. Hand-rolled widgets where the game ships better ones
`rowScrollTrack`/`rowScrollThumb` is a **5px** hand-rolled rail. Row expansion is
also hand-rolled, and `flex-wrap` on the expanded row pushes `rowPlaceButton`
and `compareButton` onto their own lines — 123px of row for 79px of content, and
`Place` squeezed to **16px**.

## Prior art that was available and unused

`cs2/ui` exports, of which the lens imported only `Button`, `Tooltip`,
`FOCUS_DISABLED`:

- **`Scrollable`** — `vertical`, `trackVisibility: always|scrollable|reserve`,
  `controller`, `useNewStyle`
- **`Panel`** — `header`, `footer`, `onClose`, `theme`, `draggable`
- **`InfoRow`** — `icon`, `left`, `center`, `right`, `tooltip`, `subRow`,
  `uppercase`, `noShrinkRight`
- **`InfoSectionFoldout`** — `header`, `initialExpanded`, `onToggleExpanded`
- **`InfoSection`**, `Dropdown`/`DropdownItem`/`DropdownToggle`, `Icon`,
  `FormattedText`, `MenuButton`, `FloatingButton`, `Portal`

## Plan

UI-only changes hot-reload via `location.reload()`; C# changes need a game
restart. So UI work comes first and is verified live before touching C#.

1. Type scale + column widths + clipping (SCSS)
2. Native `Scrollable` for the row list
3. Native `InfoRow` / `InfoSectionFoldout` for rows and disclosure
4. Reclaim chrome: heading+sortBar → one toolbar, facets → foldout/dropdown
5. Own `Panel` + dedicated toolbar button + keybinding (C#; resolves the
   keybinding-conflict notification)

Keep `buildingLensViewState` — cross-remount disclosure persistence is verified
working and is not something the native components provide.

## Verified working (do not regress)

Confirmed live this session:

- Sortable column headers drive the query; the "Sort by" summary follows
  (the `CreateTrigger` → `CreateBinding` conversion)
- Sort direction toggles and survives paging
- `ResetPagingIfPredicatesChanged`: filtering while on page 43 snapped to page 1
- Honest filter summary: "No active filters" → "1 active filter · 1 facet"
  with `Clear lens filters` appearing
- First/last pager: page 1 → 43 in one click, correct disabled states,
  localized `aria-label` + `title` on all four glyphs
- Digit grouping, `/mo` upkeep suffix, capacity units, `—` for absent vs `0 t`
  for a real zero
- Detail strip renders the projected metrics; disclosure survives re-render

## Vanilla menu replacement (opt-in)

Decided 2026-08-04: replace the vanilla asset grid in place, keeping the
toolbar buttons where they are, so nothing has to be relearned. Buildings
first; networks later.

### Interception point

`ToolbarUISystem` binds:

- `TriggerBinding<Entity>("toolbar", "selectAssetMenu", SelectAssetMenu)`
- `ValueBinding<Entity>("toolbar", "selectedAssetMenu", Entity.Null)`
- `RawMapBinding<Entity>("toolbar", "assetCategories", BindAssetCategories)`
  — the sub-tabs within a menu

Watching `selectedAssetMenu` gives the menu; `assetCategories` gives its
sub-tabs, which is the second level the presets need.

### Menu -> preset

The 13 toolbar menus map almost 1:1 onto `PrefabSubCategory`, so ten need no
new query surface at all:

| Toolbar menu | PrefabSubCategory |
|---|---|
| Electricity | ServiceBuildings_Electricity |
| Water | ServiceBuildings_Water |
| Healthcare | ServiceBuildings_Health |
| Garbage | ServiceBuildings_Garbage |
| Education | ServiceBuildings_EducationResearch |
| FireSafety | ServiceBuildings_Fire |
| Police | ServiceBuildings_Police |
| Transportation | ServiceBuildings_Transportation |
| ParksAndRecreation | ServiceBuildings_Parks |
| Communications | ServiceBuildings_Communications |
| Zones | Buildings_Residential/Commercial/Industrial/Office/Mixed/Specialized |

Not buildings, so out of scope until a networks catalog exists:
**Roads** (the networks themselves; note `ServiceBuildings_Roads` buildings
like maintenance depots *are* in scope), **Landscaping** (surfaces; likewise
`ServiceBuildings_Landscaping`).

### Zone density is indexed, sortable, and not filterable

`ZoneTypeFilter` (Any/Low/Row/Medium/High/Signature) is set on every entry and
`BuildingCatalogQueryEngine` sorts by it, but `BuildingCatalogQuery` has no
ZoneType field — so it cannot be filtered and has no facet. The Zones menu's
sub-tabs need exactly this, so it has to be added as a query dimension and a
facet group alongside the other seven.

## Interaction path sweep (2026-08-05)

Driven against a running city. PASS means observed working, not merely built.

| path | result |
|---|---|
| Grid place (tile arms the tool) | PASS |
| Shelf records a placement and pins it | PASS |
| Search + relevance rank | PASS |
| Search widen ("N elsewhere" -> Search everything) | PASS |
| Grid/table toggle | PASS |
| Sortable column headers | PASS |
| Row expand (description, 5 flag groups, 12 metrics) | PASS |
| Compare tray add | PASS |
| All 8 facet groups populate | PASS |
| Vanilla menu interception (Healthcare, Education) | PASS |
| Vanilla menu decline (Roads) | PASS |
| **Zoning hierarchy via the Zones menu** | FAIL, then FIXED |
| Zone assignment hands off to the native Zone tool | PASS |

### The failure: the interception fights itself

`toolbar.selectedAssetMenu` emissions when clicking Zones:

```
{index: 17109}   Zones          <- the click
{index: 17098}   Education      <- nobody clicked this
```

Opening the lens makes FindIt re-assert its *current* category as the vanilla
asset menu. The watcher cannot tell that echo from a real click, so it routes
it and overwrites the selection the player actually made. Zones opens the
zoning hierarchy and is reverted to the previous scope within the same frame.

This hides between two building menus, where the echo lands somewhere
plausible. It only becomes visible with Zones, where the correct result is a
different view entirely.

Root cause: the game re-syncs its toolbar to the *armed tool's* menu. With an
Elementary School on the tool, clicking Garbage emitted Garbage then Education.

Fixed by MenuEchoGuard. The echo cannot be told from a click by content, so it
is identified by proximity: a *different* menu arriving within two frames of
one we just applied is the game talking. Nobody clicks two menus within three
frames, and the window is deliberately tight so switching menus quickly still
works. Re-selecting the same menu is never treated as an echo, and a backwards
frame counter fails open rather than swallowing every later selection.

Verified with a tool armed — the condition that produced the bug: the zoning
hierarchy now opens and stays, showing 4 families and 21 zones, and selecting
a zone arms the native Zone tool.

### Second pass — remaining paths

| path | result |
|---|---|
| The other 9 mapped menus | PASS — each scopes distinctly: Electricity 19, Water 11, Garbage 8, Education 44, Fire 16, Police 19, Transportation 97, Parks 88, Communications 12 |
| Decline for Roads and Landscaping | PASS — lens closes, vanilla menu is left visible |
| Paging first / prev / next / last | PASS — 1 of 43 -> 43 -> 42 -> 1 -> 2 |
| Metric range filter | PASS — Cost >= 1000000 narrows 4206 to 49, summary names the constraint |
| Section switching (All) | PASS |

Still unswept, all low risk: compare remove and place-from-tray, the lens
toggle, and panel close/reopen state persistence.

### Driving the UI from game_eval

`el.click()` is not available on these elements; dispatching the
pointerdown/mousedown/pointerup/mouseup/click sequence manually is what works,
and is how several paths above were swept in one call rather than one round
trip each.

Two selector traps cost a cycle each. FindIt's search is a `<textarea>`, not an
`<input>` — targeting `input[type=text]` hits the city-name field in the
bottom bar instead. And `[class*="metricRangeInput"]` matches the container
`<div>` before the `<textarea>` it wraps, so setting `.value` on the first
match silently does nothing.

## Coverage overlay: works, but the design is questionable

`ServiceCoverageOverlaySystem` was verified end to end by instrumenting it,
after screenshots proved useless for the purpose:

```
COVERAGE: RS_ElementarySchool01: drawing radius 2000 at float3(2897.3, 47.9, 2532.0)
```

Active prefab resolved, `CoverageData` found, ghost position read off the temp
preview entity, `DrawCircle` called. All four steps succeed.

### Why it cannot be screenshotted

Two independent reasons, either of which is sufficient:

- The ring is drawn by `OverlayRenderSystem` into the 3D scene. `game_screenshot`
  captures only the Cohtml UI layer, so CDP can never show it at any cursor
  position or zoom.
- The ghost only exists where the game raycasts the **real OS cursor**, which
  CDP cannot move. Driving it needs xdotool against the XWayland window, and a
  real screen grab cropped to that window.

### The finding that matters

An elementary school's `m_Range` is **2000**, so the ring is 4000 units across —
far larger than the viewport at normal play zoom. A ring you cannot see the
edges of answers nothing.

Worse, the game already renders service coverage properly, as terrain colouring
in its own education infoview, and does it better than a hard ring can: CS2
coverage is a falloff (`m_Magnitude`) rather than a boundary, so a crisp circle
misrepresents it.

So the memo's "radius ring on the ghost" idea does not survive contact with the
real numbers. Options, none yet taken:

- Drop the ring and instead **activate the game's own infoview** for the armed
  building's service, which is the visualisation the game already has.
- Keep a ring but draw it at the *effective* radius where coverage is still
  useful, rather than at `m_Range`.
- Replace it with the thing the panel genuinely cannot do: mark the nearest
  under-served area, rather than drawing the building's own reach.

**Resolved: took the first option.** The ring is gone. Arming a service
building now activates the game's own infoview for that service, and putting
the tool down restores whatever the player was looking at before — leaving
someone stuck in a view they never chose would be worse than showing nothing.

Verified by real screen capture of the game window, since CDP cannot see the 3D
layer: arming a Fire House Watch Tower tints the city with the Fire Rescue
coverage view, and closing the panel returns it to natural colours.

Note the coverage service and infoview vocabularies do not line up — the
service is `Park`, the infoview `ParksAndRecreation` — so infoviews are
resolved by matching aliases against the real prefab names at runtime rather
than assuming either naming.

## Which infoviews the game already handles

Established by running the same building with `ShowCoverageOverlay` on and off,
rather than assumed:

| service kind | game's own behaviour | our system |
|---|---|---|
| Coverage services — fire, police, healthcare, education | Does **not** change the map view. Arming a Fire House Watch Tower with our setting off leaves natural colours and opens no panel. | Adds the coverage view. Genuinely useful. |
| Network services — electricity, water, sewage | **Already** opens its own infoview and info panel. Arming a coal plant shows the ELECTRICITY legend by itself. | Redundant, and overridden by the game. |

So the pollution fallback added for polluters never shows for power plants: the
game's Electricity infoview wins. It may still apply to polluters the game does
not auto-switch for, which is untested.

The honest read is that the system earns its place for coverage services and is
inert for network ones, which is acceptable — it is not fighting the game, it
is filling a gap the game leaves. Worth revisiting if the pollution branch turns
out never to fire in practice, in which case it should be deleted rather than
kept as decoration.

## Outstanding work (as of 2026-08-05, end of session)

Durable copy of the session task list, because that list does not survive the
session and the next person — or the next agent — should not have to
reconstruct it from the git log.

### Needs the game

Nothing here at the moment — see *Verified in the game* below.

### Needs a decision

Nothing outstanding.

### Verified in the game

Checked 2026-08-06 in *Codex Preview Smoke 20260726*, which sits at the
**Founding** milestone — so almost nothing is unlocked, which is what makes it
a real test rather than the everything-unlocked case that would have proved
nothing.

- **24 — Locked/Unlocked filter.** The Availability dimension appears in the
  rail with both options. Selecting Unlocked alone gives 0 of 15 Health &
  Deathcare buildings and the empty state reads "No buildings match Unlocked";
  Locked alone gives all 15. A clean partition, and the panel shrinks to fit
  the empty result instead of holding its full height.
- **22 — Reopening the lens.** Close, then one click on the same toolbar
  button reopens it. The button also stops being highlighted on close, which is
  the selection actually being released rather than the symptom being hidden.
  Filter state survives the round trip.

- **20 — Localized labels.** Switched the running game to German. Breadcrumbs
  ("Dienstleistungen", "Gesundheitsfürsorge & Bestattung") and network
  subcategories ("Brücken", "Autobahnen", "Kreuzungen") all follow, while our
  own vocabulary — *Building Lens*, *Group by*, the role headings — correctly
  stays English. Cross-page group contiguity was already verified.

  The switch also **found a real bug**: building names are resolved against the
  active dictionary once, at index time, so a mid-session language change left
  every name in English beside German headings. That reads as missing
  translations rather than a stale cache, which is worse — it blames the game's
  data for our bug. Fixed by re-indexing on `onActiveDictionaryChanged`.

Two things worth knowing for future checks:

- The vanilla options bank mounts a frame or two after the lens opens, so a
  check that runs immediately can find no panel and wrongly conclude the rail
  is missing. Wait for it.
- `PrefabIndexingSystem` declares `RequireForUpdate` on prefabs carrying
  `Created`/`Updated`, so **anything that does not touch an entity will never
  reach `OnUpdate`**. Setting a flag there is a silent no-op. Work triggered by
  a non-ECS event has to go through `MainThreadDispatcher.RunOnMainThread`.
  This cost a full deploy-and-verify cycle to notice, because the flag version
  looked right and the tests passed.

### Chrome versus content

The rule for "should this be a vanilla component?", because the answer kept
being decided case by case and once got decided the wrong way round.

**Chrome — use vanilla.** Buttons, tabs, filter rails, the tool-options bank,
tooltips, scrollbars. These are vocabulary the player already knows, and
divergence here is pure cost: a second idiom to learn, a theme to re-derive by
eye, and a legacy-interface variant to maintain by hand. Every time we replaced
hand-styled chrome with the game's own component we deleted code and gained
behaviour we had not bothered to write (gamepad tab-switching, focus handling,
the legacy skin).

**Content — ours.** The tiles, the grouping, the headings, the facts on a card,
the footprint glyphs. This is what the mod is *for*. The lens exists because
the vanilla menu's presentation of the catalog is not good enough, so adopting
vanilla's item component in the result area would trade away the product to
match the thing being replaced.

The confusable middle is **scale**, not components. Content should sit
naturally in the game — the grid's 45px icons and `--fontSizeM` labels were
matched to vanilla deliberately — but that is calibrating density so nothing
looks foreign, not inheriting the component. Matching vanilla's *measurements*
is good; adopting vanilla's *widgets* for results is not.

### Decided

- **1 — Keep our own grid tile rather than `assetGridTheme.item`**
  (2026-08-06). Per the rule above: the tile is content. Verified first that
  the zoning half of the note was already stale.

- **23 — Expand-on-hover for `+N` footprints: dropped** (2026-08-06). `+N` only
  appears when a zone has more than `MaxFootprintsShown` (12) *distinct lot
  widths*, and zone lots run 1–6 cells wide, so vanilla data cannot reach it —
  no `+N` was found anywhere in the live zone list. This is a structural
  argument rather than an exhaustive check: a mod adding wider zones could
  still overflow, and the overflow count stays correct if one does. Only the
  expand affordance is unnecessary.

- **25 — Placement now ORs, like every other facet** (2026-08-06). It required
  every chosen flag while role, theme, pack and the rest took any one. The rail
  draws all of them identically, so the same gesture meant two different things
  with nothing on screen to distinguish them, and selecting a second Placement
  value *narrowed* where a second Role *widened*. "Road or water" is also the
  question a player actually asks. The AND reading is defensible in isolation
  and was argued for in the original comment; it lost to consistency.

### Known debt

- **Fifteen localizable strings are registered but not plumbed** — see
  `domain/localizableStrings.ts`. They are returned as text from pure domain
  modules, which cannot call `translate`, so each needs the domain to return a
  key and the component to render it.
- **`ZoningSurfaceCatalog.ResolveFamily(string)`** still matches name stems. It
  now runs only for a zone whose `AreaType` is None with no UI group — a case
  the game's own data does not distinguish either.

## Open design notes (2026-08-05, from play)

Raised while validating the chip row. Resolved 2026-08-06.

1. **Zoning categories should be items/index like the other build item lists.**
   **Mostly stale — see below.** Checked in game in both Grid and List mode:
   zoning now renders through the same `BuildingGrid` / `BuildingList` /
   `GroupedResults` as every other lens view, with the same tiles, headings,
   counts and view modes. The "reads as a different kind of list" half of this
   note was fixed by the zoning unification itself, before the note was
   actioned.

   What survives is narrower and is **not zoning-specific**: our grid tile is
   hand-built (`.tile`, 88×112rem with a 68rem thumbnail) rather than the
   game's own `assetGridTheme.item`. **Decided 2026-08-06: keep ours.** See
   *Chrome versus content* below — this note was written as though matching
   vanilla were the goal, and for the tile it is not.

2. **"Building lens" button text overflows its boundary.** **Fixed** — the
   cause was CSS specificity, not sizing. See the commit; verified in game.

3. **"Catalog | Tools" toggle is awkwardly padded.** **Fixed** by using the
   game's own `TabBar`/`Tab` from `game-ui/common/tabs/tabs.tsx` instead of two
   hand-padded buttons. The check the note asked for found a real component,
   and it brought gamepad tab-switching with it. Verified in game.
