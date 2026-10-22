import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { mountEach } from "../harness/mount";
import { loadLocale, resetLocale } from "../harness/stubs/cs2-l10n";
import { useLabel } from "../../src/mods/useLabel";

const CLEAR = "Tooltip.LABEL[BetterBuildingMenu.ClearFilters]";

let label: (key: string, fallback: string) => string;
const Probe = () => {
  label = useLabel();
  return null;
};

describe("a label the menu draws", () => {
  const tree = mountEach();
  afterEach(() => resetLocale());

  it("is the game's word for a key the language has", () => {
    loadLocale({ [CLEAR]: "Filter löschen" });
    tree.mount(<Probe />);

    assert.equal(label(CLEAR, "Clear filters"), "Filter löschen");
  });

  it("is the English for a key the language lacks", () => {
    tree.mount(<Probe />);

    assert.equal(label(CLEAR, "Clear filters"), "Clear filters");
  });

  it("holds still until the language changes, so a memo keyed on it holds too", () => {
    tree.mount(<Probe />);
    const first = label;

    act(() => {
      tree.renderer.update(<Probe />);
    });
    assert.equal(label, first);

    loadLocale({ [CLEAR]: "Filter löschen" });
    act(() => {
      tree.renderer.update(<Probe />);
    });
    assert.notEqual(label, first);
    assert.equal(label(CLEAR, "Clear filters"), "Filter löschen");
  });
});
