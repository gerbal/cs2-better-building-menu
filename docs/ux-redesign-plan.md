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
