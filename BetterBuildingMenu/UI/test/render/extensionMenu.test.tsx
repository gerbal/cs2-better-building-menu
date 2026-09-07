import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry } from "../harness/render";
import { setBinding, setMapBinding, resetBindings, triggers } from "../harness/stubs/cs2-api";
import { ExtensionMenuComponent } from "../../src/mods/ExtensionMenu/ExtensionMenu";

// The game's own UpgradesMenu, as the extension point hands it to us. What it
// renders is what the player sees whenever we decline.
const Vanilla = (props: Record<string, unknown>) => <div data-vanilla-upgrades="true" className={props.className as string} />;
const Ours = ExtensionMenuComponent(Vanilla as never) as (props: Record<string, unknown>) => JSX.Element;

const crematorium = { index: 41, version: 2 };
const listed = (name: string, index: number, over: Record<string, unknown> = {}) =>
  ({ entity: { index, version: 1 }, name, icon: "", locked: false, unique: false, placed: false, ...over });

/** The opening tag of the row button carrying this catalog id. */
const rowTag = (html: string, id: number): string => {
  const at = html.indexOf(`data-catalog-entry="${id}"`);
  assert.ok(at >= 0, `row ${id} drawn`);
  const start = html.lastIndexOf("<button", at);
  return html.slice(start, html.indexOf(">", at) + 1);
};

const render = (props: Record<string, unknown> = {}) =>
  renderHtml(<Ours focusKey="upgrades" className="toolPanel" onClose={() => {}} {...props} />);

describe("the extension picker", () => {
  beforeEach(() => {
    resetBindings();
    setBinding("BetterBuildingMenu", "ReplaceVanillaBuildMenu", true);
    setBinding("selectedInfo", "selectedEntity", crematorium);
    setMapBinding("upgradeMenu", "upgrades", crematorium, [listed("HearseGarage", 7), listed("Columbarium", 8)]);
    setBinding("BetterBuildingMenu", "BuildingExtensionMenu", {
      buildingName: "Crematorium",
      entries: [entry(8, { prefabName: "Columbarium", name: "Columbarium" }), entry(7, { prefabName: "HearseGarage", name: "Hearse Garage" })],
    });
  });

  it("leaves the panel to vanilla when the mod is not replacing menus", () => {
    setBinding("BetterBuildingMenu", "ReplaceVanillaBuildMenu", false);

    assert.match(render(), /data-vanilla-upgrades="true"/);
  });

  it("leaves the panel to vanilla when a listed upgrade has no entry behind it", () => {
    // The cold index after a save loads, or a mod's upgrade we never indexed.
    setBinding("BetterBuildingMenu", "BuildingExtensionMenu", { buildingName: "Crematorium", entries: [entry(7, { prefabName: "HearseGarage" })] });

    const html = render();
    assert.match(html, /data-vanilla-upgrades="true"/);
    assert.doesNotMatch(html, /data-catalog-entry/);
  });

  it("draws the rows in vanilla's order, under the building's name", () => {
    const html = render();

    assert.doesNotMatch(html, /data-vanilla-upgrades/);
    assert.match(html, /Crematorium/);
    const hearse = html.indexOf('data-catalog-entry="7"');
    const columbarium = html.indexOf('data-catalog-entry="8"');
    assert.ok(hearse >= 0 && columbarium >= 0, "both rows drawn");
    assert.ok(hearse < columbarium, "vanilla listed the hearse garage first");
  });

  it("takes the slot's own class, so it sits where vanilla's panel sat", () => {
    // The game passes className: toolPanel — the same column the asset menu
    // uses. Dropping it would draw the panel somewhere else on screen.
    assert.match(render(), /class="[^"]*toolPanel/);
  });

  it("shows a row vanilla says is built here as built, whatever the catalog said", () => {
    setMapBinding("upgradeMenu", "upgrades", crematorium, [listed("HearseGarage", 7, { unique: true, placed: true }), listed("Columbarium", 8)]);

    const html = render();
    const hearse = rowTag(html, 7);
    assert.match(hearse, /data-already-built="true"/);
    assert.match(hearse, /aria-disabled="true"/);
    assert.doesNotMatch(rowTag(html, 8), /data-already-built/);
  });

  it("marks the row vanilla has selected, so the active tool reads back on the list", () => {
    // Vanilla's grid highlights the tile whose tool is active; selectedUpgrade
    // is the entity it does that from.
    setBinding("upgradeMenu", "selectedUpgrade", { index: 8, version: 1 });

    const html = render();
    assert.match(rowTag(html, 8), /data-selected="true"/);
    assert.doesNotMatch(rowTag(html, 7), /data-selected/);
  });

  it("does not state a capacity of zero as a fact", () => {
    // A clinic adds no students. "0 students" beside the ones that do is
    // noise dressed as a figure; the wing's 500 is the only capacity here.
    setBinding("BetterBuildingMenu", "BuildingExtensionMenu", {
      buildingName: "Elementary School",
      entries: [
        entry(7, { prefabName: "HearseGarage", name: "Clinic", category: "ServiceBuildings", subCategory: "ServiceBuildings_EducationResearch", capacity: 0 }),
        entry(8, { prefabName: "Columbarium", name: "Wing", category: "ServiceBuildings", subCategory: "ServiceBuildings_EducationResearch", capacity: 500 }),
      ],
    });

    const html = render();
    assert.doesNotMatch(html, /[^0-9]0 students/);
    assert.match(html, /500 students/);
  });

  it("hands the close to the game's own onClose", () => {
    let closed = 0;
    const html = renderHtml(<Ours focusKey="upgrades" className="toolPanel" onClose={() => { closed++; }} />);

    assert.match(html, /aria-label="Close"/);
    assert.equal(closed, 0);
    assert.equal(triggers.length, 0);
  });
});
