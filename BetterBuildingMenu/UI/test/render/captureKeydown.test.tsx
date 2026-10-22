import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { installFakeBrowser } from "../harness/fakeBrowser";
import { mountEach } from "../harness/mount";
import { useCaptureKeydown } from "../../src/mods/useCaptureKeydown";

type KeyEvent = { keyCode: number };
type Listener = (event: KeyEvent) => void;
let captured: Listener[] = [];
let bubbled: Listener[] = [];

const press = (keyCode: number) => act(() => {
  for (const listener of [...captured]) listener({ keyCode });
});

const Probe = ({ onKeyDown }: { onKeyDown: ((event: KeyboardEvent) => void) | null }) => {
  useCaptureKeydown(onKeyDown);
  return null;
};

describe("a keydown listener on the document", () => {
  const tree = mountEach();
  let restore: () => void;

  beforeEach(() => {
    captured = [];
    bubbled = [];
    ({ restore } = installFakeBrowser({
      frames: "none",
      document: {
        addEventListener: (type: string, listener: Listener, capture?: boolean) => {
          if (type === "keydown") (capture === true ? captured : bubbled).push(listener);
        },
        removeEventListener: (type: string, listener: Listener, capture?: boolean) => {
          if (type !== "keydown") return;
          if (capture === true) captured = captured.filter((other) => other !== listener);
          else bubbled = bubbled.filter((other) => other !== listener);
        },
      },
    }));
  });

  afterEach(() => restore());

  it("listens in the capture phase, which the game's app container cannot stop", () => {
    const heard: number[] = [];
    tree.mount(<Probe onKeyDown={(event) => heard.push(event.keyCode)} />);

    press(27);

    assert.deepEqual(heard, [27]);
    assert.equal(captured.length, 1);
    assert.equal(bubbled.length, 0);
  });

  it("calls the newest handler through the one listener", () => {
    const heard: string[] = [];
    tree.mount(<Probe onKeyDown={() => heard.push("first")} />);
    const [listener] = captured;

    act(() => {
      tree.renderer.update(<Probe onKeyDown={() => heard.push("second")} />);
    });
    press(13);

    assert.deepEqual(heard, ["second"]);
    assert.deepEqual(captured, [listener]);
  });

  it("lets go of the document while it has no handler, and when it unmounts", () => {
    const handler = () => undefined;
    tree.mount(<Probe onKeyDown={null} />);
    assert.equal(captured.length, 0);

    act(() => {
      tree.renderer.update(<Probe onKeyDown={handler} />);
    });
    assert.equal(captured.length, 1);

    act(() => {
      tree.renderer.update(<Probe onKeyDown={null} />);
    });
    assert.equal(captured.length, 0);

    act(() => {
      tree.renderer.update(<Probe onKeyDown={handler} />);
    });
    act(() => tree.renderer.unmount());
    assert.equal(captured.length, 0);
  });
});
