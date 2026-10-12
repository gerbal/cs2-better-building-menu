import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTROL_PANE_TOTAL } from "../src/domain/assetMenuLayout.ts";
import { WIDTH_STEPS_REFERENCE, WIDTH_STEP_REFERENCE_ASPECT } from "../src/domain/sharedContracts.generated.ts";
import {
  CHIRPER_CLEARANCE_OFFSET,
  REFERENCE_ASPECT,
  draggedStepWidth,
  drawnStepWidth,
  nearestSnapStep,
  sanitizeWidthStep,
  snapTargets,
  toolOptionsEdge,
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
    assert.equal(draggedStepWidth(706, 500, 650, snaps, 1), 856);
    assert.equal(draggedStepWidth(706, 500, -5000, snaps, 1), 706);
    assert.equal(draggedStepWidth(706, 500, 5000, snaps, 1), 1091);
  });

  it("falls back to the 720p scale when the strip could not be measured", () => {
    assert.equal(draggedStepWidth(706, 500, 520, snaps), 706 + 20 / (2 / 3));
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
