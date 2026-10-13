import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { count, renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetTranslations, setTranslation } from "../harness/stubs/cs2-l10n";
import { TopRow } from "../../src/mods/TopRow/TopRow";

const set = (name: string, value: unknown) => setBinding("BetterBuildingMenu", name, value);
const row = (withClose = true) => <TopRow width={706} rightInset={4} onClose={withClose ? () => {} : undefined} />;
const render = (withClose = true) => renderHtml(row(withClose));

/** Roads with "four" typed, and the page that answers it. */
function seedSearch(over: Record<string, unknown> = {}): void {
  set("AssetMenu", "Roads");
  set("CurrentSearch", "four");
  set("BuildingCatalog", {
    items: [],
    totalCount: 3,
    searchText: "four",
    bestMatch: { id: 7, name: "Four-Lane Road 2", menu: "Roads", index: 0 },
    allMatchesLocked: false,
    ...over,
  });
}

describe("the top row's search field", () => {
  beforeEach(() => {
    resetBindings();
    resetTranslations();
  });

  it("is a text input the player can type into, not a glyph", () => {
    set("AssetMenu", "Roads");

    assert.match(render(), /<input class="input"/);
  });

  it("says which menu it searches, in the player's language", () => {
    setTranslation("Tooltip.LABEL[BetterBuildingMenu.SearchMenu]", "Search {0}");
    set("AssetMenu", "Parks");

    assert.match(render(), /placeholder="Search Parks"/);
  });

  it("shows the game's own word where our string has no translation", () => {
    set("AssetMenu", "Parks");

    assert.match(render(), /placeholder="Search\.\.\."/);
  });

  it("names the building Enter will arm once the page answers the query, beside its mark", () => {
    seedSearch();
    const html = render();

    assert.match(html, /class="enterMark"/);
    assert.match(html, /<span class="targetName">Four-Lane Road 2<\/span>/);
  });

  it("says so, with no mark, when every match is locked", () => {
    seedSearch({ bestMatch: null, allMatchesLocked: true });
    const html = render();

    assert.match(html, /<span class="targetName">All matches locked<\/span>/);
    assert.doesNotMatch(html, /class="enterMark"/);
  });

  it("names nothing while the page still answers an older query", () => {
    seedSearch({ searchText: "fou" });

    assert.doesNotMatch(render(), /class="targetName"/);
  });

  it("offers to clear only while a query is typed, and a press clears it", () => {
    assert.doesNotMatch(render(), /aria-label="Clear search"/);

    seedSearch();
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(row());
    });
    act(() => root!.root.find((node) => node.props["aria-label"] === "Clear search" && typeof node.props.onSelect === "function").props.onSelect());

    assert.deepEqual(triggers.map((call) => [call.name, ...call.args]), [["SearchChanged", ""]]);
    act(() => root!.unmount());
  });
});

describe("the top row", () => {
  beforeEach(() => {
    resetBindings();
    resetTranslations();
  });

  it("labels its icon actions", () => {
    seedSearch();
    const html = render();

    assert.match(html, /aria-label="Clear search"/);
    assert.match(html, /aria-label="Close"/);
  });

  it("closes with the game's own round button", () => {
    // The round highlight theme paints the close's hover and press, as on the game's own close.
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(row());
    });
    const close = root!.root.find((node) => node.props["aria-label"] === "Close" && typeof node.props.onSelect === "function");

    assert.equal(close.props.variant, "round");
    act(() => root!.unmount());
  });

  it("draws no close when the game hands it none", () => {
    assert.doesNotMatch(render(false), /aria-label="Close"/);
  });

  it("hides every decorative image from assistive readers", () => {
    seedSearch();
    const html = render();
    const images = count(html, /<img /);

    assert.ok(images > 0, "expected the row to draw its icons");
    assert.equal(count(html, /<img [^>]*alt="" aria-hidden="true"/), images);
  });

  it("sets no title anywhere: the game's Tooltip carries its labels", () => {
    seedSearch();

    assert.doesNotMatch(render(), / title="/);
  });

  it("mounts without a warning from React", () => {
    // The game's TextInput takes the ref the row hands it, and so does the test stub.
    const warnings: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };

    try {
      // Two acts: one that creates and unmounts batches both, and the row never draws.
      let root: ReactTestRenderer | undefined;
      act(() => {
        root = create(row());
      });
      assert.equal(root!.root.findAllByType("input").length, 1, "the row drew its search field");
      act(() => root!.unmount());
    } finally {
      console.error = original;
    }

    assert.deepEqual(warnings.filter((warning) => /cannot be given refs/.test(warning)), []);
  });
});
