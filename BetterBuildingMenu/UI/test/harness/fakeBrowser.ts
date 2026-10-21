import { act } from "react-test-renderer";

const globals = globalThis as unknown as Record<string, unknown>;

/** A document whose listeners go nowhere and whose queries find nothing. */
const inertDocument = (): object => ({ addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null });

export interface FakeBrowser {
  /** Runs, inside act, the frames requested so far; a frame they request waits for the next call. */
  nextFrame(): void;
  /** Puts back the document and frame clock that were there before. */
  restore(): void;
}

/**
 * The document and frame clock a mounted component's effects reach for, which Node lacks.
 * Under "manual" a frame runs only at nextFrame and a cancel drops it; under "none" no frame ever runs.
 */
export function installFakeBrowser({ frames, document = inertDocument() }: { frames: "manual" | "none"; document?: object }): FakeBrowser {
  const saved = {
    document: globals.document,
    requestAnimationFrame: globals.requestAnimationFrame,
    cancelAnimationFrame: globals.cancelAnimationFrame,
  };
  let due: Array<(() => void) | null> = [];

  globals.document = document;
  if (frames === "manual") {
    globals.requestAnimationFrame = (callback: () => void) => due.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) due[handle - 1] = null;
    };
  } else {
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  }

  return {
    nextFrame() {
      act(() => {
        const running = due;
        due = [];
        for (const callback of running) callback?.();
      });
    },
    restore() {
      Object.assign(globals, saved);
    },
  };
}
