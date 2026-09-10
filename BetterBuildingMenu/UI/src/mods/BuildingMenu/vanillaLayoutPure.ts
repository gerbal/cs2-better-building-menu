/**
 * The pure half of vanillaLayout.ts: what the two patches on vanilla's
 * layout do to an element, and how a stylesheet-module class is read. No
 * React and no `cs2/modding` here, so the test runner can load it.
 */

/** The two properties the lens patches on vanilla's elements. */
export type PatchedProperty = "justifyContent" | "zIndex";

const CSS_NAME: Record<PatchedProperty, string> = {
  justifyContent: "justify-content",
  zIndex: "z-index",
};

export interface StyledElement {
  style: { removeProperty(name: string): unknown } & Partial<Record<PatchedProperty, string>>;
}

/**
 * Set one inline style on an element we do not render, and return the restore.
 * The trap is restoring "": Cohtml reads it as a value and rejects it where a
 * browser unsets. So a previous value is assigned and an absent one REMOVED.
 */
export function setInlineStyle(element: StyledElement, property: PatchedProperty, value: string): () => void {
  const previous = element.style[property];
  element.style[property] = value;

  return () => {
    if (previous) {
      element.style[property] = previous;
      return;
    }

    element.style.removeProperty(CSS_NAME[property]);
  };
}

/**
 * The selector token of a stylesheet-module class. A module value can carry
 * more than one class and only the first names the element; null for a missing
 * key, so a caller can no-op rather than guess at a hashed name.
 */
export function firstClassToken(classes: unknown): string | null {
  if (typeof classes !== "string") {
    return null;
  }

  const token = classes.trim().split(/\s+/)[0];

  return token ? token : null;
}
