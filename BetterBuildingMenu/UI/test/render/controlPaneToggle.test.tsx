import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { create } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { ControlPaneToggle } from "../../src/mods/ControlPaneToggle/ControlPaneToggle";
import { BuildingMenuHeader } from "../../src/mods/BuildingMenu/BuildingMenuHeader";

const toggle = (shown: boolean, filterCount: number) =>
  renderHtml(<ControlPaneToggle shown={shown} filterCount={filterCount} onToggle={() => {}} />);

describe("the options toggle", () => {
  it("reads as pressed while the pane is shown, and says it will hide it", () => {
    const html = toggle(true, 0);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-label="Hide options"/);
  });

  it("says it will show the pane while the pane is hidden", () => {
    const html = toggle(false, 0);
    assert.match(html, /aria-pressed="false"/);
    assert.match(html, /aria-label="Show options"/);
  });

  it("counts the filters that are on, in its label and its badge", () => {
    assert.match(toggle(false, 1), /aria-label="Show options \(1 filter on\)"/);
    const two = toggle(false, 2);
    assert.match(two, /aria-label="Show options \(2 filters on\)"/);
    assert.match(two, /<span class="badge" aria-hidden="true">2<\/span>/);
  });

  it("draws no badge with no filter on", () => {
    assert.doesNotMatch(toggle(true, 0), /class="badge"/);
  });

  it("hides its icon from assistive readers", () => {
    assert.match(toggle(true, 0), /<img class="glyph"[^>]*alt="" aria-hidden="true"/);
  });
});

describe("the options toggle in the menu header", () => {
  beforeEach(() => resetBindings());

  it("is drawn whether or not the game hands the header a close", () => {
    assert.match(renderHtml(<BuildingMenuHeader />), /aria-label="Hide options"/);
  });

  it("asks C# for the other state", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const root = create(<BuildingMenuHeader />).root;
    root.find((node) => node.props["aria-label"] === "Show options" && typeof node.props.onSelect === "function").props.onSelect();

    assert.deepEqual(triggers.filter((call) => call.name === "SetControlPaneShown").map((call) => call.args), [[true]]);
  });
});
