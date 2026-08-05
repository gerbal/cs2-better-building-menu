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
