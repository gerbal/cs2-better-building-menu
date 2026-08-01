# FindIt-led vanilla surface boundary

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

The FindIt successor already owns the catalog index, the legacy prefab grid,
the picker, the placement tool, and the locate flow. The Building Lens is the
new decision surface, but it currently reaches those flows by spelling raw
Gameface trigger names inside React components. That makes the lens look like
another engine integration instead of a view over FindIt's existing surface.

The older BMO remains the parity and rollback reference. It is not a runtime
dependency, is not changed by this slice, and must not be co-installed with
the successor.

## Goals

- Give the successor one named boundary for semantic handoffs from UI to
  FindIt's existing selection/placement, locate, filter-option, and picker
  paths.
- Keep Gameface components concerned with user intent (`activate this prefab`,
  `locate this prefab`, or `change this option`) rather than engine trigger
  names and argument ordering.
- Keep the existing `FindItUtil` index as the only catalog source. The
  boundary must never introduce an ECS scan or an unbounded UI payload.
- Preserve the vanilla/legacy grid when Building Lens is disabled, including
  the current picker, placement, and tool-options behavior.
- Make the semantic command payloads and the small game-side handoff policy
  testable without a running game.

## Non-goals

- Do not rewrite the FindIt index, picker, placement tool, or camera system.
- Do not add a second building catalog or copy the old BMO record source.
- Do not import LucaModsCommon or the AssetMenuTweaks build system.
- Do not change the old BMO project, deploy layout, publisher identity, or
  upstream license metadata.
- Do not add global settings/body classes or replace native panel components;
  AssetMenuTweaks contributes only the lesson that a thin, explicit adapter
  and native surface seams are safer than broad ownership.

## Design

### Game-side coordinator

Add a small `FindItInteractionBoundary` service under `FindIt/Services/`.
It owns only semantic policy and state that is currently duplicated at the
`FindItUISystem` trigger edge:

- prefab activation accepts a FindIt prefab id, rejects an unavailable or
  already-active id, and delegates the actual prefab-tool activation to an
  injected handoff;
- locate advances through the existing placed-entity sequence for a prefab,
  resetting the cycle when the id changes, and delegates the selected entity
  to the existing camera handoff;
- it does not resolve prefabs, query ECS, create bindings, or own a `ToolSystem`
  or camera. Those remain adapters in `FindItUISystem`.

The existing C# bindings (`SetCurrentPrefab` and
`OnLocateButtonClicked`) remain stable for compatibility. Their handlers become
thin adapters: resolve through `FindItUtil`/`PrefabTrackingSystem`, call the
boundary, then perform the existing `ToolSystem`/camera side effect and update
the active-id binding. This keeps the game-specific API in one system while
making the selection and locate policy independently testable.

Picker option application remains owned by `PickerUISystem`; ordinary FindIt
filter options remain owned by `FindItOptionsUISystem`. The boundary does not
steal either system's state. The UI port below is the shared seam that routes
to those existing owners.

### UI semantic port

Add a pure `findItSurfaceContracts.ts` module that defines a discriminated
union of semantic actions and their exact payloads:

- `activatePrefab(prefabId)`;
- `locatePrefab(prefabId)`;
- `findItOption(sectionId, optionId, value)`;
- `pickerOption(sectionId, optionId, value)`.

Add a small `findItSurfacePort.ts` adapter that is the only place those four
actions are translated to `trigger(mod.id, ...)` calls. The port exposes
methods with named arguments, so components cannot accidentally swap the
three integer option arguments or depend on a raw trigger string. Its default
implementation targets the existing bindings exactly; no backend binding
rename is required.

The existing catalog query/sort/paging contract remains pure and keeps its
current public helpers, but its placement/locate helpers return the semantic
surface commands rather than an untyped `{ method, args: any[] }` object.
The port adapter may translate those commands to the legacy trigger payload at
the boundary.

Wire the port into `BuildingCatalog`, `PrefabItem`, `PickerComponent`, and the
option callback in `MainContainer`. Other UI triggers that only control the
FindIt panel shell (scrolling, resizing, lock, close, and toolbar toggles)
remain local to those components; they are not vanilla handoffs and do not
need to be hidden behind this port.

### Ownership and invariants

```text
Building Lens / vanilla grid / picker UI
                |
        FindItSurfacePort
                |
   existing typed C# trigger bindings
       |          |          |
  FindIt UI   Picker UI   Options UI
       |
 FindItInteractionBoundary
       |
 ToolSystem / PrefabTrackingSystem / camera
```

- The port is a translation seam, not a second state store.
- The C# coordinator is a policy seam, not a second index or ECS system.
- The legacy grid remains the default when lens mode is off.
- The old BMO is a comparison artifact only.
- No deploy or live-game verification is part of this implementation slice;
  the verification checklist will record the required developed-save checks.

## Testing strategy

- Add focused C# unit tests for activation guards and locate-cycle behavior
  using injected delegates and synthetic ids/entities; do not start a game.
- Add browserless TypeScript tests for every semantic action's exact trigger
  method and argument order, including the three-integer picker/option path.
- Retain and run the existing catalog query, UI layout, and full UI build
  checks.
- Extend `docs/verification.md` with the boundary-specific live checklist:
  select/place from lens, place from compare, locate repeatedly and after an
  id change, picker option changes, and vanilla-grid parity with lens disabled.
