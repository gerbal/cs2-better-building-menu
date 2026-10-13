import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTROL_PANE_TOTAL } from "../src/domain/assetMenuLayout.ts";
import { WIDTH_STEPS_REFERENCE, WIDTH_STEP_REFERENCE_ASPECT } from "../src/domain/sharedContracts.generated.ts";
import {
  CHIRPER_CLEARANCE_OFFSET,
  REFERENCE_ASPECT,
  WIDTH_STEP_NUMBERS,
  coversTheChirper,
  boxPlacement,
  WIDTH_DRAG_DEAD_ZONE,
  draggedStepWidth,
  drawnStep,
  drawnStepWidth,
  measuredSlotLeft,
  nearestSnapStep,
  popoverRightLimit,
  sanitizeWidthStep,
  snapTargets,
  toolOptionsEdge,
  toolOptionsShift,
  topRowRightInset,
  vanillaBoxLeft,
  widthStepWidths,
  type WidthStepScreen,
} from "../src/domain/widthSteps.ts";

const SIXTEEN_NINE = 1920 / 1080;
const TWENTY_ONE_NINE = 2520 / 1080;
const THIRTY_TWO_NINE = 3840 / 1080;
const SIXTEEN_TEN = 1728 / 1080;

// Text scales give fractional rem that a float sum misses by a hair.
const near = (actual: number, expected: number, what = "") =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what} ${actual} is not ${expected}`);
const screen = (over: Partial<WidthStepScreen> = {}): WidthStepScreen => ({ aspect: SIXTEEN_NINE, textScale: 1, paneShown: false, ...over });
const drawn = (over: Partial<WidthStepScreen> = {}) => [1, 2, 3, 4, 5].map((step) => drawnStepWidth(step, screen(over)));
const snapSteps = (over: Partial<WidthStepScreen> = {}) => snapTargets(screen(over)).map((snap) => snap.step);

describe("the five Width steps", () => {
  it("are C#'s widths at 16:9, 21:9 and 32:9", () => {
    assert.deepEqual(widthStepWidths(SIXTEEN_NINE), [...WIDTH_STEPS_REFERENCE["16:9"]]);
    assert.deepEqual(widthStepWidths(TWENTY_ONE_NINE), [...WIDTH_STEPS_REFERENCE["21:9"]]);
    assert.deepEqual(widthStepWidths(THIRTY_TWO_NINE), [...WIDTH_STEPS_REFERENCE["32:9"]]);
  });

  it("read an unmeasurable screen as C#'s reference aspect, which is 16:9", () => {
    assert.equal(REFERENCE_ASPECT, WIDTH_STEP_REFERENCE_ASPECT);
    assert.equal(REFERENCE_ASPECT, 16 / 9);
  });

  it("are the ruled widths on 16:9", () => {
    assert.deepEqual(widthStepWidths(SIXTEEN_NINE), [706, 893, 1091, 1280, 1475]);
  });

  it("start at the game's width on a narrower screen, and stay in order", () => {
    assert.deepEqual(widthStepWidths(SIXTEEN_TEN), [706, 846, 995, 1137, 1283]);
    assert.deepEqual(widthStepWidths(1440 / 1080), [706, 776, 851, 922, 995]);
  });

  it("read a screen they cannot measure as the reference one", () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(widthStepWidths(aspect), [706, 893, 1091, 1280, 1475], String(aspect));
    }
  });
});

describe("a stored step", () => {
  it("is kept from 1 to 5, and anything else is the first", () => {
    for (const step of [1, 2, 3, 4, 5]) assert.equal(sanitizeWidthStep(step), step);
    for (const step of [0, 6, -1, 2.5, Number.NaN, "3", null, undefined]) {
      assert.equal(sanitizeWidthStep(step), 1, String(step));
    }
  });
});

describe("where a step stops on 16:9, with the pane hidden", () => {
  it("draws every step at its width, from the tool options' edge", () => {
    assert.equal(toolOptionsEdge(1), 396);
    assert.deepEqual(drawn(), [706, 893, 1091, 1280, 1475]);
  });

  it("keeps the first three steps clear of the chirper and runs the last two to the room's edge", () => {
    assert.equal(1920 - CHIRPER_CLEARANCE_OFFSET, 1500);
    for (const [index, width] of drawn().entries()) {
      const limit = index < 3 ? 1500 : 1871;
      assert.ok(toolOptionsEdge(1) + width <= limit, `step ${index + 1} ends at ${toolOptionsEdge(1) + width}`);
    }
  });

  it("moves its left edge with the text scale, and narrows steps 3 and 5 to their room", () => {
    near(toolOptionsEdge(1.1), 415);
    near(toolOptionsEdge(1.15), 424.5);
    near(toolOptionsEdge(1.3), 453);
    near(drawnStepWidth(3, screen({ textScale: 1.1 })), 1085, "step 3 at 110%");
    near(drawnStepWidth(3, screen({ textScale: 1.15 })), 1075.5, "step 3 at 115%");
    near(drawnStepWidth(3, screen({ textScale: 1.3 })), 1047, "step 3 at 130%");
    near(drawnStepWidth(5, screen({ textScale: 1.1 })), 1456, "step 5 at 110%");
    near(drawnStepWidth(5, screen({ textScale: 1.15 })), 1446.5, "step 5 at 115%");
    near(drawnStepWidth(5, screen({ textScale: 1.3 })), 1418, "step 5 at 130%");
    assert.equal(drawnStepWidth(4, screen({ textScale: 1.3 })), 1280);
  });

  it("still orders the steps at the slider's largest text", () => {
    const widths = drawn({ textScale: 1.5 });

    near(widths[2], 1009, "step 3");
    near(widths[4], 1380, "step 5");
    for (let i = 1; i < widths.length; i++) assert.ok(widths[i] >= widths[i - 1], `step ${i + 1}`);
  });
});

/** Each step's left and right edge on the screen, as boxPlacement puts it. */
const placed = (over: Partial<WidthStepScreen> = {}): number[][] =>
  [1, 2, 3, 4, 5].map((step) => {
    const width = drawnStepWidth(step, screen(over));
    const { left } = boxPlacement(width, screen(over));
    return [left, left + width];
  });
const nearPairs = (actual: number[][], expected: number[][], what: string) =>
  actual.forEach(([left, right], index) => {
    near(left, expected[index][0], `${what} step ${index + 1} left`);
    near(right, expected[index][1], `${what} step ${index + 1} right`);
  });

describe("the step a stored step draws as", () => {
  it("is itself where it fits, and beside the pane the widest that fits", () => {
    const drawnSteps = (over: Partial<WidthStepScreen>) => [1, 2, 3, 4, 5].map((step) => drawnStep(step, screen(over)));

    assert.deepEqual(drawnSteps({}), [1, 2, 3, 4, 5]);
    assert.deepEqual(drawnSteps({ paneShown: true }), [1, 2, 3, 3, 3]);
    assert.deepEqual(drawnSteps({ aspect: THIRTY_TWO_NINE, paneShown: true }), [1, 2, 3, 4, 4]);
  });
});

describe("where a step sits", () => {
  it("keeps the game's slot's left edge, grows right to 6 rem short of the chirper, then left: on 16:9", () => {
    // The game's slot is 712 wide, centred: x 604, where step 1's 706 starts too.
    assert.equal(vanillaBoxLeft(SIXTEEN_NINE), 604);
    nearPairs(placed(), [[604, 1310], [604, 1497], [409, 1500], [396, 1676], [396, 1871]], "16:9");
  });

  it("beside the shown pane, grows right only as far as leaves the pane room before the social column", () => {
    const rows = placed({ paneShown: true });

    nearPairs(rows, [[604, 1310], [594, 1487], [396, 1487], [396, 1487], [396, 1487]], "beside the pane");
    // The pane, 6 rem past the box and 379 wide, ends on the social column's edge at step 3: 0.2.4's row.
    near(rows[2][1] + CONTROL_PANE_TOTAL, 1872);
  });

  it("keeps steps 1 and 2 at vanilla's edge at every text scale, and slides step 3 off the growing tool options", () => {
    for (const [scale, edge] of [[1.1, 415], [1.15, 424.5], [1.3, 453]]) {
      const rows = placed({ textScale: scale });

      near(rows[0][0], 604, `${scale} step 1`);
      near(rows[1][0], 604, `${scale} step 2`);
      near(rows[2][0], edge, `${scale} step 3 left`);
      near(rows[2][1], 1500, `${scale} step 3 right`);
    }
  });

  it("places 21:9's and 32:9's steps from the game's centred slot", () => {
    assert.equal(vanillaBoxLeft(TWENTY_ONE_NINE), 904);
    assert.equal(vanillaBoxLeft(THIRTY_TWO_NINE), 1564);
    nearPairs(placed({ aspect: TWENTY_ONE_NINE }), [[904, 1610], [904, 1943], [709, 2100], [396, 2124], [396, 2471]], "21:9");
    nearPairs(placed({ aspect: THIRTY_TWO_NINE }), [[1564, 2270], [1564, 2924], [1368, 3420], [707, 3420], [396, 3791]], "32:9");
  });

  it("draws from vanilla's slot at an offset, negative for a box that reaches left of it", () => {
    const offsets = [1, 2, 3, 4, 5].map((step) => boxPlacement(drawnStepWidth(step, screen()), screen()).offset);

    assert.deepEqual(offsets, [0, 0, -195, -208, -208]);
  });

  it("never starts left of the tool options, even where vanilla's own box would", () => {
    // On 4:3 the game's slot would start at 364, inside the tool options' column.
    assert.equal(vanillaBoxLeft(1440 / 1080), 364);
    assert.equal(boxPlacement(706, screen({ aspect: 1440 / 1080 })).left, 396);
  });
});

describe("beside the shown pane on 16:9", () => {
  it("snaps to the first three steps, the third with the pane ending at the social column", () => {
    assert.deepEqual(snapSteps({ paneShown: true }), [1, 2, 3]);
    assert.equal(toolOptionsEdge(1) + drawnStepWidth(3, screen({ paneShown: true })) + CONTROL_PANE_TOTAL, 1872);
  });

  it("draws steps 4 and 5 as step 3, and keeps them for when the pane hides", () => {
    assert.deepEqual(drawn({ paneShown: true }), [706, 893, 1091, 1091, 1091]);
    assert.deepEqual(drawn({ paneShown: false }).slice(3), [1280, 1475]);
  });

  it("narrows step 3 to the room beside the pane from 110% text", () => {
    near(drawnStepWidth(3, screen({ paneShown: true, textScale: 1.1 })), 1072, "110%");
    near(drawnStepWidth(3, screen({ paneShown: true, textScale: 1.15 })), 1062.5, "115%");
    near(drawnStepWidth(3, screen({ paneShown: true, textScale: 1.3 })), 1034, "130%");
    near(drawnStepWidth(5, screen({ paneShown: true, textScale: 1.3 })), 1034, "step 5 at 130%");
    near(drawnStepWidth(3, screen({ paneShown: true, textScale: 1.5 })), 996, "150%");
  });
});

describe("on wider screens", () => {
  it("keeps 21:9's first three steps beside the pane and draws 4 and 5 as the third", () => {
    assert.deepEqual(snapSteps({ aspect: TWENTY_ONE_NINE, paneShown: true }), [1, 2, 3]);
    assert.deepEqual(drawn({ aspect: TWENTY_ONE_NINE, paneShown: true }), [706, 1039, 1391, 1391, 1391]);
  });

  it("keeps 32:9's first four steps beside the pane and draws 5 as the fourth", () => {
    assert.deepEqual(snapSteps({ aspect: THIRTY_TWO_NINE, paneShown: true }), [1, 2, 3, 4]);
    assert.deepEqual(drawn({ aspect: THIRTY_TWO_NINE, paneShown: true }), [706, 1360, 2052, 2713, 2713]);
  });

  it("draws every step whole with the pane hidden", () => {
    assert.deepEqual(drawn({ aspect: TWENTY_ONE_NINE }), [706, 1039, 1391, 1728, 2075]);
    assert.deepEqual(drawn({ aspect: THIRTY_TWO_NINE }), [706, 1360, 2052, 2713, 3395]);
  });
});

describe("on a screen narrower than 16:9", () => {
  it("narrows step 3 to the room left of the chirper on 16:10, and keeps the rest in order", () => {
    // 1,728 wide: the chirper is cleared at 1,308.
    assert.deepEqual(drawn({ aspect: SIXTEEN_TEN }), [706, 846, 912, 1137, 1283]);
    assert.deepEqual(drawn({ aspect: SIXTEEN_TEN, paneShown: true }), [706, 846, 899, 899, 899]);
  });

  it("never draws below the game's own width, even where that reaches the chirper", () => {
    assert.deepEqual(drawn({ aspect: 1440 / 1080 }).slice(0, 3), [706, 706, 706]);
  });
});

describe("the right edge's drag", () => {
  const snaps = snapTargets(screen({ paneShown: true }));

  it("follows the pointer between the narrowest and the widest step it snaps to", () => {
    const shown = screen({ paneShown: true });

    assert.equal(draggedStepWidth(706, 500, 650, snaps, shown, 1), 856);
    assert.equal(draggedStepWidth(706, 500, -5000, snaps, shown, 1), 706);
    assert.equal(draggedStepWidth(706, 500, 5000, snaps, shown, 1), 1091);
  });

  it("falls back to the 720p scale when the strip could not be measured", () => {
    near(draggedStepWidth(706, 500, 520, snaps, screen({ paneShown: true })), 706 + 20 / (2 / 3));
  });

  it("keeps the drawn right edge under the pointer across all five steps, where the box grows left too", () => {
    // 16:9, the pane hidden: the edge is at 1,310 for step 1, 1,497 for step 2, 1,500 for step 3, and
    // 1,676 and 1,871 for 4 and 5. Past 1,500 the box grows left, its edge fixed, so a width that
    // follows the pointer's distance alone would leave the edge short of the pointer from there on.
    const open = screen();
    const hidden = snapTargets(open);
    const edgeAt = (width: number) => boxPlacement(width, open).left + width;

    for (const travelled of [50, 150, 187, 190, 250, 366, 400, 500, 561]) {
      const width = draggedStepWidth(706, 500, 500 + travelled, hidden, open, 1);
      near(edgeAt(width), 1310 + travelled, `${travelled} rem on`);
    }
  });

  it("keeps the drawn right edge under the pointer beside the shown pane too, up to the third step's", () => {
    // Beside the pane the third step's edge is the pane's limit, 1,487: step 2 already sits there.
    const beside = screen({ paneShown: true });
    const besideSnaps = snapTargets(beside);
    const edgeAt = (width: number) => boxPlacement(width, beside).left + width;

    for (const travelled of [50, 100, 150, 177]) {
      near(edgeAt(draggedStepWidth(706, 500, 500 + travelled, besideSnaps, beside, 1)), 1310 + travelled, `${travelled} rem on`);
    }
    assert.equal(draggedStepWidth(706, 500, 500 + 300, besideSnaps, beside, 1), 1091, "held at the widest step");
  });

  it("keeps the drawn width until the pointer has travelled the dead zone, in either direction", () => {
    const open = screen();
    const hidden = snapTargets(open);
    const inside = WIDTH_DRAG_DEAD_ZONE - 0.5;

    for (const travelled of [inside, -inside, 3, -3]) {
      assert.equal(draggedStepWidth(1091, 900, 900 + travelled, hidden, open, 1), 1091, `${travelled} rem`);
    }
    assert.ok(draggedStepWidth(1091, 900, 900 - WIDTH_DRAG_DEAD_ZONE, hidden, open, 1) < 1091, "followed from the dead zone's edge");
    assert.ok(draggedStepWidth(1091, 900, 900 + WIDTH_DRAG_DEAD_ZONE, hidden, open, 1) > 1091, "followed from the dead zone's edge, wider");
  });

  it("starts from where the box is drawn, so a drag from step 3 follows its edge too", () => {
    const open = screen();
    const hidden = snapTargets(open);

    // Step 3's edge is at 1,500: a pointer 100 rem on puts the edge at 1,600, a box 1,204 wide.
    near(draggedStepWidth(1091, 900, 1000, hidden, open, 1), 1204);
    near(draggedStepWidth(1091, 900, 800, hidden, open, 1), 1400 - 604, "100 rem back, short of the flat stretch");
  });

  it("takes the widest width for an edge at the flat stretch's end, and the narrower for one a pixel short", () => {
    const open = screen();
    const hidden = snapTargets(open);

    assert.equal(draggedStepWidth(706, 500, 500 + 190, hidden, open, 1), 1104);
    assert.equal(draggedStepWidth(706, 500, 500 + 189, hidden, open, 1), 896 - 1);
  });

  it("lands on the nearest step, a tie on the narrower", () => {
    assert.equal(nearestSnapStep(856, snaps), 2);
    assert.equal(nearestSnapStep(799.5, snaps), 1);
    assert.equal(nearestSnapStep(800, snaps), 2);
    assert.equal(nearestSnapStep(5000, snaps), 3);
  });

  it("answers the first step when there is nothing to snap to", () => {
    assert.equal(nearestSnapStep(900, []), 1);
  });
});

describe("the top row's right end", () => {
  it("is the box's inner edge, or 10 rem short of the chirper where the box runs over it", () => {
    const insets = [1, 2, 3, 4, 5].map((step) => {
      const width = drawnStepWidth(step, screen());
      return topRowRightInset(boxPlacement(width, screen()), width, SIXTEEN_NINE);
    });

    // Steps 4 and 5 end at 1,676 and 1,871; the row stops at 1,496, 10 rem short of the chirper at 1,506.
    assert.deepEqual(insets, [4, 4, 4, 180, 375]);
  });
});

describe("a popover's right limit", () => {
  it("is the box's right edge, or 6 rem short of the chirper where the box runs over it", () => {
    const limits = [1, 2, 3, 4, 5].map((step) => {
      const width = drawnStepWidth(step, screen());
      return popoverRightLimit(boxPlacement(width, screen()), width, SIXTEEN_NINE);
    });

    // In the box: steps 4 and 5 start at 396, so x 1,500 is 1,104 in.
    assert.deepEqual(limits, [706, 893, 1091, 1104, 1104]);
  });
});

describe("the steps by number", () => {
  it("are one to five, and only the two past the chirper's clearance cover it", () => {
    assert.deepEqual([...WIDTH_STEP_NUMBERS], [1, 2, 3, 4, 5]);
    assert.deepEqual(WIDTH_STEP_NUMBERS.filter(coversTheChirper), [4, 5]);
  });
});

describe("from the game's slot as measured", () => {
  // The slot's rem width follows the pixel ratio: 704 wide at x 608 at 1 px per rem, 712 at x 604 at 1.5.
  const SLOTS: Array<[number, number]> = [[704, 608], [712, 604]];
  // Where the box draws on the screen: the row sits in the game's slot and moves by the offset.
  const drawnAt = (over: Partial<WidthStepScreen> & { slotLeft: number }): number[][] =>
    [1, 2, 3, 4, 5].map((step) => {
      const width = drawnStepWidth(step, screen(over));
      const left = over.slotLeft + boxPlacement(width, screen(over)).offset;
      return [left, left + width];
    });

  it("keeps a 704 slot's left edge for step 1, and draws steps 2 to 5 at the same screen edges", () => {
    // Step 2 from x 608 would end past 1,500, so it grows left a rem.
    nearPairs(drawnAt({ slotLeft: 608 }), [[608, 1314], [607, 1500], [409, 1500], [396, 1676], [396, 1871]], "704");
  });

  it("draws a 712 slot as the centred one it stands in for before the first layout", () => {
    assert.deepEqual(drawnAt({ slotLeft: 604 }), placed());
  });

  it("holds the tool options' floor and every step's right limit at either width", () => {
    for (const [width, slotLeft] of SLOTS) {
      for (const textScale of [1, 1.1, 1.3, 1.5]) {
        for (const paneShown of [false, true]) {
          const over = { slotLeft, textScale, paneShown };
          drawnAt(over).forEach(([left, right], index) => {
            const what = `${width} ${textScale} ${paneShown} step ${index + 1}`;
            const limit = paneShown ? 1872 - CONTROL_PANE_TOTAL : index < 3 ? 1500 : 1871;

            assert.ok(left >= toolOptionsEdge(textScale) - 1e-9, `${what} left ${left}`);
            assert.ok(right <= limit + 1e-9, `${what} right ${right}`);
          });
        }
      }
    }
  });

  it("ends step 5, and its right-edge strip, short of the social column at 1080p", () => {
    // The social column starts 48.4 rem from a 1920-wide screen's right edge; the strip is the box's last rem.
    const [, right] = drawnAt({ slotLeft: 608 })[4];

    assert.ok(right < 1920 - 48.4, `step 5 ends at ${right}`);
  });

  it("moves the tool options so they end at the tool options' edge, from either slot", () => {
    for (const [, slotLeft] of SLOTS) {
      const over = { slotLeft };
      const shift = toolOptionsShift(boxPlacement(drawnStepWidth(3, screen(over)), screen(over)), screen(over));

      // The game's column ends 6 rem short of its slot.
      near(slotLeft - 6 + (shift ?? 0), 396, `${slotLeft}`);
    }
  });

  it("leaves the tool options where the game puts them for step 2's rem left of a 704 slot, which covers none of them", () => {
    const over = { slotLeft: 608 };

    assert.equal(toolOptionsShift(boxPlacement(drawnStepWidth(2, screen(over)), screen(over)), screen(over)), null);
  });
});

describe("the game's slot's left edge, read off its rect", () => {
  it("turns pixels into rem at the screen's height", () => {
    assert.equal(measuredSlotLeft({ left: 608, width: 704 }, 1080), 608);
    assert.equal(measuredSlotLeft({ left: 402, width: 474.67 }, 720), 603);
  });

  it("reads nothing from a missing rect, one not laid out yet, a left that is not a number, or a screen with no height", () => {
    // Each falls back to the centred slot rather than placing the box against x 0, or nowhere.
    assert.equal(measuredSlotLeft(null, 1080), null);
    assert.equal(measuredSlotLeft(undefined, 1080), null);
    assert.equal(measuredSlotLeft({ left: 0, width: 0 }, 1080), null);
    assert.equal(measuredSlotLeft({ left: Number.NaN, width: 704 }, 1080), null);
    assert.equal(measuredSlotLeft({ left: Number.POSITIVE_INFINITY, width: 704 }, 1080), null);
    assert.equal(measuredSlotLeft({ left: 608, width: 704 }, 0), null);
  });
});

describe("the game's tool options beside a box that reaches left of the game's slot", () => {
  const shifts = (over: Partial<WidthStepScreen> = {}) =>
    [1, 2, 3, 4, 5].map((step) => {
      const width = drawnStepWidth(step, screen(over));
      return toolOptionsShift(boxPlacement(width, screen(over)), screen(over));
    });

  it("stay where the game puts them while the box keeps the slot's left edge", () => {
    assert.deepEqual(shifts().slice(0, 2), [null, null]);
  });

  it("move left for steps 3 to 5, and beside the pane for step 2 too, which grows left to leave it room", () => {
    assert.deepEqual(shifts().slice(2), [-202, -202, -202]);
    assert.deepEqual(shifts({ paneShown: true }), [null, -202, -202, -202, -202]);
  });

  it("move to where the width model puts them, 16 to the tool options' edge, at every text scale", () => {
    // Where the game draws the column on 16:9: its right edge 6 rem short of the slot, at x 598, its
    // left edge further left the larger the text.
    for (const [scale, gameLeft] of [[1, 218], [1.1, 199], [1.3, 161], [1.5, 123]]) {
      const [, , shift] = shifts({ textScale: scale });

      near(gameLeft + (shift ?? 0), 16, `${scale} left`);
      near(598 + (shift ?? 0), toolOptionsEdge(scale), `${scale} right`);
    }
  });

  it("never sit under the box once moved", () => {
    for (const textScale of [1, 1.1, 1.3, 1.5]) {
      for (const paneShown of [false, true]) {
        for (const step of [1, 2, 3, 4, 5]) {
          const over = { textScale, paneShown };
          const width = drawnStepWidth(step, screen(over));
          const placement = boxPlacement(width, screen(over));
          const shift = toolOptionsShift(placement, screen(over));

          assert.ok(598 + (shift ?? 0) <= placement.left, `${textScale} ${paneShown} step ${step}`);
        }
      }
    }
  });

  it("follow the game's slot on a wider screen", () => {
    // 21:9: the slot starts at 904, so the column ends at 898.
    const [, , shift] = shifts({ aspect: TWENTY_ONE_NINE });

    assert.equal(shift, 396 - 898);
  });
});
