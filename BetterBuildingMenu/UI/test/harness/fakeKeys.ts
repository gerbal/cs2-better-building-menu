import { searchFieldClass } from "mods/TopRow/searchField";

/**
 * The page a key listener sees in the game, faked for node: a `document` that hears keydown only
 * in the capture phase, and a field that counts its blurs. Tests install the document as
 * `globalThis.document` and put theirs back.
 */
export type KeyListener = (event: never) => void;

/** A document that keeps its captured keydown listeners and says what has focus. */
export interface KeysDocument {
  activeElement: unknown;
  addEventListener(type: string, listener: KeyListener, capture?: boolean): void;
  removeEventListener(type: string, listener: KeyListener, capture?: boolean): void;
}

/** The fake document, and a way to send a keydown through what it captured. */
export interface KeysPage {
  document: KeysDocument;
  /** Sends `event` through every captured keydown listener, in the order they were added. */
  keydown(event: unknown): void;
  /** How many keydown listeners are captured now. */
  listeners(): number;
}

export function keysPage(activeElement: unknown = null): KeysPage {
  let keydown: KeyListener[] = [];
  return {
    document: {
      activeElement,
      // Only captured listeners hear a key typed in the asset menu: the game's app container stops
      // keydown before it bubbles to the document.
      addEventListener: (type, listener, capture) => {
        if (type === "keydown" && capture === true) keydown.push(listener);
      },
      removeEventListener: (type, listener, capture) => {
        if (type === "keydown" && capture === true) keydown = keydown.filter((other) => other !== listener);
      },
    },
    keydown: (event) => {
      for (const listener of [...keydown]) listener(event as never);
    },
    listeners: () => keydown.length,
  };
}

/**
 * A text field as a keydown reports it, a textarea as the game's TextInput draws it: its class, its
 * text, and how often it was blurred.
 */
export interface FakeField {
  tagName: "TEXTAREA";
  value: string;
  blurred: number;
  classList: { contains(name: string): boolean };
  blur(): void;
}

export function fakeField(className: string, value = ""): FakeField {
  const field: FakeField = {
    tagName: "TEXTAREA",
    value,
    blurred: 0,
    classList: { contains: (name) => name === className },
    blur() {
      field.blurred += 1;
    },
  };
  return field;
}

/** The top row's search field. */
export const fakeSearchField = (value = ""): FakeField => fakeField(searchFieldClass, value);
