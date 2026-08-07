![Find It](https://imgur.com/V2ktQrz.png)

# FindIt Building Menu Successor

This directory is an internal successor project derived from Find It for Cities:
Skylines II. The original Find It implementation is intentionally preserved as
the starting point while the successor identity, build isolation, and expanded
building-comparison workflow are developed. See [docs/FORK.md](docs/FORK.md) for
provenance, [PLANNING.md](PLANNING.md) for implementation phases, and
[docs/roadmap.md](docs/roadmap.md) for the successor capability plan.

It also replaces [`cs2-building-menu-overhaul`](../cs2-building-menu-overhaul/README.md)
as this repository's building-browser mod. The two ship the same feature area and
must not be installed side by side, so the successor stays out of `ALL_MODS` and is
installed with `just deploy-isolated findit-building-menu`.

**Do not publish this checkout yet.** Its runtime identity is now unique, but a
new PDX Mods publisher ID and the upstream license confirmation are still
required before distribution.

# Find It for Cities: Skylines II
Quickly browse and search through all of the assets inside of the game.
Use **Ctrl+F** to quickly open the Find It panel, or click on the magnifier icon in your toolbar.
Use **Ctrl+P** to enable the Picker tool, or click on the picker icon in your toolbar.

Huge thanks to **YenYang** for their help on the UI.

Special thanks to **Algernon** for their contribution and allowing me to take on this project

Thank you to **Chameleon** for providing the Icons.

And thank you to **Baka-gourd** (NullPinter) for their help with focus.

## Features
* Quick and intelligent search methods.
* Extensive and comprehensive asset categories.
* Panel stays open while placing assets, no jumping between different tabs.
* Tool options like Tree Controller and Line Tool are fully supported and can be used while the panel is open.
* Favorite your most used assets.
* Integrated Picker
* Extensive sorting and filtering options.
* Building lens with cost, upkeep, worker, and capacity metrics.
* Building lens facets for role, source, DLC, theme, asset pack, and placement/access flags.
* Bounded three-building compare tray with direct Place actions.

## Notes
Find It should automatically support any mods that add or alter the vanilla assets.

If you're having any issues, please report them on my discord as it's easier to help you that way.
