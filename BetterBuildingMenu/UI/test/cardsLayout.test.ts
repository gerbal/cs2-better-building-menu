import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLotDimensions } from "../src/domain/assetMenuMetricFormat";
import { bodyLines, SLOT_GAP } from "../src/domain/bodyGeometry";
import { cardGeometry, cardLineSpacing, cardNameBox, cardText, cardWidth, CARD_GAP, labelNameBox, labelWidth, packCards } from "../src/domain/cardsLayout";
import { heightOfLines } from "../src/domain/boxEdges";
import { planName } from "../src/domain/namePlan";
import { fontSizeRatio } from "../src/domain/textScale";
import { pageScrollTop } from "../src/domain/catalogWindow";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { textWidth } from "../src/domain/textWidth";
import { declarationsOf, rem, sides } from "./harness/compiledCss";

const CARDS = "mods/Bodies/cardsBody.module.scss";
const LABELS = "mods/Bodies/labelPlate.module.scss";
const separators = { group: ",", decimal: "." };
const lot = formatLotDimensions(4, 3);
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const entry = (over: Partial<BuildingCatalogEntry> = {}) => ({
  id: 1, name: "Small Clinic", prefabName: "SmallClinic", category: "ServiceBuildings", subCategory: "ServiceBuildings_Health",
  lotWidth: 4, lotDepth: 3, constructionCost: 5000, capacity: 20, isLocked: false, unlockMilestone: 0, costIsPerDistance: false,
  ...over,
}) as BuildingCatalogEntry;

describe("the cards' geometry", () => {
  it("makes a card 46 tall, three rows in the game's own body a little over 3 apart", () => {
    assert.deepEqual(cardGeometry(46, 144.25, 1), { height: 46, lines: 3, rowGap: 3.125, y0: 0, pitchY: 49.125 });
  });

  it("stacks the rows a release of the top edge lands on as the body draws them", () => {
    for (const [knob, textScale] of [[46, 1], [50, 1], [46, 1.5]]) {
      for (const rows of [2, 3, 5]) {
        assert.equal(cardGeometry(knob, heightOfLines(rows, cardLineSpacing(knob, textScale)), textScale).lines, rows, `${knob} at ${textScale}, ${rows} rows`);
      }
    }
  });

  it("makes the Card height knob's 50 two rows, 4 apart, the block centred in the body", () => {
    assert.deepEqual(cardGeometry(50, 144.25, 1), { height: 50, lines: 2, rowGap: 4, y0: 20.12, pitchY: 54 });
  });

  it("grows a card at large text to its two lines: two rows at 130% and at 150%, centred in the body", () => {
    assert.deepEqual(cardGeometry(46, 144.25, 1.3), { height: 49, lines: 2, rowGap: 4, y0: 21.12, pitchY: 53 });
    assert.deepEqual(cardGeometry(46, 144.25, 1.5), { height: 56, lines: 2, rowGap: 4, y0: 14.12, pitchY: 60 });
  });

  it("keeps rows apart and starts at the top when a screen holds one row", () => {
    const one = cardGeometry(46, 100, 1.5);

    assert.equal(one.lines, 1);
    assert.ok(one.rowGap >= SLOT_GAP, `${one.rowGap}`);
    assert.equal(one.y0, 0);
    assert.equal(one.pitchY, one.height + one.rowGap);
  });

  it("pages by whole rows: from the top of the game's own body a page moves three rows of 46", () => {
    const lines = bodyLines(null, cardGeometry(46, 144.25, 1));

    assert.deepEqual(lines, { pitch: 49.125, gap: 3.125, edge: 0 });
    assert.equal(pageScrollTop(0, 144.25, 1000, 1, lines.pitch, lines.gap, 1, lines.edge), 147.375);
    // The list and the tiles page by their slots, a slot's gap apart; with no body, a screen.
    assert.equal(bodyLines(null, null).pitch, 0);
    assert.equal(SLOT_GAP, bodyLines(null, null).gap);
  });

  it("forgives the device pixel the game's scroller reports short, as the list and the tiles do", () => {
    // Three rows of 46 and two gaps of 2 need 142; a body a fifth of a rem short keeps them within a pixel.
    assert.equal(cardGeometry(46, 141.8, 1).lines, 2);
    assert.equal(cardGeometry(46, 141.8, 1, 0.25).lines, 3);
  });
});

