import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { huggingNames, linesOf, plannedNames, settleFrames } from "../harness/huggingNames";
import { PlannedName } from "../../src/mods/Bodies/PlannedName";

const globals = globalThis as unknown as Record<string, unknown>;
const FAKED = ["window", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver"] as const;

describe("a planned name in a box that hugs its lines", () => {
  let root: ReactTestRenderer | undefined;
  let saved: Record<string, unknown>;
  const frames = new Map<number, () => void>();
  let handles = 0;

  beforeEach(() => {
    saved = Object.fromEntries(FAKED.map((name) => [name, globals[name]]));
    frames.clear();
    // A rem a pixel.
    globals.window = { innerHeight: 1080 };
    globals.requestAnimationFrame = (run: () => void) => { handles += 1; frames.set(handles, run); return handles; };
    globals.cancelAnimationFrame = (handle: number) => frames.delete(handle);
    globals.ResizeObserver = class { observe() { return undefined; } disconnect() { return undefined; } };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  it("keeps a name that fits its room whole, frame after frame, never planning in a room narrower than its widest line", () => {
    // The hover card's room at 130% text: 195 rem, the name's type 16.9 rem. The game's font draws the
    // line narrower than the estimate, and the box is only as wide as that line.
    act(() => {
      root = create(<PlannedName name="Four-Lane Road 1" width={195} lines={3} font={16.9} marked={false} />, { createNodeMock: huggingNames(() => root!) });
    });
    settleFrames(frames);

    assert.deepEqual(linesOf(plannedNames(root!)[0]), ["Four-Lane Road 1"]);
  });
});
