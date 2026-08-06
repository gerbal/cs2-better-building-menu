# Building Lens UX Fixes Design

## Goal

Make the Building Lens readable and operational at the current game viewport: show a clearly separated lens icon/title, reduce row height without losing the two-line identity, and expose the existing FindIt filter toggles inside the visible UI.

## Context and constraints

- The successor runs in Cities: Skylines II Coherent Gameface and must stay Flexbox-based; no CSS Grid or browser-only layout APIs.
- FindIt's C# `OptionsList`, `OptionClicked`, `AreFiltersSet`, and `ClearFilters` bindings remain the source of truth.
- The existing filter panel is already produced by `FindItOptionsUISystem`; the live defect is placement (`topPanel` content is above the viewport in the centered layout), not a second filter model.
- Rows must continue to expose the thumbnail, name, category/subcategory, metrics, placement action, and compare action.

## Design

### Title identity

The Building Lens heading gains the existing `BuildingZoneSignature.svg` icon inline before the localized title. The icon and title use a small explicit Flexbox gap (`6rem`) and share center alignment. The icon is decorative (`alt=""`) and the title remains the accessible text label. The existing subtitle and count stay in the same heading shell.

### Row density

The default row shell changes from 104/100rem (row/selector) to 92/88rem. Selector padding is reduced to 2rem vertically and the identity block is sized to 72rem, enough for the 18rem name line, 14rem category line, and a 1rem inter-line gap beside a 68rem thumbnail. Compact density uses 84/80rem. Metrics keep their existing columns, tooltips, and baseline alignment; only vertical chrome changes.

### Filter drawer placement and toggles

The shared options panel is rendered exactly once through `OptionsPanelComponent`. For the centered layout's overflow fallback, the panel is anchored at the top of the tool container rather than with a negative bottom offset. It receives a bounded max height and vertical scrolling so every option row remains reachable on short screens. The right/left alignment paths keep their current side placement.

`ExtraFiltersOption` explicitly identifies itself as a toggle group. Its existing option buttons continue to use `selected`, `disabled`, and `OptionClicked`; the visual selected border and click handler are retained. A filter toggle is verified by observing the selected class, the catalog refresh, and the enabled Clear Filters action. No filter behavior is duplicated in React.

## Error handling and compatibility

- If no options are returned, the drawer remains empty rather than inventing controls.
- If a filter is disabled by settings, its existing disabled state and no-op click path remain intact.
- The drawer's scroll is local to the panel; the catalog remains scrollable independently.
- All new CSS uses existing rem variables and selectors already supported by the game's Gameface version.

## Verification

- TypeScript tests cover the title icon contract, density thresholds, filter option rendering, selected-state classes, and the `OptionClicked` payload.
- Backend tests continue to cover catalog/filter contracts.
- UI build and workspace E2E unit checks must pass.
- Live verification at the current 1280×720 viewport confirms the filter drawer is on-screen, a toggle changes state/results, Clear Filters enables, title spacing is visible, and rows are denser without clipping identity text.