describe("a card's words", () => {
  it("are the whole name, then the lot, the cost and the capacity", () => {
    assert.deepEqual(cardText(entry(), null, separators, "Locked", 0), { name: "Small Clinic", facts: [lot, "¢5,000", "20 patients"], locked: null, sorted: null });
  });

  it("leave out a lot a road does not have and a capacity of nothing", () => {
    assert.deepEqual(cardText(entry({ lotWidth: 0, lotDepth: 0, capacity: 0 }), null, separators, "Locked", 0).facts, ["¢5,000"]);
  });

  it("say a locked card's milestone beside its lock, and keep its cost; the locked word once the city is past it", () => {
    const locked = entry({ isLocked: true, unlockMilestone: 4 });

    assert.equal(cardText(locked, null, separators, "Locked", 0).locked, "MS 4");
    assert.deepEqual(cardText(locked, null, separators, "Locked", 0).facts, [lot, "¢5,000", "20 patients"]);
    assert.equal(cardText(locked, null, separators, "Locked", 4).locked, "Locked");
  });

  it("carry the value sorted by under a sort by a number, the lot's too", () => {
    assert.equal(cardText(entry(), "capacity", separators, "Locked", 0).sorted, "20 patients");
    assert.equal(cardText(entry(), "lot", separators, "Locked", 0).sorted, lot);
    assert.equal(cardText(entry({ upkeep: null }), "upkeep", separators, "Locked", 0).sorted, null);
  });

  it("carry a road's upkeep per cell under a sort by upkeep, as its cost", () => {
    const road = entry({ upkeep: 4_612, constructionCost: 5_500, costIsPerDistance: true });

    assert.equal(cardText(road, "upkeep", separators, "Locked", 0).sorted, "¢36.9/c");
    assert.ok(cardText(road, "upkeep", separators, "Locked", 0).facts.includes("¢44/c"));
  });

  it("carry a building's upkeep without the month Sort names under a sort by upkeep, as a road's", () => {
    assert.equal(cardText(entry({ upkeep: 1_200 }), "upkeep", separators, "Locked", 0).sorted, "¢1,200");
  });
});

describe("a card's words in a look that writes units in words", () => {
  const words = { mode: "word", workersUnit: "jobs", capacityUnit: "capacity" } as const;
  const crematorium = entry({ subCategory: "ServiceBuildings_Deathcare", buildingType: "DeathcareFacility", capacity: 1_500, workers: 20 });

  it("say a capacity the game gives no unit with the capacity word, and a counted one with its own unit", () => {
    assert.deepEqual(cardText(crematorium, null, separators, "Locked", 0).facts, [lot, "¢5,000", "1,500"]);
    assert.deepEqual(cardText(crematorium, null, separators, "Locked", 0, words).facts, [lot, "¢5,000", "1,500 capacity"]);
    assert.deepEqual(cardText(entry(), null, separators, "Locked", 0, words).facts, [lot, "¢5,000", "20 patients"]);
  });

  it("say the value sorted by with its unit under a sort by workers or capacity", () => {
    assert.deepEqual([cardText(crematorium, "workers", separators, "Locked", 0).sorted, cardText(crematorium, "workers", separators, "Locked", 0, words).sorted], ["20", "20 jobs"]);
    assert.equal(cardText(crematorium, "capacity", separators, "Locked", 0, words).sorted, "1,500 capacity");
  });

  it("are as wide as the words they draw", () => {
    // A name longer than either facts line, so only the sorted column's words differ.
    const long = { ...crematorium, name: "A Very Long Crematorium Name Indeed, Longer Still" };
    const glyphs = cardText(long, "workers", separators, "Locked", 0);
    const inWords = cardText(long, "workers", separators, "Locked", 0, words);

    near(cardWidth(inWords, 1) - cardWidth(glyphs, 1), textWidth("20 jobs", 14) - textWidth("20", 14));
  });
});

