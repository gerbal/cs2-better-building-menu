/**
 * How the vanilla toolbar identifies one of its own entries: an ECS entity,
 * arriving as a bare index, a string, or an {index, version} pair, so a reader
 * accepts all three. Indices are RUNTIME values and must never be persisted.
 */

export interface ToolbarEntityRef {
  index: number;
  version?: number;
}

export type ToolbarEntity = number | string | ToolbarEntityRef;
