# Fork record

## Provenance

- Upstream repository: `https://github.com/JadHajjar/FindIt-CSII.git`
- Upstream branch: `main`
- Upstream revision: `d865b795b1c00491aa529934b906ba5c5ce6f42c`
- Upstream release: `v1.5.8`

`README.md` carries the upstream credits, including Baka-gourd (NullPinter).

## License

The upstream `FindIt/FindIt.csproj` declares `Copyright` as `@2024 MIT license`.
Upstream carries no `LICENSE`, `COPYING` or `NOTICE` file and no license text in its
README, so that line is the whole of its license claim, and this fork is published on
it. `LICENSE` here carries that basis as the MIT terms, with T. D. W.'s 2024 copyright
line for Find It beside this fork's: MIT asks that the notice travel with every copy.
The published listing and this repository credit Find It 1.5.8 by T. D. W. and state
that basis. If the upstream author adds a license file or objects, this record and the
listing change to match.

None of Find It's store art or panel images ships here, nor its fuzzy-search engine or its
favourites feature. The files still identical to upstream are shared scaffolding: the CS2 UI
mod template's `types/*.d.ts`, `package-lock.json`, `tools/css-presence.js` and
`Resources/Blacklist.txt`.

## Runtime identity

None of Find It's identities may appear in this mod: the two must load,
publish and deploy as separate mods. This mod's are:

- C# mod ID: `BetterBuildingMenu`
- UI mod ID: `BetterBuildingMenu`
- Assembly/root namespace: `BetterBuildingMenu`
- UI asset host: `betterbuildingmenu`
- Paradox Mods id: `158589`. Upstream's `77240` must never appear in this mod's
  publish configuration.

`./build.sh package` refuses a package that contains any of Find It's.

The one place Find It's name is still read is asset data: the index accepts
the `FindIt/...` category overrides existing assets carry, as well as this
mod's own `BetterBuildingMenu/...` ones.

Because the identities differ, both mods can be installed together; see
[compatibility.md](compatibility.md).
