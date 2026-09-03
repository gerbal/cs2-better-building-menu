# Better Building Menu

Better Building Menu is a building browser for Cities: Skylines II. Open any
vanilla build menu and it takes that menu's place, listing the same buildings the
game would — the game's own menu tree decides what belongs — as a table, a grid
or a list you can sort, group and search.

It grew out of a fork of [Find It](https://github.com/JadHajjar/FindIt-CSII) and
has diverged substantially since. See [docs/FORK.md](docs/FORK.md) for
provenance, [PLANNING.md](PLANNING.md) for implementation phases, and
[docs/roadmap.md](docs/roadmap.md) for the capability plan.

## Features

* Replaces the vanilla build menu in place — no floating window to manage.
  The Zones button opens a browsable zoning hierarchy; assignment still uses
  the game's own Zone tool.
* Table, grid and list views, each sortable and groupable.
* Facets for availability, source, theme, asset pack, placement and role.
* Metric range filters over cost, upkeep, workers, capacity and lot size.
* A search that finds nothing inside one menu can widen itself to every menu.
* Hover a building for its numbers; place one and a service coverage overlay
  shows what it reaches.
* Integrated picker — **Ctrl+P**, or the picker icon in the toolbar — opens the
  menu on a building already in the city.

Buildings and networks only. Props, trees and detailing are left to the mods
made for them.

There is deliberately no search hot-key: this is a build menu, so it opens from
the toolbar menu you already clicked. `Ctrl+F` collided with vanilla's "Toggle
Follow Selected Citizen" and with Find It's own shortcut, so it was removed
rather than moved.

## Coexists with upstream Find It

Both may be installed. Find It's own panel takes the asset-menu slot while it is
open and this menu returns when it closes; with Find It present its picker is the
one on the toolbar and ours stands down; the two ship no file at the same shared
path. Verified live against Find It 1.5.8 (`docs/verification.md`, 2026-09-02).

## Renamed on 2026-09-02

The mod was renamed from `FindItBuildingMenu`. The game keys a mod's settings
file by its id, so the first run after the rename starts from defaults again —
any options you had customised are back at their initial values.

## Not published yet

Its runtime identity is unique, but a new PDX Mods publisher ID and confirmation
of the upstream license are still required before distribution.

## Credits

Derived from **Find It 1.5.8** by **T. D. W.** This mod would not exist without
it. Credits carried over from that project:

* **YenYang** — help on the UI.
* **Algernon** — contributions, and for allowing the original project to be
  taken on.
* **Chameleon** — icons.
* **Baka-gourd** (NullPinter) — help with focus handling.
