/**
 * An element as a walk over the game's page reads it, faked for node: its classes, its children,
 * what a selector finds in it, and its rectangle. Tests install the class as `globalThis.HTMLElement`
 * so an `instanceof` check passes, and put theirs back.
 */
export interface FakeRect {
  left: number;
  width: number;
}

export class FakeElement {
  classList: { contains: (name: string) => boolean };
  children: FakeElement[];
  /** What `querySelector` answers, by selector. */
  found: Record<string, FakeElement>;
  rect: FakeRect;

  constructor(classes: string[], children: FakeElement[] = [], rect: FakeRect = { left: 0, width: 0 }) {
    this.classList = { contains: (name) => classes.includes(name) };
    this.children = children;
    this.found = {};
    this.rect = rect;
  }

  querySelector(selector: string): FakeElement | null {
    return this.found[selector] ?? null;
  }

  getBoundingClientRect(): FakeRect {
    return this.rect;
  }
}
