import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

// The game's count badge is the one on the toolbar's Notifications button: light bold text on the
// accent with a soft shadow. The filter rail's badge draws it, sized by the text scale.
describe("the count badge", () => {
  const rail = declarationsOf("mods/FilterRail/filterRail.module.scss", ".badge");

  it("is the game's number badge", () => {
    const game: Record<string, string> = {
      "background-color": "var(--accentColorNormal)",
      color: "var(--textColor)",
      "font-weight": "bold",
      "text-align": "center",
      "border-radius": "10rem",
      "box-shadow": "0 0 3rem 3rem rgba(0, 0, 0, 0.15)",
      height: "calc(14rem * var(--fontScale))",
      "min-width": "calc(14rem * var(--fontScale))",
      "font-size": "calc(13rem * var(--fontScale))",
      "line-height": "calc(11rem * var(--fontScale))",
      "padding-top": "1rem",
      "padding-right": "4rem",
      "padding-bottom": "0",
      "padding-left": "4rem",
    };
    for (const [property, value] of Object.entries(game)) {
      assert.equal(rail[property], value, property);
    }
  });
});
