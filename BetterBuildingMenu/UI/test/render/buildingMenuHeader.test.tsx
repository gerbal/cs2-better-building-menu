import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, count } from "../harness/render";
import { resetBindings } from "../harness/stubs/cs2-api";
import { seed } from "../harness/seed";
import { BuildingMenuHeader } from "../../src/mods/BuildingMenu/BuildingMenuHeader";
import { AssetMenu$, CurrentSearch$ } from "../../src/mods/bindings";

describe("the menu header", () => {
  beforeEach(() => {
    resetBindings();
    seed(CurrentSearch$, "road");
    seed(AssetMenu$, "Roads");
  });

  it("provides explicit labels for its icon actions", () => {
    const html = renderHtml(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />);

    assert.match(html, /aria-label="Clear search"/);
    assert.match(html, /aria-label="Close"/);
  });

  it("hides every decorative image from assistive readers", () => {
    const html = renderHtml(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />);
    const images = count(html, /<img /);

    assert.ok(images > 0, "expected the header to draw its icons");
    assert.equal(count(html, /<img [^>]*alt="" aria-hidden="true"/), images);
  });

  it("draws no close control when the game hands it no close", () => {
    // The asset menu must still render if the game ever mounts it without one.
    const html = renderHtml(<BuildingMenuHeader small={false} large={false} />);

    assert.doesNotMatch(html, /aria-label="Close"/);
  });
});
