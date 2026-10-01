import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

// The toggle's filter count reads as the pane's own filter badge does: dark on the
// accent, and as large as the player's text scale makes the rest of the text.
describe("the pane toggle's filter badge", () => {
  const badge = declarationsOf("mods/ControlPaneToggle/controlPaneToggle.module.scss", ".badge");
  const railBadge = declarationsOf("mods/FilterRail/filterRail.module.scss", ".badge");

  it("is dark on the accent, as the filter rail's badge is", () => {
    assert.equal(badge["background-color"], railBadge["background-color"]);
    assert.equal(badge.color, railBadge.color);
  });

  it("grows with the text scale", () => {
    assert.equal(badge["font-size"], "var(--fontSizeXS)");
    for (const property of ["height", "min-width", "line-height"]) {
      assert.match(badge[property] ?? "", /var\(--fontScale\)/, property);
    }
  });
});
