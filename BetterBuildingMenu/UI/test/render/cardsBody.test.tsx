import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { resetTranslations, setTranslation } from "../harness/stubs/cs2-l10n";
import type { BuildingCatalogEntry, CatalogSection } from "../../src/domain/buildingCatalog";
import { CardsBody } from "../../src/mods/Bodies/CardsBody";
import { useCardsLayout } from "../../src/mods/BuildingCatalog/useCardsLayout";

const rows = (n: number, over: (id: number) => Partial<BuildingCatalogEntry> = () => ({})) =>
  Array.from({ length: n }, (_, at) => entry(at + 1, over(at + 1)));
// The catalog lays the cards out and the body draws them, as BuildingCatalog does.
const Cards = ({ entries, sections, enterId }: { entries: BuildingCatalogEntry[]; sections?: CatalogSection[]; enterId?: number }) => {
  const layout = useCardsLayout("cards", entries, sections);
  return layout && <CardsBody layout={layout} enterId={enterId ?? null} onPlace={() => undefined} />;
};
const render = (entries: BuildingCatalogEntry[], options: { sections?: CatalogSection[]; enterId?: number } = {}) =>
  renderHtml(<Cards entries={entries} sections={options.sections} enterId={options.enterId} />);
const group = (start: number, label: string, count: number, labelId = ""): CatalogSection =>
  ({ id: `group:${start}`, kind: "group", label, labelId, start, count, collapsed: false });

