# Tool-first Construction Surfaces for Building Lens

**Status:** Approved design; implementation pending

## Context

Building Lens is intended to replace the vanilla building menu with an information-centric table layered on top of FindIt. Its current contract deliberately contains only building and service-building records. That keeps the table useful and avoids pretending that a road, path, terrain brush, tree, prop, or vehicle is a building row.

The vanilla construction workflow still exposes those non-building surfaces, however. A replacement menu must provide a clear route to them without indexing every placeable network, prop, tree, or vehicle into the building table. A user who selects one of these surfaces must arrive at the native placement workflow, not remain in Building Lens with an unrelated list of building rows.

## Goals

1. Give Building Lens an explicit, discoverable affordance for non-building construction surfaces.
2. Describe surfaces with a small typed contract that is independent of ECS entities and easy to test and serialize.
3. Hand off to the native toolbar when a stable vanilla target is available.
4. Fail closed with a visible explanation when a target is missing, locked, ambiguous, or not yet supported.
5. Preserve the existing lens query, section selection, legacy FindIt mode, and vanilla toolbar ownership outside the handoff.

## Non-goals

- Do not scan and index all networks, paths, props, vegetation, or vehicles as building-table rows.
- Do not assign `ToolSystem` or individual tool systems directly from the first implementation slice.
- Do not redesign the table's current spacing, typography, metric columns, or pagination; those concerns are tracked by the existing UI audit/readability work.
- Do not change successor identity, licensing, publisher metadata, or release packaging.
- Do not add a second placement implementation; native tools remain the placement authority.

## Surface contract

The contract is transport-neutral. C# owns the canonical identifiers and serializable descriptors; the UI consumes a flat binding and does not need to know ECS entity IDs.

```text
ToolSurfaceId:
  Roads
  Paths
  LotTerraform
  Vegetation
  Props
  Vehicles

ToolSurfaceAction:
  NativeAssetMenu
  NativeAssetCategory
  NativeTool
  Unavailable

ToolSurfaceDescriptor:
  id: ToolSurfaceId
  icon: string
  tooltip: string
  action: ToolSurfaceAction
  aliases: string[]

ToolSurfaceAvailability:
  id: ToolSurfaceId
  enabled: bool
  reason: string

ToolSurfaceTarget (when enabled):
  action: ToolSurfaceAction
  entity: Entity | null
  alias: string
```

The exact C# representation may use records and enums, but the wire shape must remain flat, stable, and tolerant of an unavailable target. `id` values are stable strings at the UI boundary. `aliases` are data, not persisted entity IDs: they match the vanilla toolbar item's `uiTag` or localized/name fallback discovered at runtime.

The first supported descriptors are Roads, Paths, Lot/Terraform, Vegetation, Props, and Vehicles. A descriptor can be present while unavailable; absence is reserved for a surface that is intentionally not part of the current product contract.

## Placement in Building Lens

Lens mode gains a distinct **Tools** affordance. It is visually separate from the five building section tabs (`All Buildings`, `Zones`, `Signature Buildings`, `Service Buildings`, and `Favorites`) so that a tool surface cannot be mistaken for a building filter. The affordance may be a compact row or a dedicated tab, but it must be discoverable without opening the legacy FindIt category picker.

Each descriptor is represented by its icon and a short label/tooltip. Disabled entries remain visible when the game exposes the surface but the resolver cannot find a safe target. Their disabled state and reason communicate that the native tool is unavailable; they do not silently fall back to an unrelated building query.

Selecting an enabled surface does not mutate the current building query. It resolves the native target first, invokes the corresponding built-in toolbar trigger, and only then closes FindIt/Building Lens. Selecting an unavailable surface is a no-op for query and selection state, apart from the explanatory tooltip or diagnostic state.

Legacy FindIt mode remains unchanged. Handoff must not rewrite `CurrentCategory`, clear favorites, or alter the user's lens section. Reopening Building Lens after using a native tool should restore the last valid lens section and its query state, subject to the existing lifecycle behavior.

## Native target resolution and handoff

