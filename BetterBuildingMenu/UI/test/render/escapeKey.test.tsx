import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { fakeSearchField, keysPage, type KeysPage } from "../harness/fakeKeys";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { setOpenListCloser } from "../../src/mods/BuildingMenu/openListCloser";
import { VanillaMenuWatcher } from "../../src/mods/VanillaMenuWatcher/VanillaMenuWatcher";

const globals = globalThis as unknown as Record<string, unknown>;
let page: KeysPage = keysPage();

/** An Escape from `target` through every captured listener, recording whether one stopped it. */
function escape(target: unknown) {
  const event = {
    key: "",
    keyCode: 27,
    target,
    stopped: false,
    stopPropagation() {
      event.stopped = true;
    },
  };
  act(() => page.keydown(event));
  return event;
}

const sent = () => triggers.map((call) => `${call.group}.${call.name}${call.args.length > 0 ? `:${call.args.join(",")}` : ""}`);

describe("Escape, BBM's half", () => {
  let root: ReactTestRenderer | undefined;
  let closes = 0;
  const saved = globals.document;
  const focus = (element: unknown) => {
    page.document.activeElement = element;
  };
  const listOpen = () => setOpenListCloser(() => {
    closes += 1;
  });

  beforeEach(() => {
    resetBindings();
    closes = 0;
    page = keysPage();
    globals.document = page.document;
    setBinding("BetterBuildingMenu", "ReplaceVanillaBuildMenu", true);
    setBinding("BetterBuildingMenu", "OwnsCurrentMenu", true);
    act(() => {
      root = create(<VanillaMenuWatcher />);
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    setOpenListCloser(null);
    globals.document = saved;
  });

  it("closes the open list from the search field, and the field keeps the keys", () => {
    listOpen();
    const field = fakeSearchField("road");
    focus(field);

    const event = escape(field);

    assert.equal(closes, 1);
    assert.equal(event.stopped, true, "the field's own Escape would blur it");
    assert.equal(field.blurred, 0);
    assert.deepEqual(sent(), []);
  });

  it("then clears the typed query, and the field keeps the keys", () => {
    const field = fakeSearchField("road");
    focus(field);

    const event = escape(field);

    assert.deepEqual(sent(), ["BetterBuildingMenu.SearchChanged:"]);
    assert.equal(event.stopped, true);
    assert.equal(field.blurred, 0);
  });

  it("then blurs the field and closes the menu", () => {
    const field = fakeSearchField("");
    focus(field);

    escape(field);

    assert.equal(field.blurred, 1, "the camera keys come back");
    assert.deepEqual(sent(), ["toolbar.clearAssetSelection"]);
  });

  it("closes the menu from anywhere else, an open list with it", () => {
    listOpen();

    const event = escape({ tagName: "DIV" });

    assert.equal(closes, 0, "the list goes with the menu");
    assert.equal(event.stopped, false);
    assert.deepEqual(sent(), ["toolbar.clearAssetSelection"]);
  });
});
