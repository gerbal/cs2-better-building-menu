import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { fakeField, fakeSearchField, keysPage, type KeysPage } from "../harness/fakeKeys";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { useSearchFieldKeys } from "../../src/mods/BuildingCatalog/useSearchFieldKeys";

const globals = globalThis as unknown as Record<string, unknown>;
let page: KeysPage = keysPage();

/**
 * A list of 20-pixel rows in a 100-tall scroller that keeps whatever scroll it is given, as an
 * engine need not clamp one, under a root that finds the rows.
 */
function fakeList(count: number) {
  const scroller = { clientHeight: 100, scrollHeight: count * 20, scrollTop: 0, parentElement: null as unknown };
  const rows = Array.from({ length: count }, () => ({ parentElement: scroller }));
  const root = { scrollHeight: 100, clientHeight: 100, parentElement: null, querySelectorAll: () => rows };
  scroller.parentElement = root;
  return { ref: { current: root } as unknown as RefObject<HTMLElement>, scroller };
}

/** A key from `target`, recording whether a listener kept it from the field. */
function press(key: string, keyCode: number, target: unknown = fakeSearchField()) {
  const event = {
    key,
    keyCode,
    target,
    prevented: false,
    preventDefault() {
      event.prevented = true;
    },
  };
  act(() => page.keydown(event));
  return event;
}

const moves = () => triggers.filter((call) => call.name === "MoveEnterTarget").map((call) => call.args[0]);

const Probe = ({ list, canMove, answered = "rail\n0", pitch = 0, gap }: { list: RefObject<HTMLElement>; canMove: boolean; answered?: string; pitch?: number; gap?: number }) => {
  useSearchFieldKeys(list, canMove, answered, pitch, gap);
  return null;
};

describe("the search field's keys", () => {
  let root: ReactTestRenderer | undefined;
  const saved = globals.document;

  beforeEach(() => {
    resetBindings();
    page = keysPage();
    globals.document = page.document;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  const mount = (list: ReturnType<typeof fakeList>, canMove = true) =>
    act(() => {
      root = create(<Probe list={list.ref} canMove={canMove} answered="rail\n0" />);
    });

  /** The page answers: what the box was given to tell one page from the next changes. */
  const answer = (list: ReturnType<typeof fakeList>, answered: string) =>
    act(() => root?.update(<Probe list={list.ref} canMove answered={answered} />));

  it("moves Enter's target a row down on Down and up on Up, from the search field", () => {
    const list = fakeList(50);
    mount(list);

    const down = press("ArrowDown", 40);
    answer(list, "rail\n1");
    press("", 38);

    assert.deepEqual(moves(), [1, -1]);
    assert.equal(down.prevented, true, "the one-line field has no use for it");
  });

  it("sends one move while a key repeats before the page answers, and the next once it has", () => {
    const list = fakeList(50);
    mount(list);

    const repeats = [press("ArrowDown", 40), press("ArrowDown", 40), press("ArrowDown", 40)];
    assert.deepEqual(moves(), [1], "one move in flight");
    assert.ok(repeats.every((event) => event.prevented), "the dropped repeats still keep the caret in place");

    answer(list, "rail\n1");
    press("ArrowDown", 40);
    press("ArrowDown", 40);

    assert.deepEqual(moves(), [1, 1]);
  });

  it("takes the next move once a page lands for a new query", () => {
    const list = fakeList(50);
    mount(list);

    press("ArrowDown", 40);
    answer(list, "railw\n0");
    press("ArrowUp", 38);

    assert.deepEqual(moves(), [1, -1]);
  });

  it("takes the next move after a moment when the page never changes, as when a move ran past an end", () => {
    mock.timers.enable({ apis: ["setTimeout"] });

    try {
      mount(fakeList(50));

      press("ArrowDown", 40);
      press("ArrowDown", 40);
      assert.deepEqual(moves(), [1]);

      act(() => mock.timers.tick(300));
      press("ArrowUp", 38);

      assert.deepEqual(moves(), [1, -1]);
    } finally {
      mock.timers.reset();
    }
  });

  it("pages whole lines of the body, where the body has lines", () => {
    const savedWindow = globals.window;
    // 1,080 pixels tall: a rem is a pixel.
    globals.window = { innerHeight: 1080 };
    const list = fakeList(50);
    act(() => {
      root = create(<Probe list={list.ref} canMove pitch={29.25} />);
    });

    press("PageDown", 34);
    const down = list.scroller.scrollTop;
    globals.window = savedWindow;

    // Three whole 29.25 lines fit the 100-pixel screen.
    assert.equal(down, 87.75);
  });

  it("pages the body's lines and their gaps in pixels, however tall the screen", () => {
    const savedWindow = globals.window;
    // 2,160 pixels tall: a rem is two pixels, so the game's own 144.25 rem body is 288.5.
    globals.window = { innerHeight: 2160 };
    const list = fakeList(50);
    list.scroller.clientHeight = 288.5;
    act(() => {
      root = create(<Probe list={list.ref} canMove pitch={29.25} />);
    });

    press("PageDown", 34);
    const down = list.scroller.scrollTop;
    globals.window = savedWindow;

    // All five lines, 58.5 pixels apart: the last needs no gap below it.
    assert.equal(down, 292.5);
  });

  it("pages whole rows of cards, their own gap between: three rows from the top at the default height", () => {
    const savedWindow = globals.window;
    // 1,080 pixels tall: a rem is a pixel, and the scroller is the game's own 144.25 body.
    globals.window = { innerHeight: 1080 };
    const list = fakeList(50);
    list.scroller.clientHeight = 144.25;
    act(() => {
      root = create(<Probe list={list.ref} canMove pitch={49.125} gap={3.125} />);
    });

    press("PageDown", 34);
    const down = list.scroller.scrollTop;
    globals.window = savedWindow;

    // Three 46 rem rows 3.125 apart fill the body: the page lands the fourth row on the top edge.
    assert.equal(down, 147.375);
  });

  it("moves nothing while there is no target to move", () => {
    // The page still answers an older query, or every match is locked.
    mount(fakeList(50), false);

    press("ArrowDown", 40);

    assert.deepEqual(moves(), []);
  });

  it("leaves the keys to the camera when the field does not have them", () => {
    const list = fakeList(50);
    mount(list);

    const fromNowhere = press("ArrowDown", 40, { tagName: "DIV" });
    const fromARange = press("PageDown", 34, fakeField("range"));

    assert.deepEqual(moves(), []);
    assert.equal(list.scroller.scrollTop, 0);
    assert.equal(fromNowhere.prevented, false);
    assert.equal(fromARange.prevented, false);
  });

  it("scrolls the list a screen on PageDown and PageUp, and no further than its ends", () => {
    // Fifty rows of 20 in a 100-tall viewport: the scroll runs 0-900.
    const list = fakeList(50);
    mount(list);

    press("PageDown", 34);
    assert.equal(list.scroller.scrollTop, 100);

    list.scroller.scrollTop = 850;
    press("PageDown", 34);
    assert.equal(list.scroller.scrollTop, 900);

    list.scroller.scrollTop = 50;
    press("", 33);
    assert.equal(list.scroller.scrollTop, 0);
    assert.deepEqual(moves(), []);
  });

  it("lets go of the document when it unmounts", () => {
    mount(fakeList(50));
    assert.equal(page.listeners(), 1);

    act(() => root?.unmount());
    root = undefined;

    assert.equal(page.listeners(), 0);
  });
});
