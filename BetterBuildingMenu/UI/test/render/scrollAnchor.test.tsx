import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  getAssetMenuAnchor,
  getAssetMenuListStart,
  resetAssetMenuView,
  setAssetMenuAnchor,
  setAssetMenuListStart,
} from "../../src/domain/assetMenuViewStore";
import { CATALOG_ANCHOR_MAX_FRAMES } from "../../src/domain/catalogWindow";
import { useCatalogWindow } from "../../src/mods/BuildingCatalog/useCatalogWindow";
import { useScrollAnchor, type ListStartPage } from "../../src/mods/BuildingCatalog/useScrollAnchor";
import { catalogPage, entry } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";

const globals = globalThis as unknown as Record<string, unknown>;
const KEY = "catalog|cards|menuCategory";
const ROW = 20;
const VIEWPORT = 100;
const TOP = 50;

/**
 * A list as the hook measures it, in CSS pixels: rows of 20 in a 100-tall scroller that clamps its
 * scroll as an engine does, under a root that finds rows by entry id. Row N is entry N.
 */
function fakeList(count: number) {
  let scrolled = 0;
  // How far a late re-layout has pushed every row down, as Cohtml re-wrapping the cards above them does.
  let pushed = 0;
  const end = () => count * ROW + pushed - VIEWPORT;
  const scroller = {
    clientHeight: VIEWPORT,
    get scrollHeight() {
      return count * ROW + pushed;
    },
    get scrollTop() {
      return scrolled;
    },
    set scrollTop(value: number) {
      scrolled = Math.max(0, Math.min(value, end()));
    },
    parentElement: null as unknown,
    getBoundingClientRect: () => ({ top: TOP, height: VIEWPORT }),
  };
  const rows = Array.from({ length: count }, (_, at) => ({
    id: at + 1,
    parentElement: scroller,
    getBoundingClientRect: () => ({ top: TOP + at * ROW + pushed - scrolled, height: ROW }),
  }));
  const root = {
    scrollHeight: VIEWPORT,
    clientHeight: VIEWPORT,
    parentElement: null,
    querySelectorAll: (selector: string) => {
      const id = /data-catalog-entry="(\d+)"/.exec(selector)?.[1];
      return id === undefined ? rows : rows.filter((row) => row.id === Number(id));
    },
  };
  scroller.parentElement = root;

  return {
    ref: { current: root } as unknown as RefObject<HTMLElement>,
    scroller,
    /** Where a row's top sits below the top of the list's viewport: 0 is line 1. */
    offsetOf: (id: number) => (id - 1) * ROW + pushed - scrolled,
    /** A late re-layout: every row drops a line, with no scroll set. */
    rewrap: () => {
      pushed += ROW;
    },
  };
}

const Probe = ({ list, page }: { list: RefObject<HTMLElement>; page: ListStartPage }) => {
  useScrollAnchor(list, KEY, page);
  return null;
};

/** Both hooks, in the catalog's order: the load-more poll's frames run before the move's. */
const CatalogProbe = ({ list }: { list: RefObject<HTMLElement> }) => {
  const { anchorId, anchorIndex, listStart, items } = useCatalogWindow(list, { viewMode: "cards", groupBy: "none" });
  useScrollAnchor(list, KEY, { listStart, anchorId, anchorIndex, itemCount: items.length });
  return null;
};

