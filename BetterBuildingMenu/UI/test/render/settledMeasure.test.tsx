import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { useRef, type ReactElement } from "react";
import { act } from "react-test-renderer";
import { installFakeBrowser } from "../harness/fakeBrowser";
import { mountEach } from "../harness/mount";
import { useSettledMeasure } from "../../src/mods/useSettledMeasure";

const globals = globalThis as unknown as Record<string, unknown>;

/** The ResizeObserver Node lacks; a test reports a resize by calling its callback. */
class FakeObserver {
  static made: FakeObserver[] = [];
  readonly observed: unknown[] = [];
  disconnected = false;

  constructor(readonly resized: () => void) {
    FakeObserver.made.push(this);
  }

  observe(element: unknown): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

/** The element the probe's ref holds, as the renderer's node mock. */
const drawn = { drawn: true };
let reads: unknown[] = [];

const Probe = ({ text, measured = true }: { text: string; measured?: boolean }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useSettledMeasure(ref, measured ? (element) => reads.push(element) : null, [text, measured]);
  return <span ref={ref}>{text}</span>;
};

describe("a measurement of what was drawn", () => {
  const tree = mountEach();
  const mount = (element: ReactElement) => tree.mount(element, { createNodeMock: () => drawn });
  let nextFrame: () => void;
  let restore: () => void;

  beforeEach(() => {
    reads = [];
    FakeObserver.made = [];
    ({ nextFrame, restore } = installFakeBrowser({ frames: "manual" }));
    globals.ResizeObserver = FakeObserver;
  });

  afterEach(() => {
    delete globals.ResizeObserver;
    restore();
  });

  it("reads the element two frames after the render that drew it, never sooner", () => {
    mount(<Probe text="Clinic" />);
    assert.deepEqual(reads, [], "nothing in the render's own tick");

    nextFrame();
    assert.deepEqual(reads, [], "nothing a frame later");

    nextFrame();
    assert.deepEqual(reads, [drawn]);
  });

  it("reads again two frames after the element resizes, once for a burst of resizes", () => {
    mount(<Probe text="Clinic" />);
    nextFrame();
    nextFrame();
    const [observer] = FakeObserver.made;
    assert.deepEqual(observer.observed, [drawn]);

    act(() => {
      observer.resized();
      observer.resized();
    });
    nextFrame();
    assert.equal(reads.length, 1, "the resize waits a frame too");

    nextFrame();
    assert.equal(reads.length, 2);
  });

  it("reads new text afresh, and stops watching what the old one drew", () => {
    mount(<Probe text="Clinic" />);
    nextFrame();
    nextFrame();

    act(() => {
      tree.renderer.update(<Probe text="Hospital" />);
    });
    nextFrame();
    nextFrame();

    assert.equal(reads.length, 2);
    assert.equal(FakeObserver.made[0].disconnected, true);
    assert.equal(FakeObserver.made.length, 2);
  });

  it("reads nothing once the element has gone", () => {
    mount(<Probe text="Clinic" />);
    nextFrame();
    act(() => tree.renderer.unmount());
    nextFrame();

    assert.deepEqual(reads, []);
    assert.equal(FakeObserver.made[0].disconnected, true);
  });

  it("schedules and watches nothing without a measurement", () => {
    mount(<Probe text="Clinic" measured={false} />);
    nextFrame();
    nextFrame();

    assert.deepEqual(reads, []);
    assert.equal(FakeObserver.made.length, 0);
  });

  it("still reads two frames after the draw where there is no ResizeObserver", () => {
    delete globals.ResizeObserver;
    mount(<Probe text="Clinic" />);
    nextFrame();
    assert.deepEqual(reads, []);

    nextFrame();
    assert.deepEqual(reads, [drawn]);
  });
});
