import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { count, renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetTranslations, setTranslation } from "../harness/stubs/cs2-l10n";
import { TopRow } from "../../src/mods/TopRow/TopRow";

const set = (name: string, value: unknown) => setBinding("BetterBuildingMenu", name, value);
const row = (withClose = true) => (
  <TopRow width={706} rightInset={4} open={null} onToggle={() => undefined} onClose={withClose ? () => {} : undefined} />
);
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

describe("the top row's controls", () => {
  beforeEach(() => {
    resetBindings();
    resetTranslations();
  });

  it("draw Sort, Filter, Group and View, each a word and its value, at 100% text", () => {
    const html = render();

    for (const word of ["Sort", "Filter", "Group", "View"]) {
      assert.match(html, new RegExp(`<span class="word">${word}</span><span class="value[^"]*" style="width:[0-9.]+rem">[^<]+</span>`), word);
    }
    assert.doesNotMatch(html, /class="controlGlyph"/);
  });

  it("keep their words in close's room when the game hands the row no close", () => {
    const worded = (width: number, withClose: boolean) =>
      /<span class="word">/.test(renderHtml(<TopRow width={width} rightInset={4} open={null} onToggle={() => undefined} onClose={withClose ? () => {} : undefined} />));
    const widths = Array.from({ length: 120 }, (_, at) => 706 - at * 3);

    // Somewhere the row narrows past the words with close beside them, but not without it.
    assert.ok(widths.some((width) => worded(width, false) && !worded(width, true)), "close's room is given back");
    assert.ok(widths.every((width) => worded(width, false) || !worded(width, true)), "never fewer words without close");
  });

  it("fold each to a glyph and its value from 110% text", () => {
    setBinding("options", "textScale", 1.1);
    const html = render();

    assert.equal(count(html, /class="controlGlyph"/), 4);
    assert.doesNotMatch(html, /class="word"/);
  });

  it("mark a sort or a filter set away from how the menu opens, with the dot", () => {
    set("BuildingCatalogSortColumn", "Default");
    assert.equal(count(render(), /class="dot"/), 0);

    set("BuildingCatalogSortColumn", "ConstructionCost");
    set("AssetMenuFacets", { groups: [{ id: "role", label: "Role", options: [{ id: "Hospital", label: "Hospital", selected: true }] }], hasSelection: true });
    const html = render();

    assert.equal(count(html, /class="dot"/), 2);
    assert.match(html, /<span class="value set" style="width:[0-9.]+rem">1 on<\/span>/);
  });

  it("ask to open a control's popover on a press, and draw the open one as open", () => {
    const asked: string[] = [];
    let root: ReturnType<typeof create> | undefined;
    act(() => {
      root = create(<TopRow width={706} rightInset={4} open="group" onToggle={(kind) => asked.push(kind)} onClose={() => {}} />);
    });
    const control = (word: string) =>
      root!.root.find((node) => String(node.props["aria-label"] ?? "").startsWith(`${word} · `) && typeof node.props.onSelect === "function");

    act(() => control("Filter").props.onSelect());

    assert.deepEqual(asked, ["filter"]);
    assert.ok(String(control("Group").props.className).split(" ").includes("open"));
    act(() => root!.unmount());
  });
});
