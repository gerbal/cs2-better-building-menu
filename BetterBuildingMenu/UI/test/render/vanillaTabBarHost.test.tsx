import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml } from "../harness/render";
import { resetModules, setModule } from "../harness/stubs/cs2-modding";
import { declarationsOf, selectorsOf } from "../harness/compiledCss";
import { VanillaTabBarHost } from "../../src/mods/VanillaTabBarHost/VanillaTabBarHost";

const TAB_BAR = "game-ui/game/components/asset-menu/asset-category-tab-bar/asset-category-tab-bar.tsx";

describe("VanillaTabBarHost", () => {
  beforeEach(() => resetModules());

  it("draws nothing when the game has no such component", () => {
    assert.equal(renderHtml(<VanillaTabBarHost onClose={() => {}} />), "");
  });

  it("gives a mod that extends the tab bar somewhere to draw", () => {
    // Zone Color Changer adds its button beside vanilla's own bar; the bar
    // itself is hidden by the stylesheet, so only the addition shows.
    let seen: { categories?: unknown[] } = {};
    setModule(TAB_BAR, "AssetCategoryTabBar", (props: { categories?: unknown[] }) => {
      seen = props;
      return <><button>Edit Zone Colors</button><div className="vanilla-assetCategoryTabBar" /></>;
    });

    const html = renderHtml(<VanillaTabBarHost onClose={() => {}} />);

    assert.match(html, /Edit Zone Colors/);
    assert.deepEqual(seen.categories, [], "no categories of its own: ours are drawn by the strip");
  });
});

describe("the tab bar host stylesheet", () => {
  it("hides the vanilla bar by the class the game actually renders", () => {
    // The DOM class is hyphenated (asset-category-tab-bar_XYZ); a camel-cased
    // selector matched nothing and left an empty bar and its close button on
    // screen.
    const sheet = "mods/VanillaTabBarHost/vanillaTabBarHost.module.scss";
    const hidden = selectorsOf(sheet).filter((selector) => declarationsOf(sheet, selector).display === "none");

    assert.deepEqual(hidden, [".host > [class*=asset-category-tab-bar]"]);
  });
});
