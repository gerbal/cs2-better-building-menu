# Better Building Menu — Fork Record

## Provenance

- Upstream repository: `https://github.com/JadHajjar/FindIt-CSII.git`
- Upstream branch: `main`
- Upstream revision: `d865b795b1c00491aa529934b906ba5c5ce6f42c`
- Upstream release marker: `v1.5.8`
- Local reference checkout: `reference-mods/FindIt-CSII`, in the
  maintainer's workspace rather than this repository
- Fork method: tracked files exported from the upstream revision into this
  separate successor directory; the upstream checkout was not modified.

The copied implementation retains the upstream credits in `README.md`,
including YenYang, Algernon, Chameleon, and Baka-gourd (NullPinter).

## License audit

The upstream `FindIt/FindIt.csproj` declares `Copyright` as `@2024 MIT license`.
The checked upstream revision contains no `LICENSE` or `COPYING` file, and on
2026-08-01 the public repository's raw `LICENSE` URL returned 404. Until
2026-09-09 that was treated as a distribution blocker.

Decision, 2026-09-09: the maintainer chose to publish on the csproj
statement. Re-checked that day: the public repository still has no LICENSE,
COPYING or NOTICE file and no license text in its README; the only license
claim is `<Copyright>@2024 MIT license</Copyright>` in `FindIt/FindIt.csproj`.
The published listing and this repository credit Find It 1.5.8 by T. D. W.
and state that basis. If the upstream author adds a license file or objects,
this record and the listing are updated to match.

Since 2026-09-22 the repository carries that basis as `LICENSE`: the MIT
terms, with T. D. W.'s 2024 copyright line for Find It beside this fork's.
MIT asks that the notice travel with every copy, which the csproj line alone
did not do.

## Inherited assets removed

Audited on 2026-09-02, comparing every tracked file against the upstream
revision byte for byte. 44 files were still identical to Find It's. Of those,
the ones that carried upstream's *authored* content rather than shared
scaffolding were removed:

- `Properties/Screenshot_01..07.jpg` and `Properties/Thumbnail.png` — 3.5 MB of
  Find It's own store art, byte-identical, and wired into
  `PublishConfiguration.xml`. They showed upstream's floating panel rather than
  this mod's in-place menu, so they were wrong on the merits as well as
  unlicensed to redistribute. `AutoPublishConfiguration.json`'s `ThumbnailUrl`,
  upstream's imgur link carried over verbatim, was blanked with them. This
  mod's own thumbnail and screenshots, captured in-game, replaced them before
  the first publish on 2026-09-09.
- 35 unreferenced images under `Resources/Images` — Find It's panel chrome
  (view toggles, sort arrows, align, close, corner filters, its level glyphs)
  plus nine top-level icons left by the removed filter bank. `build.sh` copies
  `Resources/Images` into the package wholesale, so all of it was shipping.
  That includes `Colored/StarOutline.svg` and `Colored/StarFilledSmallIso.svg`,
  which belonged to upstream's favourites feature — the unfavourited half of
  `PrefabItem.tsx`'s star, and the Favorite category's own icon. This fork has
  no favourites feature, and `PrefabCategory.Any` uses `Standard/StarAll.svg`.
  Their sibling `Colored/StarFilled.svg` stays for now, but its one reference
  is dead: `FilterRail.tsx` maps an `assetPack` dimension to it, and the
  backend emits no such facet (asset packs sit in the `content` group). It
  can go together with that entry.

  Anything else under `Colored/` that source never names should be traced to a
  call site before removal rather than assumed dead: that is the family a
  third-party prefab thumbnail can reach dynamically through
  `IconPath.Normalize`'s `coui://uil/` rewrite, with no reference in this tree.

Also removed, as dead rather than as a licensing matter: Find It's fuzzy-search
engine in `Utilities/SearchUtil.cs` (`SearchCheck`, `PreparedSearchTerm`, the
Levenshtein `SpellCheck`, `AbbreviationCheck` and their word splitters) had no
production caller — catalog search is `BuildingCatalogQueryEngine`'s substring
test plus `BuildingCatalogRelevance.Score`, ranked UI-side. The file kept the
three members still in use; its three characterization test files went with the
engine. `UI/src/domain/category.tsx` and `subCategory.tsx`, two four-line
interfaces with no importer, went too.

The remaining files identical to upstream are shared scaffolding — the CS2 UI
mod template's `types/*.d.ts`, `package-lock.json`, `tools/css-presence.js` and
`Resources/Blacklist.txt` — which are kept.

## Runtime identity safety

The successor now uses unique local runtime identities:

- C# mod ID: `BetterBuildingMenu`
- UI mod ID: `BetterBuildingMenu`
- Assembly/root namespace: `BetterBuildingMenu`
- UI asset host: `betterbuildingmenu`
- Paradox Mods id: `158589`, assigned by the first publish on 2026-09-09 (the upstream `77240` was removed on the fork and never reused)

Prefab category metadata is data compatibility rather than a runtime module
identity: the index accepts both legacy `FindIt/...` overrides from existing
assets and `BetterBuildingMenu/...` overrides generated by this mod.

Coexistence with upstream Find It was an open question here and is now settled:
both may be installed together. Find It's panel takes the asset-menu slot while
it is open and this menu returns when it closes, its object picker is the only
one (this mod dropped its own on 2026-09-09), and the two ship no file at the
same shared path. Verified live
against Find It 1.5.8 (`docs/verification.md`, 2026-09-02).

## Rename on 2026-09-02

The mod was renamed from `FindItBuildingMenu`. The game keys a mod's settings
file by its id, so the first run after the rename started from default options.