describe("a card's width", () => {
  it("is its picture and padding, and its name or its facts line, whichever is longer, as the stylesheet draws them", () => {
    const text = cardText(entry({ name: "A Very Long Hospital Name Indeed" }), null, separators, "Locked", 0);
    const name = textWidth(text.name, 14);
    // The card's padding, its picture and the gap after it, read from the sheet the card draws with.
    const [, padRight, , padLeft] = sides(declarationsOf(CARDS, ".card").padding).map(rem);
    const picture = rem(declarationsOf(CARDS, ".artwork").width);
    const pictureGap = rem(declarationsOf(CARDS, ".artwork")["margin-right"]);

    near(cardWidth(text, 1), padLeft + picture + pictureGap + name + 2 + padRight);
  });

  it("adds the sorted value's column", () => {
    const plain = cardText(entry(), null, separators, "Locked", 0);
    const sorted = cardText(entry(), "capacity", separators, "Locked", 0);

    near(cardWidth(sorted, 1) - cardWidth(plain, 1), rem(declarationsOf(CARDS, ".sorted")["padding-left"]) + textWidth("20 patients", 14));
  });

  it("counts a locked card's lock, its gap, its milestone and the dot after it, as the stylesheet draws them", () => {
    const plain = cardText(entry({ name: "A" }), null, separators, "Locked", 0);
    const locked = cardText(entry({ name: "A", isLocked: true, unlockMilestone: 4 }), null, separators, "Locked", 0);
    const lock = rem(/calc\(([\d.]+rem)/.exec(declarationsOf(CARDS, ".lockGlyph").width)![1]);
    const lockGap = rem(declarationsOf(CARDS, ".lockGlyph")["margin-right"]);
    const dot = textWidth("·", 12) + 2 * rem(sides(declarationsOf(CARDS, ".factDot").padding)[1]);

    near(cardWidth(locked, 1) - cardWidth(plain, 1), lock + lockGap + textWidth("MS 4", 12) + dot);
  });

  it("grows a card's height from the lines its name and facts draw at, which the stylesheet scales with the text", () => {
    // Each line is calc(N rem * var(--fontScale)) in the sheet: the text scale is the factor the geometry uses too.
    const line = (selector: string) => {
      const value = declarationsOf(CARDS, selector)["line-height"];
      const factor = /^calc\((\d*\.?\d+)rem \* var\(--fontScale\)\)$/.exec(value ?? "");
      assert.ok(factor, `${selector} line-height is ${value}`);
      return Number(factor[1]);
    };

    for (const scale of [1.3, 1.5]) {
      assert.equal(cardGeometry(46, 144.25, scale).height, Math.ceil(46 - 40 + (line(".name") + line(".facts")) * scale), `${scale}`);
    }
  });

  it("grows with the text scale", () => {
    const text = cardText(entry(), null, separators, "Locked", 0);

    assert.ok(cardWidth(text, 1.3) > cardWidth(text, 1));
  });

  it("puts a label's name and count in caps on a plate of their own, tracked and padded as the stylesheet draws them", () => {
    const plate = declarationsOf(LABELS, ".label");
    const font = rem(/calc\(([\d.]+rem)/.exec(plate["font-size"])![1]);
    const tracking = rem(plate["letter-spacing"]);

    assert.ok(labelWidth("Small Roads", "66", 1) > textWidth("SMALL ROADS", 10));
    // Every character is tracked, the count's too.
    near(labelWidth("Small Roads", "66", 1),
      2 * rem(sides(plate.padding)[1]) + textWidth("SMALL ROADS", font) + rem(plate.gap) + textWidth("66", font) + 13 * tracking + 2);
  });
});

describe("the room a held card's or a label's name is planned in", () => {
  it("is a held card's width less its picture, padding and sorted column, at the name's own type", () => {
    const text = cardText(entry({ name: "A Very Long Hospital Name Indeed" }), "capacity", separators, "Locked", 0);
    const box = cardNameBox(text, 150, 1.3);

    near(box.width, 150 - (cardWidth(text, 1.3) - textWidth(text.name, 14 * fontSizeRatio("s", 1.3)) - 2) - 2);
    assert.equal(box.lines, 1);
    near(box.font, 14 * fontSizeRatio("s", 1.3));
    // At the card's own width the whole name fits.
    assert.ok(planName(text.name, cardNameBox(text, cardWidth(text, 1), 1)).whole);
  });

  it("is a label plate's room beside its count, tracked as the stylesheet draws it, or its square's over two lines", () => {
    const plate = declarationsOf(LABELS, ".label");
    const font = rem(/calc\(([\d.]+rem)/.exec(plate["font-size"])![1]);
    const tracking = rem(plate["letter-spacing"]);
    const [, padding] = sides(plate.padding).map(rem);
    const [, stacked] = sides(declarationsOf(LABELS, ".stacked").padding).map(rem);

    assert.deepEqual(labelNameBox("66", 171, false, 1, 27), { width: 171 - 2 * padding - rem(plate.gap) - textWidth("66", font) - 2 * tracking, lines: 1, font, tracking });
    assert.deepEqual(labelNameBox("62", 64, true, 1.3, 64), { width: 64 - 2 * stacked, lines: 2, font: font * 1.3, tracking });
    // A plate sized from its words holds them whole.
    assert.ok(planName("SMALL ROADS", labelNameBox("66", labelWidth("Small Roads", "66", 1), false, 1, 27)).whole);
  });

  it("plans an icons label's name in the lines its 44 plate holds over its count, so no scale clips it", () => {
    const line = rem(/calc\(([\d.]+rem)/.exec(declarationsOf(LABELS, ".label")["line-height"])![1]);
    const held = [1, 1.25, 1.5].map((scale) => {
      const box = labelNameBox("12", 90, true, scale, 44);
      const plan = planName("PROPS NATURE", box);
      assert.ok((plan.lines.length + 1) * line * scale <= 44, `${plan.lines.length} lines and the count at ${scale}`);
      return box.lines;
    });

    assert.deepEqual(held, [2, 1, 1]);
    // A tile's square holds two lines over its count at 150%.
    assert.equal(labelNameBox("12", 64, true, 1.5, 64).lines, 2);
  });
});

describe("the cards' rows", () => {
  it("packs each card after the last, a gap apart, and wraps one that would pass the row's end", () => {
    assert.deepEqual(packCards([{ width: 300 }, { width: 300 }, { width: 100 }], 700), [
      { left: 0, row: 0, width: 300 },
      { left: 300 + CARD_GAP, row: 0, width: 300 },
      { left: 0, row: 1, width: 100 },
    ]);
  });

  it("holds a card wider than the row to the row", () => {
    assert.deepEqual(packCards([{ width: 900 }], 700), [{ left: 0, row: 0, width: 700 }]);
  });

  it("starts an own-line cell on a fresh row and gives it the whole of it", () => {
    assert.deepEqual(packCards([{ width: 100 }, { width: 50, ownLine: true }, { width: 100 }], 700), [
      { left: 0, row: 0, width: 100 },
      { left: 0, row: 1, width: 700 },
      { left: 0, row: 2, width: 100 },
    ]);
  });
});