The UI already has generic `bindValue` and `trigger` access to built-in Gameface groups. The resolver uses the vanilla `toolbar.toolbarGroups` binding and, where a menu exposes a second level, `toolbar.assetCategories`.

The flow is:

1. Bind the current toolbar groups/categories and normalize each item to its entity, type, `uiTag`, name, icon, and lock state.
2. Resolve a descriptor's aliases against those runtime values. Prefer a stable `uiTag`; use a normalized name only as an explicit fallback. Ignore locked items and require a single unambiguous match.
3. Produce `ToolSurfaceAvailability` and, for an enabled match, a `ToolSurfaceTarget`.
4. Trigger `toolbar.selectAssetMenu(entity)` for a menu target, or `toolbar.selectAssetCategory(entity)` for a category target. A `NativeTool` target is reserved for a future binding with a documented native trigger; it is not implemented by assigning `ToolSystem` directly in this slice.
5. After a target has been resolved and the trigger has been issued, disable Building Lens/close the FindIt panel. The existing `OnToolChanged` behavior may also close the panel when the native tool becomes active; the handoff must remain idempotent if both paths run.

Entity IDs are runtime values only. No ID is hard-coded in a save, settings file, or descriptor. If the binding has not arrived, an alias is ambiguous, the item is locked, or the selected entity disappears between resolution and trigger, the surface is reported unavailable and the panel stays open.

## Failure handling and diagnostics

- Missing toolbar bindings produce disabled entries and a concise reason; they must not throw or leave a half-closed panel.
- Ambiguous alias matches produce a disabled entry and a diagnostic log entry containing the surface ID and candidate labels.
- Locked or missing targets produce a disabled entry and do not change the building query.
- Trigger failures are caught at the UI boundary where possible; the panel remains open and reports the surface as unavailable on the next binding update.
- Diagnostics must avoid logging entity IDs as durable configuration. Runtime IDs may be included in a debug message when needed to diagnose a failed handoff.

## Testing strategy

### Pure/UI tests

Browserless tests cover:

- descriptor order, stable IDs, and label/icon data;
- alias normalization and `uiTag`-before-name precedence;
- locked, missing, and ambiguous matches becoming unavailable;
- native menu/category trigger payloads;
- unavailable actions being no-ops;
- the Tools affordance remaining separate from the five building sections;
- legacy mode bindings remaining untouched;
- handoff closing the panel only after a valid target is resolved.

### C# tests

Pure tests cover stable surface IDs, descriptor serialization, normalization helpers, and the availability contract. They do not construct ECS worlds or depend on a live `ToolbarUISystem`.

### Live verification

With the game running under the CS2 game lock and the Gameface driving checklist:

- exercise one successful route for each resolved native menu/category;
- exercise each unavailable path (loading, locked, missing, and ambiguous target where reproducible);
- confirm the native toolbar/tool becomes active and Building Lens closes after success;
- confirm no building rows or page count remain visible after handoff;
- reopen Building Lens and confirm the previous valid lens section/query is stable;
- confirm legacy FindIt categories and normal building selection still behave as before.

The live checklist belongs in `docs/verification.md` once implementation exists. It must be run only after a settled main menu/world is visible; never attach Gameface CDP during the logo/loading screen.

## Rollout and extension

The first slice ships only mappings that can be discovered reliably from the current vanilla toolbar bindings. Unsupported surfaces remain explicitly unavailable rather than receiving speculative entity IDs or direct tool-system mutations. Adding a new surface later consists of adding a descriptor, aliases, a resolver test fixture, and a live verification case; it does not require changing the building-table data model.

## Acceptance criteria

- A separate Tools affordance is visible in Building Lens and does not appear as a building section.
- Roads, Paths, Lot/Terraform, Vegetation, Props, and Vehicles each have a stable descriptor and an explicit enabled/unavailable state.
- An enabled descriptor hands off through the built-in toolbar binding, then closes FindIt/Building Lens.
- An unavailable descriptor explains why and leaves the current building query and selection unchanged.
- No direct `ToolSystem` assignment or all-placeable ECS indexing is introduced by this slice.
- Pure UI and C# contract tests pass, and the live verification matrix confirms successful and failed handoffs without regressions to legacy FindIt behavior.
