import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentOverflowPx, drawnRoom, overflowsBox } from "../src/domain/measuredFit.ts";

describe("what counts as overflow", () => {
// Cohtml's scrollWidth equals offsetWidth when nothing overflows, and
// clientWidth excludes the border, so scrollWidth − clientWidth is never zero
// on a bordered cell. Content past max(clientWidth, offsetWidth) is overflow.
  it("is content past the larger of client and offset width", () => {
    // Cohtml, bordered, fits: scroll == offset > client.
    assert.equal(contentOverflowPx(153, 155, 155), 0);
    // Cohtml, bordered, overflowing by three.
    assert.equal(contentOverflowPx(153, 155, 158), 3);
    // A browser, fits: scroll == client < offset.
    assert.equal(contentOverflowPx(153, 155, 153), 0);
    // A browser, overflowing: scroll > offset.
    assert.equal(contentOverflowPx(153, 155, 160), 5);
    // Unbordered span, either engine.
    assert.equal(contentOverflowPx(187, 187, 195), 8);
  });
});

// The advance table is an estimate; the drawn text is the fact. A name is planned again in the box it
// drew in, and narrower where its lines ran past it.
describe("the room a drawn name's lines may take", () => {
  const undrawn = { box: null, fit: 1 };
  const fits = { clientWidth: 64, offsetWidth: 64, scrollWidth: 64 };

  it("is the box as drawn, in rem, wider or narrower than the estimate", () => {
    // 720p: a pixel is 1.5 rem.
    assert.deepEqual(drawnRoom(undrawn, { clientWidth: 60 }, [fits], 1.5), { box: 90, fit: 1 });
  });

  it("narrows by the most any line ran past its box, in proportion, and never widens again", () => {
    const lines = [fits, { clientWidth: 64, offsetWidth: 64, scrollWidth: 96 }];
    const narrowed = drawnRoom({ box: 90, fit: 1 }, { clientWidth: 60 }, lines, 1.5);

    assert.deepEqual(narrowed, { box: 90, fit: 64 / 96 });
    assert.equal(drawnRoom(narrowed, { clientWidth: 60 }, [fits], 1.5), narrowed);
  });

  it("narrows only where the plan fitted its room by the estimate: a line it already said overruns says nothing of the box", () => {
    const over = { clientWidth: 64, offsetWidth: 64, scrollWidth: 96 };
    const room = { box: 90, fit: 1 };

    assert.equal(drawnRoom(room, { clientWidth: 60 }, [over], 1.5, false), room);
    // The box as drawn still counts.
    assert.deepEqual(drawnRoom(room, { clientWidth: 50 }, [over], 1.5, false), { box: 75, fit: 1 });
  });

  it("is the same room, the very object, where nothing moved beyond rounding", () => {
    const room = { box: 90, fit: 1 };

    assert.equal(drawnRoom(room, { clientWidth: 60.004 }, [fits], 1.5), room);
    assert.equal(drawnRoom(room, { clientWidth: 60 }, [{ clientWidth: 64, offsetWidth: 64, scrollWidth: 65 }], 1.5), room);
  });

  it("never narrows below the widest line drawn: a box that hugs its lines says nothing of the room", () => {
    // The lines drew 60 px wide, 90 rem, where the estimate makes the widest 96 rem: a box no wider than
    // its lines is a box sized to them, and planning in it would cut the name a step every frame.
    const hugged = { clientWidth: 60, offsetWidth: 60, scrollWidth: 60 };
    const room = { box: 150, fit: 1 };

    assert.equal(drawnRoom(undrawn, { clientWidth: 60 }, [hugged], 1.5, true, 96), undrawn);
    assert.equal(drawnRoom(room, { clientWidth: 60 }, [hugged], 1.5, true, 96), room);
    // A box wider than the widest line is still the room it gives, narrower than the estimate or not.
    assert.deepEqual(drawnRoom(room, { clientWidth: 80 }, [hugged], 1.5, true, 96), { box: 120, fit: 1 });
  });

  it("keeps the estimate while the box has not been laid out", () => {
    // Cohtml reports 0 for an element it has not laid out, and the previous text's width for one whose
    // text just changed; a zero box is the first case and must not count as overflow.
    assert.equal(drawnRoom(undrawn, { clientWidth: 0 }, [{ clientWidth: 0, offsetWidth: 0, scrollWidth: 40 }], 1.5), undrawn);
  });

  it("keeps the estimate where the screen's rem is unknown: a box of no width would cut every name to its shortest", () => {
    // deviceRem answers 0 for a screen of no height.
    assert.equal(drawnRoom(undrawn, { clientWidth: 60 }, [fits], 0), undrawn);
    assert.equal(drawnRoom(undrawn, { clientWidth: 60 }, [fits], Number.NaN), undrawn);
    assert.equal(drawnRoom(undrawn, { clientWidth: 60 }, [fits], Number.POSITIVE_INFINITY), undrawn);
  });
});

describe("a hover card line that does not fit its half", () => {
  it("overflows when its content runs past the box by more than rounding", () => {
    // A German label wider than half the card.
    assert.equal(overflowsBox({ clientWidth: 180, offsetWidth: 180, scrollWidth: 240 }), true);
    assert.equal(overflowsBox({ clientWidth: 180, offsetWidth: 180, scrollWidth: 182 }), true);
  });

  it("fits when it runs past by a pixel, or not at all", () => {
    assert.equal(overflowsBox({ clientWidth: 180, offsetWidth: 180, scrollWidth: 181 }), false);
    assert.equal(overflowsBox({ clientWidth: 180, offsetWidth: 180, scrollWidth: 180 }), false);
  });

  it("reads Cohtml's scrollWidth, which matches offsetWidth when nothing overflows", () => {
    assert.equal(overflowsBox({ clientWidth: 170, offsetWidth: 180, scrollWidth: 180 }), false);
  });

  it("never overflows before it is laid out", () => {
    assert.equal(overflowsBox({ clientWidth: 0, offsetWidth: 0, scrollWidth: 0 }), false);
  });
});
