# Successor UI spacing and typography audit

Date: 2026-07-27  
Bead: `CS-Modding-b53.9`  
Viewport checked: 1280 × 720 (the current launch-script resolution)

This started as a baseline audit of the internal `FindItBuildingMenu`
successor. The corrective CSS described below is now applied. The original
post-change assertion was delayed by a black-screen/fatal boot loop, but a
settled live assertion was completed on 2026-08-01 after a clean Steam →
Paradox → CS2 launch. The baseline live check was performed after the game
reached the settled main menu and a developed save was loaded; no UI assertion
was made during a logo/loading screen.

## Sources and comparison baselines

Successor files checked:

- `FindIt/UI/src/base.scss`
- `FindIt/UI/src/mods/TopBar/topBar.module.scss`
- `FindIt/UI/src/mods/MainContainer/mainContainer.module.scss`
- `FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss`
- `FindIt/UI/src/mods/OptionsPanel/OptionsPanel.module.scss`
- `FindIt/UI/src/mods/PrefabItem/prefabItem.module.scss`

The inherited FindIt UI establishes these useful visible baselines:

| UI element | FindIt size | Notes |
| --- | ---: | --- |
| Search input | `16rem`, `21rem` line-height | The primary text-entry control. |
| Options labels | `14rem` | Uses `coh-font-fit-mode: shrink` for long labels. |
| Grid/list item text | `12rem` | Grid text is bounded and shrink-fitted; simple list rows are `20rem` high. |
| Panel title | `12rem` | The inherited FindIt panel title is intentionally compact. |
| Text-button icon | `30rem` with text, `24rem` icon-only | Defined by the shared button mixins. |

The installed base-game stylesheet is
`Cities2_Data/Content/Game/UI/index.css`. At its default scale it defines
`--fontSizeXXS` = `10rem`, `--fontSizeXS` = `12rem`, `--fontSizeS` =
`14rem`, `--fontSizeM` = `16rem`, followed by `18rem`, `20rem`, and `24rem`
larger steps. Its body uses `var(--fontSizeM)` and its standard controls use
the same `Overpass`/`Noto Sans` family as the successor's inherited UI.

## Successor values and findings

The pre-correction catalog used a wider range than the FindIt/base-game scale:

| Successor selector | Current size | Comparison | Finding |
| --- | ---: | --- | --- |
| `.title` | `16rem` | Base `M` | Appropriate for a panel heading. |
| `.subtitle`, `.category`, `.sortLabel`, `.columnHeader`, `.pageLabel` | `11rem` | Below base `XS` (`12rem`) and FindIt list text (`12rem`) | Too small for secondary labels at the checked viewport. |
| `.name` | `13rem` | Between base `XS` and `S` (`14rem`) | Usable but needlessly below the normal body step. |
| `.analytics` | `9rem` | Below base `XXS` (`10rem`) | Unreadable once rows are dense; should not be the default analytics size. |
| `.metric`/`.parking` | `12rem` | Base `XS` | Correct scale, but the narrow fixed cells still need layout room. |
| Compare title/name | `11rem` | Below base `XS` | Too small for a primary compare action/tray. |
| Compare count/buttons | `10rem` | Base `XXS` | Borderline for controls; currently contributes to the cramped tray. |
| Compare metrics and sort direction | `9rem` | Below base `XXS` | Too small for information users need to scan. |

### Reproducible geometry defects

The live DOM exposes two independent clipping/overlap causes:

1. **Sort and capacity buttons retain the shared icon-only button width.**
   The shared `.button_M6C` rule supplies `width: 24rem`. The successor adds
   only `min-width: 48rem` (sort) or `42rem` (capacity), so at 1280 × 720
   each sort button measured about 32 CSS pixels while labels such as
   `Category`, `Workers`, and `Capacity` needed 37–41 pixels. The labels
   therefore run into the next button. The screenshot shows the full sort
   sequence visually merging rather than forming separate controls.

