import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { ToolbarIconComponent } from "../../src/mods/ToolbarIcon/ToolbarIcon";

const Vanilla = () => <span data-vanilla="toggle" />;
const Extended = ToolbarIconComponent(Vanilla);

describe("the toolbar picker icon", () => {
  beforeEach(() => resetBindings());

  it("adds our picker before the vanilla toggle", () => {
    const html = renderHtml(<Extended />);

    assert.match(html, /PickerPicker\.svg/);
    assert.match(html, /data-vanilla="toggle"/);
  });

  it("stands down when upstream Find It is installed, which ships the same picker", () => {
    setBinding("BetterBuildingMenu", "FindItPresent", true);
    const html = renderHtml(<Extended />);

    assert.doesNotMatch(html, /PickerPicker\.svg/);
    assert.match(html, /data-vanilla="toggle"/);
  });
});
