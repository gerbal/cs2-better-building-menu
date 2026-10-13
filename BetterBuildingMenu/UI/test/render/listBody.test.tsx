import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { declarationsOf } from "../harness/compiledCss";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid, PLATE1_HEIGHT, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { ListBody } from "../../src/mods/Bodies/ListBody";

const grid = (over: Partial<BodyGridInput> = {}) => bodyGrid({
  body: "list", boxWidth: 706, bodyHeight: 144.25, textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, ...over,
});
const rows = (n: number, over: (id: number) => Partial<BuildingCatalogEntry> = () => ({})) =>
  Array.from({ length: n }, (_, at) => entry(at + 1, over(at + 1)));
const render = (entries: BuildingCatalogEntry[], options: { enterId?: number | null; over?: Partial<BodyGridInput> } = {}) =>
  renderHtml(<ListBody entries={entries} grid={grid(options.over)} enterId={options.enterId ?? null} onPlace={() => undefined} footer={<div className="loadMoreRow" />} />);

describe("the list", () => {
  beforeEach(() => resetBindings());

  it("draws each building on a plate at its slot, four across and five down the game's own box", () => {
    const html = render(rows(21));

    assert.equal(count(html, /data-bbm-item="true"/), 21);
    assert.match(html, /data-catalog-entry="1"[^>]*/);
    // Slot 5 starts the second line, one plate and a gap down.
    assert.match(html, /left:0rem;top:29\.25rem;width:171rem;height:27\.25rem[^>]*data-catalog-entry="5"/);
    assert.match(html, /left:519rem;top:0rem;width:171rem;height:27\.25rem[^>]*data-catalog-entry="4"/);
  });

  it("marks the region the live check counts in, and every picture, name and number inside each plate", () => {
    const html = render(rows(3));

    assert.match(html, /data-bbm-view="list"/);
    assert.equal(count(html, /data-bbm-pic="true"/), 3);
    assert.equal(count(html, /data-bbm-fact="true"/), 3);
    assert.match(html, /data-bbm-name="10"[^>]*>Building 1<\/p>/);
  });

  it("writes each name as plain text in an inline paragraph, two lines at 100% text", () => {
    const html = render(rows(1, () => ({ name: "Two-Lane One-Way Half Road Left" })));

    assert.match(html, /<p class="name" data-bbm-name="31" cohinline="">Two-Lane One-Way Half Road Left<\/p>/);
  });

  it("says the cost over the capacity, right of the name", () => {
    const html = render(rows(1, () => ({ constructionCost: 1000, capacity: 20 })));

    assert.match(html, /<span class="first">¢1[^<]*000<\/span><\/span><span class="second">20[^<]*<\/span>/);
  });

  it("fills the armed building, and only it", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 2);
    const html = render(rows(3));

    assert.equal(count(html, /class="plate armed"/), 1);
    assert.match(html, /class="plate armed"[^>]*data-catalog-entry="2"/);
  });

  it("marks Enter's target with ↵ beside its numbers, and nothing without a target", () => {
    assert.equal(count(render(rows(3), { enterId: 3 }), /class="enterMark"/), 1);
    // The mark and the number each their own box: no bare text beside an element in a flex row.
    assert.match(render(rows(3), { enterId: 3 }), /data-catalog-entry="3"[\s\S]*<img class="enterMark"[^>]*><span class="first">¢/);
    assert.equal(count(render(rows(3)), /class="enterMark"/), 0);
  });

  it("says a locked building's milestone in the cost's place", () => {
    const html = render(rows(1, () => ({ isLocked: true, unlockMilestone: 7 } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /class="plate locked"/);
    assert.match(html, /<span class="first milestone">MS 7<\/span>/);
    assert.match(html, /aria-disabled="true"/);
  });

  it("says the locked word in the cost's place once the city has reached the building's milestone", () => {
    // Only the development tree holds it back now; "MS 7" would send the player after a milestone they have.
    setBinding("milestone", "achievedMilestone", 7);
    const html = render(rows(1, () => ({ isLocked: true, unlockMilestone: 7 } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /<span class="first milestone">Locked<\/span>/);
  });

  it("keeps the game's unique mark on a unique building, shown on hover as 0.2.x's list did", () => {
    const html = render(rows(1, () => ({ isUnique: true } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /<img class="mark uniqueMark" src="Media\/Game\/Icons\/Unique\.svg"/);
    assert.doesNotMatch(html, /class="plate built"/);
  });

  it("marks a unique the city already holds as built, dimmed and unplaceable", () => {
    const html = render(rows(1, () => ({ isUnique: true, isAlreadyBuilt: true } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /<img class="mark builtMark" src="Media\/Game\/Icons\/AlreadyBuilt\.svg"/);
    assert.match(html, /class="plate built"/);
    assert.match(html, /aria-disabled="true"/);
  });

  it("draws no mark on a building that is not unique", () => {
    assert.doesNotMatch(render(rows(2)), /class="mark /);
  });

  it("draws three one-line plates across above 100% text, and whole two-line ones under Whole names", () => {
    const more = render(rows(1), { over: { textScale: 1.3 } });
    const whole = render(rows(1), { over: { textScale: 1.3, atLargeText: "wholeNames" } });

    assert.match(more, /class="plate largeText oneLinePlate"[^>]*style="left:0rem;top:0rem;width:228\.6666/);
    assert.match(more, /class="name oneLine"/);
    assert.match(whole, /height:34\.56rem/);
    assert.match(whole, /<p class="name" /);
  });

  // A length the stylesheet scales with the game's text, as calc(N rem * var(--fontScale)), at this scale.
  const scaled = (selector: string, prop: string, scale: number): number => {
    const value = declarationsOf("mods/Bodies/listBody.module.scss", selector)[prop];
    const factor = /^calc\((\d*\.?\d+)rem \* var\(--fontScale\)\)$/.exec(value ?? "");
    assert.ok(factor, `${selector} ${prop} is ${value}`);
    return Number(factor[1]) * scale;
  };

  for (const scale of [1.1, 1.3, 1.5]) {
    it(`says one number on a one-line plate at ${Math.round(scale * 100)}% text, which fits the plate`, () => {
      const html = render(rows(1, () => ({ constructionCost: 85000, capacity: 400 })), { over: { textScale: scale } });
      const lines = count(html, /<span class="(?:first|second)(?: [^"]*)?">/);

      assert.equal(count(html, /class="second"/), 0);
      assert.match(html, /<span class="first">¢85[^<]*000<\/span>/);
      assert.equal(lines, 1);
      assert.ok(lines * scaled(".numbers", "line-height", scale) <= PLATE1_HEIGHT, `${lines} lines at ${scale}`);
      assert.ok(scaled(".oneLine", "max-height", scale) <= PLATE1_HEIGHT);
    });
  }

  it("draws a one-line plate's picture inside the plate, whole", () => {
    const html = render(rows(1), { over: { textScale: 1.5 } });
    const side = (selector: string) => Number(/^(\d*\.?\d+)rem$/.exec(declarationsOf("mods/Bodies/listBody.module.scss", selector).height ?? "")?.[1]);

    assert.match(html, /class="plate largeText oneLinePlate"/);
    assert.ok(side(".oneLinePlate .artwork") <= PLATE1_HEIGHT);
    assert.ok(side(".oneLinePlate .artwork .picture") <= PLATE1_HEIGHT);
  });

  it("says the sorted value as a one-line plate's number under a sort by a number, in the cost's place", () => {
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Capacity");
    const sorted = render(rows(1, () => ({ constructionCost: 85000, capacity: 400 })), { over: { textScale: 1.5 } });

    assert.match(sorted, /<div class="numbers" data-bbm-fact="true"><span class="firstLine"><span class="first">400[^<]*<\/span><\/span><\/div>/);
  });

  it("keeps the cost over the capacity on a whole-name plate at large text", () => {
    const html = render(rows(1, () => ({ constructionCost: 85000, capacity: 400 })), { over: { textScale: 1.5, atLargeText: "wholeNames" } });

    assert.match(html, /<span class="first">¢85[^<]*000<\/span><\/span><span class="second">400[^<]*<\/span>/);
  });

  it("ends the feed inside the scroll, below the slots", () => {
    const html = render(rows(2));

    assert.ok(html.indexOf('class="loadMoreRow"') > html.indexOf('data-scrollable="true"'));
    assert.ok(html.indexOf('class="loadMoreRow"') > html.indexOf('class="slots"'));
  });

  it("draws no title, which Cohtml never shows", () => {
    assert.doesNotMatch(render(rows(2)), / title="/);
  });
});
