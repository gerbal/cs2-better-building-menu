import { afterEach } from "node:test";
import type { ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer, type TestRendererOptions } from "react-test-renderer";

export interface MountedTree {
  /** Mounts the element inside act, so its effects run, as the running test's renderer. */
  mount(element: ReactElement, options?: TestRendererOptions): ReactTestRenderer;
  /** The renderer the running test mounted last. */
  readonly renderer: ReactTestRenderer;
  /** That renderer's root instance, where a test finds nodes. */
  readonly root: ReactTestInstance;
}

/**
 * A describe's mounted component, unmounted after each test. Call it in the describe body, ahead
 * of any afterEach that has to run once the component is gone.
 */
export function mountEach(): MountedTree {
  let renderer: ReactTestRenderer | undefined;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  return {
    mount(element, options) {
      act(() => {
        renderer = create(element, options);
      });
      return renderer!;
    },
    get renderer() {
      return renderer!;
    },
    get root() {
      return renderer!.root;
    },
  };
}
