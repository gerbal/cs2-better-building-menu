/**
 * The picker's "open the menu this building lives in", crossing the bridge.
 *
 * `toolbar.selectAssetMenu` is a TRIGGER binding, so only the UI can call it —
 * C# has no route, `ToolbarUISystem.SelectAssetMenu` being private. The backend
 * therefore publishes a request as a value and this parses it.
 *
 * Wire format is `"<index>:<version>:<nonce>"`. Flat, because the bridge is
 * happier with primitives than with a nested object, and because the nonce has
 * to travel with the entity: picking the same building twice publishes the same
 * index and version, and an unchanged binding emits nothing at all.
 */

export interface PickerMenuRequest {
  /** ECS entity index of the menu to open. */
  index: number;
  /** Entity version. An entity handle without it is not valid. */
  version: number;
  /** Rises on every request, so a repeat of the same menu still registers. */
  nonce: number;
}

/**
 * Parses a request, or returns null for anything malformed.
 *
 * Null rather than a throw: this runs in a render path, and a request we cannot
 * read should leave the toolbar alone rather than take the UI down. Empty is
 * the ordinary resting value, not an error.
 */
export function parsePickerMenuRequest(raw: string | null | undefined): PickerMenuRequest | null {
  if (!raw) {
    return null;
  }

  const parts = raw.split(":");

  if (parts.length !== 3) {
    return null;
  }

  const [index, version, nonce] = parts.map(Number);

  if (!Number.isFinite(index) || !Number.isFinite(version) || !Number.isFinite(nonce)) {
    return null;
  }

  // Index 0 is Entity.Null, which selects nothing and would look like a close.
  if (index <= 0) {
    return null;
  }

  return { index, version, nonce };
}

/** The entity shape the game's own toolbar binding hands out and takes back. */
export function toolbarEntityArg(request: PickerMenuRequest): { index: number; version: number } {
  return { index: request.index, version: request.version };
}
