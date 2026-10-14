import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cellsInField, coversPoint, hudPieces, overlap, placePointerCard, placeSlotCard, remRect, slotRowsKept, type Rect } from "../src/domain/hoverCardPlace";

const SCREEN = { w: 1920, h: 1080 };
/** The box at the first Width step and at the fifth, on 16:9: its top at 746, 208 tall. */
const STEP1: Rect = { x: 604, y: 746, w: 706, h: 208 };
const STEP5: Rect = { x: 396, y: 746, w: 1475, h: 208 };
/** A screen of list plates, 4 × 5 of 171 × 27.25 from the box's top left, 59 rem down. */
const plates = (box: Rect, cols = 4, w = 171): Rect[] =>
  Array.from({ length: cols * 5 }, (_, at) => ({ x: box.x + 8 + (at % cols) * (w + 2), y: box.y + 59 + Math.floor(at / cols) * 29.25, w, h: 27.25 }));
/** The card at 100% text and at 130%. */
const CARD = { w: 240, h: 98 };
const LARGE = { w: 285, h: 115 };

describe("the hover card beside the pointer", () => {
  it("sits above the box on the pointed cell's left edge, 6 rem over the box, covering no cell, in Roads at 706", () => {
    const cells = plates(STEP1);
    const place = placePointerCard({ cell: cells[5], card: CARD, box: STEP1, screen: SCREEN, cells });

    assert.deepEqual([place.how, place.x, place.y, place.fitted], ["above", cells[5].x, 746 - 6 - 98, true]);
    assert.equal(cells.filter((cell) => overlap(cell, place) > 0).length, 0);
  });

  it("flips to the cell's right edge at the right end of a 1475 box, and is raised over the chirper", () => {
    const cells = plates(STEP5, 8, 182);
    const last = cells[7];
    const place = placePointerCard({ cell: last, card: CARD, box: STEP5, screen: SCREEN, cells });
    const chirper = hudPieces(SCREEN.w).find((piece) => piece.name === "chirper")!;

    assert.equal(place.how, "flipped");
    assert.equal(place.x + place.w, last.x + last.w);
    // Clear of the chirper's top, by the margin.
    assert.equal(place.y, chirper.y - 4 - CARD.h);
    assert.equal(cells.filter((cell) => overlap(cell, place) > 0).length, 0);
  });

  it("covers no cell at 130% text, nor over Landscaping's icons", () => {
    const cells = plates(STEP1, 3, 228.67);
    const large = placePointerCard({ cell: cells[2], card: LARGE, box: STEP1, screen: SCREEN, cells });
    const icons = Array.from({ length: 45 }, (_, at) => ({ x: STEP1.x + 9 + (at % 15) * 46, y: STEP1.y + 63.125 + Math.floor(at / 15) * 46, w: 44, h: 44 }));
    const icon = placePointerCard({ cell: icons[44], card: CARD, box: STEP1, screen: SCREEN, cells: icons });

    assert.equal(large.fitted && icon.fitted, true);
    assert.equal([...cells, ...icons].filter((cell) => overlap(cell, large) > 0 || overlap(cell, icon) > 0).length, 0);
  });

  it("counts only the cells the body draws, so a scrolled list keeps the card above the box", () => {
    // Ten lines of plates scrolled six down: the six above sit under the top row and over the box, out of the field.
    const field: Rect = { x: STEP1.x, y: STEP1.y + 59, w: STEP1.w, h: 144.25 };
    const scrolled = Array.from({ length: 40 }, (_, at) => ({ x: STEP1.x + 8 + (at % 4) * 173, y: field.y + (Math.floor(at / 4) - 6) * 29.25, w: 171, h: 27.25 }));
    const drawn = cellsInField(scrolled, field);
    const pointed = scrolled[(6 + 2) * 4 + 1];
    const place = placePointerCard({ cell: pointed, card: CARD, box: STEP1, screen: SCREEN, cells: drawn });

    assert.equal(drawn.length, 16);
    assert.ok(drawn.every((cell) => cell.y >= field.y && cell.y < field.y + field.h), JSON.stringify(drawn));
    assert.deepEqual([place.how, place.x, place.y], ["above", pointed.x, 746 - 6 - 98]);
  });

  it("sits beside the cell where a box dragged tall leaves no room above it", () => {
    const tall: Rect = { x: 604, y: 60, w: 706, h: 894 };
    const cell = { x: 612, y: 400, w: 171, h: 27.25 };
    const place = placePointerCard({ cell, card: CARD, box: tall, screen: SCREEN, cells: [cell] });

    assert.deepEqual([place.how, place.x], ["right", 612 + 171 + 6]);
  });

  it("reads the cells drawn only where no place above the box fits inside its span, as a place above the box covers none", () => {
    let reads = 0;
    const counted = (cells: Rect[]) => () => {
      reads += 1;
      return cells;
    };
    const above = placePointerCard({ cell: plates(STEP1)[5], card: CARD, box: STEP1, screen: SCREEN, cells: counted(plates(STEP1)) });
    assert.deepEqual([above.how, reads], ["above", 0]);

    const cell = { x: 612, y: 400, w: 171, h: 27.25 };
    const beside = placePointerCard({ cell, card: CARD, box: { x: 604, y: 60, w: 706, h: 894 }, screen: SCREEN, cells: counted([cell]) });
    assert.deepEqual([beside.how, reads], ["right", 1]);
  });

  it("still draws on screen, at the first place, where every place is blocked", () => {
    const cell = { x: 1800, y: 30, w: 100, h: 40 };
    const place = placePointerCard({ cell, card: { w: 1000, h: 1000 }, box: { x: 396, y: 20, w: 1475, h: 934 }, screen: SCREEN, cells: [cell] });

    assert.equal(place.fitted, false);
    assert.equal(place.how, "above");
    assert.ok(place.x >= 0 && place.y >= 0 && place.x + place.w <= SCREEN.w && place.y + place.h <= SCREEN.h, JSON.stringify(place));
  });

  it("draws the game's detail slot 706 × at most 191, its bottom at y 740, at the box's left edge at the first step", () => {
    const cells = plates(STEP1);

    assert.deepEqual(placeSlotCard({ cell: cells[0], height: 191, box: STEP1, screen: SCREEN }), { x: 604, y: 549, w: 706, h: 191 });
    assert.deepEqual(placeSlotCard({ cell: cells[3], height: 240, box: STEP1, screen: SCREEN }), { x: 604, y: 549, w: 706, h: 191 });
    assert.deepEqual(placeSlotCard({ cell: cells[0], height: 120, box: STEP1, screen: SCREEN }).y, 746 - 6 - 120);
  });

  it("centres the slot over the pointed cell in a wider box, held inside its span, and raises it clear of the chirper", () => {
    const cells = plates(STEP5, 8, 182);
    const middle = placeSlotCard({ cell: cells[2], height: 191, box: STEP5, screen: SCREEN });
    const end = placeSlotCard({ cell: cells[7], height: 191, box: STEP5, screen: SCREEN });
    const chirper = hudPieces(SCREEN.w).find((piece) => piece.name === "chirper")!;

    assert.equal(middle.x, cells[2].x + cells[2].w / 2 - 353);
    assert.equal(middle.y, 549);
    assert.equal(end.x + end.w, STEP5.x + STEP5.w);
    assert.equal(end.y, chirper.y - 4 - 191);
    assert.equal(overlap(end, chirper), 0);
  });

  it("holds the slot on screen across, where a box narrower than the slot meets the screen's right edge", () => {
    const narrow: Rect = { x: SCREEN.w - 500, y: 746, w: 500, h: 208 };
    const place = placeSlotCard({ cell: { x: SCREEN.w - 180, y: 805, w: 171, h: 27.25 }, height: 191, box: narrow, screen: SCREEN, hud: [] });

    assert.deepEqual([place.x, place.x + place.w], [SCREEN.w - 4 - 706, SCREEN.w - 4]);
  });

  it("keeps the slot off the pointed cell where a box dragged tall leaves no room above it: over the box above the cell, else under it", () => {
    const tall: Rect = { x: 604, y: 20, w: 706, h: 934 };
    const low = { x: 612, y: 700, w: 171, h: 27.25 };
    const high = { x: 612, y: 79, w: 171, h: 27.25 };
    const over = placeSlotCard({ cell: low, height: 191, box: tall, screen: SCREEN });
    const under = placeSlotCard({ cell: high, height: 191, box: tall, screen: SCREEN });

    assert.deepEqual([over.y, over.h], [700 - 6 - 191, 191]);
    assert.equal(under.y, 79 + 27.25 + 6);
    assert.equal(overlap(over, low) + overlap(under, high), 0);
    // Clear of the HUD's bottom bar, and on screen.
    assert.ok(under.y + under.h <= 960 - 4, JSON.stringify(under));
  });

  it("keeps the slot's leading rows whose bottoms fit its room, and the first always", () => {
    assert.equal(slotRowsKept([17, 40, 55, 80], 60), 3);
    assert.equal(slotRowsKept([17, 40, 55, 80], 80), 4);
    // A row that runs over drops every row after it, however short: the order holds.
    assert.equal(slotRowsKept([17, 70, 20], 60), 1);
    assert.equal(slotRowsKept([200], 167), 1);
    assert.equal(slotRowsKept([], 167), 0);
  });

  it("keeps the HUD at the screen's right edge on a wider screen", () => {
    assert.deepEqual(hudPieces(2520).find((piece) => piece.name === "chirper"), { name: "chirper", x: 2106, y: 733, w: 337, h: 114 });
  });

  it("finds a point on a cell, its edges included, and off it a rem's hundredth past them", () => {
    const cell: Rect = { x: 612, y: 805, w: 171, h: 27.25 };

    assert.deepEqual([{ x: 612, y: 805 }, { x: 783, y: 832.25 }, { x: 700, y: 820 }].map((at) => coversPoint(cell, at)), [true, true, true]);
    assert.deepEqual([{ x: 611.9, y: 820 }, { x: 700, y: 832.3 }, { x: 785, y: 820 }].map((at) => coversPoint(cell, at)), [false, false, false]);
  });

  it("reads a rectangle the page reports in pixels in screen rem, 1,080 a screen", () => {
    assert.deepEqual(remRect({ left: 302, top: 373, width: 353, height: 104 }, 540), STEP1);
    assert.deepEqual(remRect(undefined, 720), { x: 0, y: 0, w: 0, h: 0 });
  });
});