describe("the cards", () => {
  beforeEach(() => resetBindings());

  it("draw each card where the packer puts it, 46 tall, and mark it for the live check", () => {
    const html = render(rows(3));

    assert.match(html, /data-bbm-view="cards"/);
    assert.match(html, /class="card" style="left:0rem;top:0rem;width:[\d.]+rem;height:46rem"[^>]*data-catalog-entry="1"[^>]*data-bbm-item="true"/);
    assert.equal(count(html, /data-bbm-pic="true"/), 3);
    assert.match(html, /<span class="name" data-bbm-name="10">Building 1<\/span>/);
    assert.equal(count(html, /data-bbm-fact="true"/), 3);
    // The menu's one hover card says each building: no card carries a tooltip of its own.
    assert.equal(count(html, /data-tooltip/), 0);
  });

  it("place each card after the last, a gap apart, and start the next row a row's pitch down, in whole thousandths of a rem", () => {
    const html = render(rows(4), { sections: [group(0, "Small Roads", 66)] });
    const places = [...html.matchAll(/style="left:([\d.]+)rem;top:([\d.]+)rem;width:([\d.]+)rem/g)].map((m) => m.slice(1).map(Number));

    const after = (at: number) => Math.round((places[at][0] + places[at][2] + 4) * 1000) / 1000;

    // The label and two cards fill the game's own 690 rem row; the third card starts the next.
    assert.deepEqual([places[1][0], places[2][0]], [after(0), after(1)]);
    assert.deepEqual([places[3][0], places[3][1]], [0, 49.125]);
    assert.deepEqual([places[4][0], places[4][1]], [after(3), 49.125]);
    assert.doesNotMatch(html, /\d\.\d{4,}rem/);
  });

  it("say the lot, the cost and the capacity, each in a box of its own, a dot between", () => {
    const html = render(rows(1));

    assert.match(html, /<span class="facts" data-bbm-fact="true"><span class="factRun"><span class="fact">4[^<]*4<\/span><\/span><span class="factRun"><span class="factDot" aria-hidden="true">·<\/span><span class="fact">¢1[^<]*000<\/span><\/span>/);
    assert.match(html, /<span class="fact">20 patients<\/span>/);
  });

  it("say a locked card's milestone beside its lock and keep its cost, and the locked word once the city is past it", () => {
    const locked = rows(1, () => ({ isLocked: true, unlockMilestone: 4 } as Partial<BuildingCatalogEntry>));

    assert.match(render(locked), /LockRaster\.png[^>]*><span class="milestone">MS 4<\/span><span class="factDot"[^>]*>·<\/span><span class="factRun"><span class="fact">4/);
    assert.match(render(locked), /<span class="fact">¢1[^<]*000<\/span>/);
    assert.match(render(locked), /class="card locked"/);
    setBinding("milestone", "achievedMilestone", 4);
    assert.match(render(locked), /<span class="milestone">Locked<\/span>/);
  });

  it("keep the game's unique and already-built marks on the picture", () => {
    assert.match(render(rows(1, () => ({ isUnique: true } as Partial<BuildingCatalogEntry>))), /<img class="mark uniqueMark" src="Media\/Game\/Icons\/Unique\.svg"/);
    assert.match(render(rows(1, () => ({ isUnique: true, isAlreadyBuilt: true } as Partial<BuildingCatalogEntry>))), /class="card built"[\s\S]*<img class="mark builtMark"/);
  });

  it("draw the value sorted by in a column at each card's right under a sort by a number", () => {
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Capacity");

    assert.match(render(rows(1)), /<span class="sorted">20 patients<\/span>/);
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Default");
    assert.doesNotMatch(render(rows(1)), /class="sorted"/);
  });

  it("mark Enter's target with ↵ on its picture, and no other card", () => {
    const html = render(rows(3), { enterId: 2 });

    assert.equal(count(html, /class="enterBadge"/), 1);
    assert.match(html, /data-catalog-entry="2"[\s\S]*?<span class="enterBadge"><img class="enterMark"/);
  });

  it("fill the armed card, and only it", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 2);

    assert.equal(count(render(rows(3)), /class="card armed"/), 1);
  });

  it("draw each group's label in the rows with the cards", () => {
    const html = render(rows(3), { sections: [group(0, "Small Roads", 66), group(2, "Medium Roads", 34)] });

    assert.match(html, /<div class="label" style="left:0rem;top:0rem;width:[\d.]+rem;height:46rem" data-bbm-label="group"><span class="planned labelText"><span class="line">SMALL ROADS<\/span><\/span><span class="labelCount">66<\/span>/);
    assert.equal(count(html, /data-bbm-label="group"/), 2);
  });

  it("size a label's plate from the word it draws: the game's, in the player's language", () => {
    const sections = [group(0, "Small Roads", 66, "RoadsSmallRoads")];
    const width = (html: string) => Number(/class="label" style="left:0rem;top:0rem;width:([\d.]+)rem/.exec(html)?.[1]);
    const english = width(render(rows(1), { sections }));

    setTranslation("SubServices.NAME[RoadsSmallRoads]", "Routes de petite taille\n");
    try {
      const html = render(rows(1), { sections });

      assert.match(html, /<span class="line">ROUTES DE PETITE TAILLE<\/span>/);
      assert.ok(width(html) > english, `${width(html)} is not wider than ${english}`);
    } finally {
      resetTranslations();
    }
  });

  it("make two rows of 50 under the Card height knob, the rows centred in the body", () => {
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, cardHeight: 50 });

    assert.match(render(rows(1)), /class="card" style="left:0rem;top:20\.12rem;width:[\d.]+rem;height:50rem"/);
  });

  it("plan the name of a card the packer holds to the row on its one line, cut with \"…\", and no other card's", () => {
    // 56 ideographs, a whole em each, pass the game's own 706 box's row.
    const long = "漢".repeat(56);
    const html = render([entry(1, { name: long }), entry(2)]);

    // Cut by the planner, its head and its tail kept: Cohtml draws no CSS ellipsis.
    assert.match(html, /<span class="planned name nameHeld" data-bbm-name="56"><span class="line">漢+…漢+<\/span><\/span>/);
    assert.match(html, /<span class="name" data-bbm-name="10">Building 2<\/span>/);
  });

  it("keep the word that tells a held card from its look-alike through its name's cut", () => {
    // Two names a whole em a character too wide for the row, alike but for one short word: the cheapest
    // cut would drop that word from both, and they would read alike.
    const name = (word: string) => `東京 ${word} ${Array(9).fill("漢字漢字").join(" ")} aaa駅`;
    const html = render(["Ost", "Süd"].map((word, at) => entry(at + 1, { name: name(word), distinctWord: word } as Partial<BuildingCatalogEntry>)));
    const drawn = [...html.matchAll(/class="planned name nameHeld"[^>]*><span class="line">([^<]*)</g)].map((match) => match[1]);

    assert.equal(drawn.length, 2);
    assert.ok(drawn[0].includes("…") && drawn[0].includes("Ost") && drawn[1].includes("Süd"), drawn.join(" | "));
  });

  it("draw no title, which Cohtml never shows", () => {
    assert.doesNotMatch(render(rows(2)), / title="/);
  });
});