2. **Catalog identity content is taller than each row.** The row has
   `min-height: 54rem` and its select child `min-height: 52rem`, but the
   identity contains name, category, and analytics lines. In the live DOM the
   identity was computed as `display: block`; its rectangle was roughly
   110 CSS pixels tall inside a row roughly 36 CSS pixels tall. The
   `9rem` analytics node alone reported a roughly 72-pixel rectangle and
   overflowed into adjacent rows. This is the direct cause of metadata being
   stacked over or obscuring neighboring entries.

The expanded panel increased the available width (about 693 CSS pixels versus
467 collapsed) but did not fix either defect: the sort labels still collided
and the row identity still overflowed. The compare tray was present and its
three-entry bound worked, but its `9–11rem` metadata was visibly undersized.
The Education & Research capacity controls were likewise present but tightly
packed; their labels inherit the same fixed-width button problem.

## Evidence

Settled live screenshots are archived at:

- `tools/e2e/artifacts/e2e-20260727-findit-ui-audit/baseline-building-lens-1280x720.png`
- `tools/e2e/artifacts/e2e-20260727-findit-ui-audit/expanded-building-lens-1280x720.png`

The original FindIt visual reference used for the comparison is
`cs2-findit-building-menu/FindIt/Properties/Screenshot_01.jpg`.

The live run opened the successor Building Lens, indexed 4,206 records,
exercised the expanded/collapsed layouts, filled the three-entry compare tray,
and opened Service Buildings → Education & Research capacity controls. The
Gameface error buffer was quiet during the observations.

## Correction pass applied

`FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss` now:

- sizes text-bearing sort, capacity, clear, and compare-place buttons to their
  labels instead of inheriting the shared icon-only `24rem` width;
- raises normal labels to the base-game `XS`/`S` steps and analytics/compare
  metadata to `XXS` rather than using unexplained `9rem` text;
- gives catalog rows/selectors `72/70rem` minimum height, makes identity a
  vertical flex column, and bounds each line with explicit line heights and
  overflow protection; and
- preserves flexbox-only layout and the existing FindIt placement/picker path.

Browserless tests and webpack compilation pass after this correction. A
settled live DOM measurement now confirms the corrected layout. The bounded
page summary and explicit row-scroll marker added after the baseline are
covered by the follow-up evidence below.

## Follow-up live assertion (2026-08-01)

The successor was redeployed to both isolated Mods roots and opened on the
developed save at 1280 × 720. The catalog rendered the readable footer
`Rows 1–100 of 4206 · Page 1 of 43`; advancing a page produced
`Rows 101–200 of 4206 · Page 2 of 43`, and Cost sorting returned to page one
with the `Cost▲` selection. The row viewport measured
`scrollHeight=6266/clientHeight=374` with `overflow-y=scroll`, and its header
exposed a visible `↕` marker (`data-scroll-hint=true`, `title="Scroll rows"`).
The Gameface console error buffer remained empty. The settled observations are
archived in
`tools/e2e/artifacts/e2e-20260801-building-lens-scroll-pagination-live/`.

The earlier 2026-07-27 paragraphs and screenshots remain historical baseline
evidence; they document the defects that motivated the correction and should
not be read as the current verification result.

## Recommended follow-up verification (historical checklist)

The next implementation pass should be kept focused and verified at the same
viewport before testing larger UI scales:

- allow text-bearing sort and capacity buttons to size to their contents;
- explicitly make the row identity a vertical flex column and give the row
  enough height for three bounded lines;
- move normal labels to the base-game/FindIt steps (`12–14rem`) and keep
  analytics/compare metadata at or above `10–12rem`;
- add explicit line heights plus `overflow: hidden`/ellipsis only after the
  content fits; and
- re-check collapsed, expanded, compare, paging, long-label, and
  Education-capacity states with settled Gameface screenshots and DOM bounds.

## Browserless/build status

Before any corrective CSS change, the existing contracts and build were green:

- UI contract tests: 6/6 (`cd FindIt/UI && npm test`)
- backend tests: 17/17 (`./build.sh test`)
- UI webpack build: passed (`./build.sh ui`)

These results validate the behavior contracts and compilation; the settled
live assertion above supplies the previously missing in-game evidence.
