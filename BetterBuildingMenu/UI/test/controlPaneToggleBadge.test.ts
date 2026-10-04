import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

// The game's count badge is the one on the toolbar's Notifications button: light
// bold text on the accent with a soft shadow. Both of the mod's badges draw it,
// sized by the text scale.
describe("the count badges", () => {
  const toggle = declarationsOf("mods/ControlPaneToggle/controlPaneToggle.module.scss", ".badge");
  const rail = declarationsOf("mods/FilterRail/filterRail.module.scss", ".badge");

  it("are the game's number badge", () => {
    for (const badge of [toggle, rail]) {
      assert.equal(badge["background-color"], "var(--accentColorNormal)");
      assert.equal(badge.color, "var(--textColor)");
      assert.equal(badge["font-weight"], "bold");
      assert.equal(badge["border-radius"], "10rem");
      assert.equal(badge["box-shadow"], "0 0 3rem 3rem rgba(0, 0, 0, 0.15)");
      assert.match(badge.height ?? "", /14rem \* var\(--fontScale\)/);
      assert.match(badge["font-size"] ?? "", /13rem \* var\(--fontScale\)/);
    }
  });

  it("look the same on the pane button and on the filter rail", () => {
    for (const property of ["height", "min-width", "font-size", "line-height", "padding-top", "padding-left", "border-radius", "color", "background-color", "font-weight", "box-shadow"]) {
      assert.equal(toggle[property], rail[property], property);
    }
  });
});
