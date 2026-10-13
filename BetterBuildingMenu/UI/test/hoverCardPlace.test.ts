import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cellsInField, hudPieces, overlap, placePointerCard, remRect, type Rect } from "../src/domain/hoverCardPlace";

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
    // Counted whole, the cells scrolled away above the body would move it.
    assert.notEqual(placePointerCard({ cell: pointed, card: CARD, box: STEP1, screen: SCREEN, cells: scrolled }).how, "above");
  });

  it("sits beside the cell where a box dragged tall leaves no room above it", () => {
    const tall: Rect = { x: 604, y: 60, w: 706, h: 894 };
    const cell = { x: 612, y: 400, w: 171, h: 27.25 };
    const place = placePointerCard({ cell, card: CARD, box: tall, screen: SCREEN, cells: [cell] });

    assert.deepEqual([place.how, place.x], ["right", 612 + 171 + 6]);
  });

  it("still draws on screen, at the first place, where every place is blocked", () => {
    const cell = { x: 1800, y: 30, w: 100, h: 40 };
    const place = placePointerCard({ cell, card: { w: 1000, h: 1000 }, box: { x: 396, y: 20, w: 1475, h: 934 }, screen: SCREEN, cells: [cell] });

    assert.equal(place.fitted, false);
    assert.equal(place.how, "above");
    assert.ok(place.x >= 0 && place.y >= 0 && place.x + place.w <= SCREEN.w && place.y + place.h <= SCREEN.h, JSON.stringify(place));
  });

  it("keeps the HUD at the screen's right edge on a wider screen", () => {
    assert.deepEqual(hudPieces(2520).find((piece) => piece.name === "chirper"), { name: "chirper", x: 2106, y: 733, w: 337, h: 114 });
  });

  it("reads a rectangle the page reports in pixels in screen rem, 1,080 a screen", () => {
    assert.deepEqual(remRect({ left: 302, top: 373, width: 353, height: 104 }, 540), STEP1);
    assert.deepEqual(remRect(undefined, 720), { x: 0, y: 0, w: 0, h: 0 });
  });
});
