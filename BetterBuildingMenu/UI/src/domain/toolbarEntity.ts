/**
 * How the vanilla toolbar identifies one of its own entries.
 *
 * The game's `toolbar.selectedAssetMenu` binding hands out an ECS entity, and
 * it arrives in more than one shape depending on the binding: a bare index, a
 * string, or an {index, version} pair. Anything reading that binding has to
 * accept all three.
 *
 * Entity indices are runtime values. They are safe to compare within a session
 * and must never be persisted or written into a save — resolving one to a
 * prefab name belongs on the C# side, where the prefab system is available.
 */

export interface ToolbarEntityRef {
  index: number;
  version?: number;
}

export type ToolbarEntity = number | string | ToolbarEntityRef;
