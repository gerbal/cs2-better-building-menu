import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { declarationsOf } from "../harness/compiledCss";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetTranslations, setTranslation } from "../harness/stubs/cs2-l10n";
import { bodyGrid, PLATE1_HEIGHT, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "../../src/domain/buildingCatalog";
import { ListBody } from "../../src/mods/Bodies/ListBody";

const grid = (over: Partial<BodyGridInput> = {}) => bodyGrid({
  body: "list", boxWidth: 706, bodyHeight: 144.25, textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, ...over,
});
const rows = (n: number, over: (id: number) => Partial<BuildingCatalogEntry> = () => ({})) =>
  Array.from({ length: n }, (_, at) => entry(at + 1, over(at + 1)));
type Options = { enterId?: number | null; over?: Partial<BodyGridInput>; sections?: CatalogSection[]; searching?: boolean };
const body = (entries: BuildingCatalogEntry[], options: Options = {}) =>
  <ListBody entries={entries} grid={grid(options.over)} sections={options.sections} searching={options.searching ?? false} enterId={options.enterId ?? null} onPlace={() => undefined} footer={<div className="loadMoreRow" />} />;
const render = (entries: BuildingCatalogEntry[], options: Options = {}) => renderHtml(body(entries, options));
const group = (start: number, label: string, count: number, labelId = ""): CatalogSection =>
  ({ id: `group:${start}`, kind: "group", label, labelId, start, count, collapsed: false });
const locked = (start: number, count: number, collapsed = false): CatalogSection =>
  ({ id: "locked", kind: "locked", label: "", labelId: "", start, count, collapsed });
const LABELS = "mods/Bodies/labelPlate.module.scss";

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

    assert.match(more, /class="plate largeText"[^>]*style="left:0rem;top:0rem;width:228\.6666/);
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

  it("draws each group's label plate in a slot of its own, with its true count, and the buildings after it a slot on", () => {
    const html = render(rows(3), { sections: [group(0, "Small Roads", 66), group(2, "Medium Roads", 34)] });

    assert.match(html, /<div class="label" style="left:0rem;top:0rem;width:171rem;height:27\.25rem" data-bbm-label="group"><span class="labelText"><span class="labelWords">Small Roads<\/span><\/span><span class="labelCount">66<\/span><\/div>/);
    assert.match(html, /left:173rem;top:0rem;width:171rem;height:27\.25rem[^>]*data-catalog-entry="1"/);
    assert.match(html, /left:519rem;top:0rem[^>]*data-bbm-label="group"><span class="labelText"><span class="labelWords">Medium Roads/);
    assert.match(html, /left:0rem;top:29\.25rem[^>]*data-catalog-entry="3"/);
    // A label is no building: the live check counts buildings only.
    assert.equal(count(html, /data-bbm-item="true"/), 3);
  });

  it("says a group's name in the game's words where the game has them, and the name C# sends where it has none", () => {
    setTranslation("SubServices.NAME[RoadsSmallRoads]", "Petites routes\n");
    try {
      const html = render(rows(2), { sections: [group(0, "Small Roads", 1, "RoadsSmallRoads"), group(1, "Medium Roads", 1, "RoadsMediumRoads")] });

      assert.match(html, /<span class="labelText"><span class="labelWords">Petites routes<\/span><\/span>/);
      assert.match(html, /<span class="labelText"><span class="labelWords">Medium Roads<\/span><\/span>/);
      assert.doesNotMatch(html, />Small Roads</);
    } finally {
      resetTranslations();
    }
  });

  it("cuts a long name on one line with an ellipsis, in a box of its own that is no flex item, its count kept whole", () => {
    // Cohtml draws no ellipsis on a flex item: the flex child takes the room, the name inside it is cut.
    const room = declarationsOf(LABELS, ".labelText");
    const words = declarationsOf(LABELS, ".labelWords");

    assert.equal(room.flex, "1 1 auto");
    assert.equal(room["min-width"], "0");
    assert.equal(room["text-overflow"], undefined);
    assert.equal(words.display, "inline-block");
    assert.equal(words["max-width"], "100%");
    assert.equal(words["text-overflow"], "ellipsis");
    assert.equal(words["white-space"], "nowrap");
    assert.equal(words.overflow, "hidden");
    assert.equal(words.flex, undefined);
    assert.equal(declarationsOf(LABELS, ".labelCount").flex, "0 0 auto");
    assert.match(render(rows(1), { sections: [group(0, "Small Roads", 1)] }), /<span class="labelText"><span class="labelWords">Small Roads<\/span><\/span>/);
    // A tile's square holds the name on as many lines as it takes, wrapped at the square's edge.
    assert.equal(declarationsOf(LABELS, ".stacked .labelWords")["white-space"], "normal");
    assert.equal(declarationsOf(LABELS, ".stacked .labelText")["align-self"], "stretch");
  });

  it("says Locked and the locked rows' count on a plate that can be pressed, in the milestone's ink", () => {
    // The window has reached the locked rows: the label sits before the first of them.
    const html = render(rows(3), { sections: [locked(2, 77)] });

    assert.match(html, /<button class="label lockedLabel" style="left:346rem;top:0rem;width:171rem;height:27\.25rem" data-has-select="true" aria-expanded="true" data-bbm-label="locked"><span class="labelText"><span class="labelWords">Locked<\/span><\/span><span class="labelCount">77<\/span><\/button>/);
    assert.match(render(rows(2), { sections: [locked(2, 77, true)] }), /aria-expanded="false"/);
    // The milestone's ink, as a locked plate's "MS n" says it, on the label plate, which a pointer lights.
    assert.equal(declarationsOf(LABELS, ".lockedLabel .labelText").color, "var(--bbm-bodyMilestone)");
    assert.equal(declarationsOf(LABELS, ".lockedLabel:hover")["background-color"], "var(--bbm-plateHover)");
  });

  it("puts a search's fifth result under the first at the third step, nearest the field, and along the row by the knob", () => {
    const step3 = { over: { boxWidth: 1091 }, searching: true };

    assert.match(render(rows(30), step3), /left:0rem;top:29\.25rem;width:177\.5rem[^>]*data-catalog-entry="5"/);
    assert.match(render(rows(30), { over: { boxWidth: 1091 } }), /left:718rem;top:0rem[^>]*data-catalog-entry="5"/);
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, searchFlow: "rowOrder" });
    assert.match(render(rows(30), step3), /left:718rem;top:0rem[^>]*data-catalog-entry="5"/);
    // A value outside the knob's list reads as shipped.
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, searchFlow: "sideways" });
    assert.match(render(rows(30), step3), /left:0rem;top:29\.25rem;width:177\.5rem[^>]*data-catalog-entry="5"/);
  });

  it("draws a small menu's big plates with the picture as tall as the plate allows, the name over the numbers", () => {
    const html = render(rows(7), { over: { menuRows: 7, smallMenusGrow: true } });

    assert.match(html, /class="plate big" style="left:0rem;top:0rem;width:171rem;height:71\.125rem"/);
    assert.match(html, /<span class="artwork" style="width:66rem;height:66rem"><img class="picture" src="" style="width:66rem;height:66rem"/);
    assert.match(html, /<span class="bigWords"><p class="name" data-bbm-name="10" cohinline="">Building 1<\/p><div class="numbers" data-bbm-fact="true">/);
    assert.match(render(rows(1)), /<span class="artwork"><img class="picture" src="" alt=""/);
  });

  it("draws the big form above 100% text with none of the one-line plate's sizes, its picture inline", () => {
    // Three rows at 130% in a body dragged tall: two lines, each past the big form's floor there.
    const html = render(rows(3), { over: { menuRows: 3, smallMenusGrow: true, textScale: 1.3, bodyHeight: 200 } });

    assert.equal(count(html, /class="plate big"/), 3);
    assert.equal(count(html, /largeText/), 0);
    assert.match(html, /<span class="artwork" style="width:66rem;height:66rem"><img class="picture" src="" style="width:66rem;height:66rem"/);
    assert.equal(count(html, /class="second"/), 3);
    // Whatever the large-text artwork sets, the big one sets for itself: its size inline, the rest in its rule.
    const sheet = "mods/Bodies/listBody.module.scss";
    const [large, big, plain] = [".largeText .artwork", ".big .artwork", ".artwork"].map((selector) => declarationsOf(sheet, selector));
    for (const prop of Object.keys(large)) {
      assert.ok(prop === "width" || prop === "height" || prop in big || large[prop] === plain[prop], prop);
    }
    assert.equal(big.flex, "0 0 auto");
  });

  it("gives the big form both numbers and Enter's mark, and a grown one-line plate one number on two name lines", () => {
    const facts = () => ({ constructionCost: 85000, capacity: 400 });
    const big = render(rows(7, facts), { enterId: 2, over: { menuRows: 7, smallMenusGrow: true } });
    const oneLine = render(rows(7, facts), { over: { menuRows: 7, smallMenusGrow: true, textScale: 1.3 } });

    assert.equal(count(big, /class="second"/), 7);
    assert.match(big, /data-catalog-entry="2"[\s\S]*?<img class="enterMark"[^>]*><span class="first">¢/);
    assert.equal(count(oneLine, /class="second"/), 0);
    assert.equal(count(oneLine, /class="name oneLine"/), 0);
    assert.match(oneLine, /class="plate largeText" style="[^"]*height:46\.75rem"/);
  });

  it("gives a label the whole line under the Block labels knob's own line, the buildings starting the next", () => {
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, blockLabels: "ownLine" });
    const html = render(rows(2), { sections: [group(0, "Small Roads", 1), group(1, "Medium Roads", 1)] });

    assert.match(html, /class="label" style="left:0rem;top:0rem;width:690rem;height:27\.25rem"/);
    assert.match(html, /left:0rem;top:29\.25rem[^>]*data-catalog-entry="1"/);
    assert.match(html, /class="label" style="left:0rem;top:58\.5rem;width:690rem/);
    assert.match(html, /left:0rem;top:87\.75rem[^>]*data-catalog-entry="2"/);
  });
});

describe("the list's Locked label under a press", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => resetBindings());
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("collapses the locked rows, and a press on a collapsed label opens them", () => {
    act(() => { root = create(body(rows(3), { sections: [locked(2, 77)] })); });
    act(() => root!.root.find((node) => node.props["data-bbm-label"] === "locked" && typeof node.props.onSelect === "function").props.onSelect());

    assert.deepEqual(triggers.at(-1), { group: "BetterBuildingMenu", name: "SetCatalogSectionCollapsed", args: ["locked", true] });

    act(() => root!.update(body(rows(2), { sections: [locked(2, 77, true)] })));
    act(() => root!.root.find((node) => node.props["data-bbm-label"] === "locked" && typeof node.props.onSelect === "function").props.onSelect());

    assert.deepEqual(triggers.at(-1), { group: "BetterBuildingMenu", name: "SetCatalogSectionCollapsed", args: ["locked", false] });
  });
});
