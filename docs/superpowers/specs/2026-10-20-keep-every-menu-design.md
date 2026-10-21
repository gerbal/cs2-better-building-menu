# Every build menu is kept built

Design for keeping one built panel per toolbar menu, so switching menus costs what reopening one
does. Builds on the click-frame open (`docs/superpowers/specs/2026-10-20-open-in-click-frame-design.md`).

## Why

Measured in game 2026-10-20 (AZ testbed, 1080p, same session, median of four menus, ms until the
opened menu's own first card is on screen):

| | Switch from closed | Switch with the menu up | Reopen |
|---|---|---|---|
| main | 66–89 | 77–105 | 39–46 |
| every menu kept (spike) | 41–47 | 42–49 | 40–47 |

A reopen shows a panel that is already built. A switch rebuilds the one kept panel's cards for
another menu and waits a round trip for C#'s page; with the menu up it is the slowest open there is.
A spike that kept a panel per menu brought every switch to reopen speed, with no frame of another
menu's content in 432 timed opens.

## Decisions (owner, 2026-10-20)

- Keep every menu built, all 15, no cap. The cost is memory: the UI's JS heap went from 16 to 46 MB
  with every menu built, flat over 480 opens (React fibers and props for the hidden menus). The owner
  judged that worth it against the game's footprint.
- No icon pool: with every menu kept, cards never unmount, so it has nothing to reuse.

## Goals

- Opening a menu shows that menu's own panel in the click frame whenever the panel's last page was
  the menu's opening view (as a reopen already does), whether another menu was open, the menu was
  closed, or this menu was open before.
- A hidden panel does no work: it receives no binding updates and no view-store updates, so React
  never re-renders it, and nothing in it measures, polls or patches the page.
- Everything that worked keeps working: scroll anchoring to a placed building, Enter to place, Load
  more and the fill, the strip on the first frame, the extension rules for a mid-session subscribe.

## Anti-goals

- Any frame showing one menu's panel under another menu's button.
- A hidden panel re-rendering on a binding or setting change (15 panels at once would stall).
- Changing how any binding update reaches a shown panel: same batching, same skipping of
  deep-equal values, same rounding as cs2/api's own `useValue`.

## Design

**One panel per menu.** `KeptAssetMenu` keeps a panel per menu name, keyed by the slot's menu
(`AssetMenuSlot`'s `menu`, from the click-frame open), or `""` when only `OwnsCurrentMenu` put the
slot up. A menu's panel is built the first time C# answers an open of it; until then the bindings
hold another menu's page.

**Freezing.** Every panel freezes when a menu opens or closes (the slot store's listener, before any
binding update for the new menu can arrive). The opened menu's panel thaws when C# answers: a page
arrives while its slot is open, or the one-second wait runs out. A frozen panel's readers keep what
they last drew:

- `mods/panelValue`'s `useValue` stands in for cs2/api's inside the menu. It copies the game's hook
  (read in game): one subscription, React state set from its change listener, a value deep-equal to
  the last one skipped, numbers cut to six decimals. Frozen, it drops updates; thawed, every reader
  re-reads its binding.
- `useAssetMenuView` (view mode for the session, the expanded row, disclosures, anchors) freezes the
  same way.

A source test keeps cs2/api's `useValue` out of every file except those that never render inside the
kept menu.

**Which panel is shown** (`domain/keptMenus`):

1. the opened menu's panel, when C# has answered this open;
2. otherwise the opened menu's panel when its last page was the menu's opening view
   (`shouldJoinSlot`, as the click-frame open does for the one kept panel);
3. otherwise, on a switch with the menu up, the panel that was shown, frozen, until 1 or 2;
4. otherwise nothing, until C# answers.

**Hidden panels stand down** as the one kept panel did (`useAssetMenuShown`), and Enter to place
now also checks it: every panel listens on the document.

## Known costs

- First visit of each menu: the whole panel is built rather than the cards swapped, median +14 ms
  (62 → 76 ms in grid view, spike).
- A setting changed while menus are hidden (units, text scale, tile size) reaches a hidden panel when
  it thaws, a frame after it is shown.

## Testing

- Unit: the delivered-value rule (`domain/bindingValue`), which panel is shown (`domain/keptMenus`).
- Render: a frozen panel ignores binding and view-store updates and catches up when thawed; outside a
  panel the hook behaves like cs2/api's.
- Source: cs2/api's `useValue` only outside the kept menu.
- In game: the open timings in four views against main, the behaviour checks of the click-frame PRs,
  first visits, heap, a view-mode change with every menu built, and a mid-session subscribe.