describe("where the list goes when a page lands", () => {
  let root: ReactTestRenderer | undefined;
  let frames = new Map<number, () => void>();
  let handles = 0;
  // Whether cancelAnimationFrame drops nothing, as a frame already queued in an engine can still run.
  let cancelMisses = false;

  /** One frame: the callbacks asked for before it, run as the engine runs them. */
  const tick = () => {
    const due = [...frames.values()];
    frames = new Map();
    due.forEach((frame) => frame());
  };

  /** The frames the hook asks for, up to a bound. */
  const flush = () => {
    for (let pass = 0; pass < 60 && frames.size > 0; pass++) {
      tick();
    }
  };

  const mount = (list: ReturnType<typeof fakeList>, page: ListStartPage) =>
    act(() => {
      root = create(<Probe list={list.ref} page={page} />);
    });

  const land = (list: ReturnType<typeof fakeList>, page: ListStartPage) =>
    act(() => {
      root!.update(<Probe list={list.ref} page={page} />);
    });

  beforeEach(() => {
    resetAssetMenuView();
    frames = new Map();
    cancelMisses = false;
    globals.requestAnimationFrame = (callback: () => void) => {
      frames.set(++handles, callback);
      return handles;
    };
    globals.cancelAnimationFrame = (handle: number) => {
      if (!cancelMisses) frames.delete(handle);
    };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("puts the anchored row on line 1 at a new start, and keeps it for a remount in the store", () => {
    const list = fakeList(250);

    mount(list, { listStart: 1, anchorId: 150, anchorIndex: 149, itemCount: 250 });
    flush();

    assert.equal(list.offsetOf(150), 0);
    assert.equal(getAssetMenuListStart(), 1);
    assert.equal(getAssetMenuAnchor(KEY), 150);
  });

  it("starts the list at its top after a sort, and drops the row it kept", () => {
    const list = fakeList(250);
    list.scroller.scrollTop = 1200;
    setAssetMenuListStart(1);
    setAssetMenuAnchor(KEY, 150);

    mount(list, { listStart: 2, anchorId: 0, anchorIndex: -1, itemCount: 250 });
    flush();

    assert.equal(list.scroller.scrollTop, 0);
    assert.equal(getAssetMenuAnchor(KEY), null);
    assert.equal(getAssetMenuListStart(), 2);
  });

  it("leaves the list where it is when a page lands without a new start", () => {
    // A search, a filter or more rows: the place the player scrolled to stays.
    const list = fakeList(400);
    list.scroller.scrollTop = 600;
    setAssetMenuListStart(4);

    mount(list, { listStart: 4, anchorId: 150, anchorIndex: 149, itemCount: 250 });
    land(list, { listStart: 4, anchorId: 150, anchorIndex: 149, itemCount: 350 });
    flush();

    assert.equal(list.scroller.scrollTop, 600);
  });

  it("carries a start's move on when a page of the same start lands mid-move without the anchor", () => {
    // A search or a filter typed while the list is still moving clears the anchor and starts nothing.
    const list = fakeList(250);

    mount(list, { listStart: 1, anchorId: 150, anchorIndex: 149, itemCount: 250 });
    tick();
    land(list, { listStart: 1, anchorId: 0, anchorIndex: -1, itemCount: 250 });
    flush();

    assert.equal(list.offsetOf(150), 0);
    assert.equal(getAssetMenuListStart(), 1);
    assert.equal(getAssetMenuAnchor(KEY), 150);
  });

  it("brings the kept row back once on a remount, then leaves the list to the player", () => {
    const list = fakeList(250);
    setAssetMenuListStart(3);
    setAssetMenuAnchor(KEY, 120);

    mount(list, { listStart: 3, anchorId: 120, anchorIndex: 119, itemCount: 250 });
    flush();
    const offset = list.offsetOf(120);
    assert.ok(offset >= 0 && offset < VIEWPORT, `row 120 at ${offset}`);

    // The player scrolls back up, and more rows arrive: the list stays where they put it.
    list.scroller.scrollTop = 0;
    land(list, { listStart: 3, anchorId: 120, anchorIndex: 119, itemCount: 300 });
    flush();

    assert.equal(list.scroller.scrollTop, 0);
    assert.equal(getAssetMenuAnchor(KEY), 120);
  });

  it("sets the scroll again when a late re-layout drops the row off line 1 the frame after it got there", () => {
    // On a fresh mount Cohtml can re-wrap the cards above the row one frame after the set: one
    // reading on line 1 is not the end of the move.
    const list = fakeList(250);

    mount(list, { listStart: 1, anchorId: 150, anchorIndex: 149, itemCount: 250 });
    tick();
    tick();
    assert.equal(list.offsetOf(150), 0);
    list.rewrap();
    flush();

    assert.equal(list.offsetOf(150), 0);
    assert.equal(getAssetMenuListStart(), 1);
    assert.equal(getAssetMenuAnchor(KEY), 150);
  });

  it("sets the top again when the scroller does not read 0 on the frame after the set", () => {
    const list = fakeList(250);
    list.scroller.scrollTop = 1200;
    setAssetMenuListStart(1);

    mount(list, { listStart: 2, anchorId: 0, anchorIndex: -1, itemCount: 250 });
    tick();
    assert.equal(list.scroller.scrollTop, 0);
    list.scroller.scrollTop = 600;
    flush();

    assert.equal(list.scroller.scrollTop, 0);
    assert.equal(getAssetMenuListStart(), 2);
  });

  it("holds a row in the list's last screen in view where the scroll stops", () => {
    const list = fakeList(250);

    mount(list, { listStart: 1, anchorId: 248, anchorIndex: 247, itemCount: 250 });
    flush();

    assert.equal(list.scroller.scrollTop, 250 * ROW - VIEWPORT);
    assert.equal(getAssetMenuListStart(), 1);
  });

  it("leaves the list alone when a tile armed after the mount's first page is kept, and a page lands", () => {
    // The mount's first page planned nothing; arming writes the store, and a search, a filter or
    // Load more is not a remount.
    const list = fakeList(400);
    list.scroller.scrollTop = 600;
    setAssetMenuListStart(4);

    mount(list, { listStart: 4, anchorId: 0, anchorIndex: -1, itemCount: 250 });
    flush();
    setAssetMenuAnchor(KEY, 200);
    land(list, { listStart: 4, anchorId: 0, anchorIndex: -1, itemCount: 350 });
    flush();

    assert.equal(list.scroller.scrollTop, 600);
  });

  it("still brings the kept row back when a page lands mid-restore", () => {
    // The window is still arriving from C# on a remount: the next page plans the restore again.
    const list = fakeList(250);
    setAssetMenuListStart(3);
    setAssetMenuAnchor(KEY, 120);

    mount(list, { listStart: 3, anchorId: 120, anchorIndex: 119, itemCount: 200 });
    land(list, { listStart: 3, anchorId: 120, anchorIndex: 119, itemCount: 250 });
    flush();

    const offset = list.offsetOf(120);
    assert.ok(offset >= 0 && offset < VIEWPORT, `row 120 at ${offset}`);
  });

  it("asks for no more rows while a new start's move to the top is under way", () => {
    // A sort from a deep scroll: the shorter page lands with the old scroll at its end, and the
    // load-more poll reads it there before the move to the top has landed.
    const realNow = Date.now;
    let clock = 0;
    Date.now = () => clock;

    try {
      resetBindings();
      const list = fakeList(100);
      list.scroller.scrollTop = 100 * ROW - VIEWPORT;
      setAssetMenuListStart(1);
      const page = catalogPage(Array.from({ length: 100 }, (_, at) => entry(at + 1)), {
        hasMore: true, totalCount: 308, listStart: 2, anchorId: 0, anchorIndex: -1,
      });
      setBinding("BetterBuildingMenu", "BuildingCatalog", page);
      const loadMores = () => triggers.filter((call) => call.name === "LoadMoreBuildingCatalog");

      act(() => {
        root = create(<CatalogProbe list={list.ref} />);
      });

      for (let pass = 0; pass < 60 && frames.size > 0; pass++) {
        clock += 100;
        tick();
      }

      assert.equal(list.scroller.scrollTop, 0);
      assert.equal(getAssetMenuListStart(), 2);
      assert.deepEqual(loadMores(), []);

      // Once the move has landed, the bottom of the list asks for more again.
      list.scroller.scrollTop = 100 * ROW - VIEWPORT;
      for (let pass = 0; pass < 3; pass++) {
        clock += 100;
        tick();
      }

      assert.deepEqual(loadMores().map((call) => call.args), [[200]]);
    } finally {
      Date.now = realNow;
    }
  });

  it("lets the load-more poll go when a start's move gives up at its frame budget", () => {
    // The anchored row never renders: the move runs out its frames, and the list is the player's again.
    const realNow = Date.now;
    let clock = 0;
    Date.now = () => clock;

    try {
      resetBindings();
      const list = fakeList(100);
      list.scroller.scrollTop = 100 * ROW - VIEWPORT;
      setAssetMenuListStart(1);
      setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(Array.from({ length: 100 }, (_, at) => entry(at + 1)), {
        hasMore: true, totalCount: 308, listStart: 2, anchorId: 999, anchorIndex: 50,
      }));
      const loadMores = () => triggers.filter((call) => call.name === "LoadMoreBuildingCatalog").map((call) => call.args);
      const frames = (count: number) => {
        for (let pass = 0; pass < count; pass++) {
          clock += 100;
          tick();
        }
      };

      act(() => {
        root = create(<CatalogProbe list={list.ref} />);
      });
      frames(CATALOG_ANCHOR_MAX_FRAMES);
      assert.deepEqual(loadMores(), [], "held while the move still has frames");

      frames(5);

      assert.equal(getAssetMenuListStart(), 2);
      assert.deepEqual(loadMores(), [[200]]);
    } finally {
      Date.now = realNow;
    }
  });

  it("ends a move at its frame budget when every frame re-lays the row out", () => {
    const list = fakeList(250);

    mount(list, { listStart: 1, anchorId: 150, anchorIndex: 149, itemCount: 250 });
    for (let pass = 0; pass < 2 * CATALOG_ANCHOR_MAX_FRAMES && frames.size > 0; pass++) {
      tick();
      list.rewrap();
    }

    assert.equal(frames.size, 0);
    assert.equal(getAssetMenuListStart(), 1);
  });

  for (const misses of [false, true]) {
    const where = misses ? ", even where the engine's cancel misses a queued frame" : "";

    it(`stops a move when the menu unmounts mid-move${where}`, () => {
      // Placing a building unmounts the menu; a frame left running would record a start nobody saw.
      cancelMisses = misses;
      const list = fakeList(250);

      mount(list, { listStart: 1, anchorId: 150, anchorIndex: 149, itemCount: 250 });
      tick();
      act(() => root?.unmount());
      root = undefined;

      if (!misses) assert.equal(frames.size, 0);
      flush();

      assert.equal(getAssetMenuListStart(), null);
      assert.equal(getAssetMenuAnchor(KEY), null);
    });

    it(`lets a new start that lands during a restore win${where}`, () => {
      // A sort while the remount's restore is still running: the restore stops, the list goes to its top.
      cancelMisses = misses;
      const list = fakeList(250);
      setAssetMenuListStart(3);
      setAssetMenuAnchor(KEY, 120);

      mount(list, { listStart: 3, anchorId: 120, anchorIndex: 119, itemCount: 250 });
      land(list, { listStart: 4, anchorId: 0, anchorIndex: -1, itemCount: 250 });
      flush();

      assert.equal(list.scroller.scrollTop, 0);
      assert.equal(getAssetMenuAnchor(KEY), null);
      assert.equal(getAssetMenuListStart(), 4);
    });
  }
});
