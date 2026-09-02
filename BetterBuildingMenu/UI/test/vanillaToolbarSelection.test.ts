import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  joinEntityIndices,
  toolbarSelectionKey,
  setVanillaToolbarSelectionCommand,
} from "../src/domain/vanillaToolbarSelection.ts";

describe("Carrying the vanilla toolbar row to the backend", () => {
  it("joins entity indices in the order the toolbar gave them", () => {
    assert.equal(joinEntityIndices([{ index: 11 }, { index: 22 }]), "11,22");
  });

  it("accepts every shape the binding uses", () => {
    // The binding hands out a bare number, a string, or an {index, version}
    // pair depending on which one it is.
    assert.equal(joinEntityIndices([11, "22", { index: 33, version: 1 }]), "11,22,33");
  });

  it("drops entries that resolve to nothing rather than sending NaN", () => {
    // A NaN crossing the bridge becomes an index that matches no asset, which
    // would hide the whole menu instead of filtering it.
    assert.equal(joinEntityIndices([{ index: 11 }, "nonsense", 0, null as any]), "11");
  });

  it("treats an empty or absent list as no selection", () => {
    assert.equal(joinEntityIndices([]), "");
    assert.equal(joinEntityIndices(null), "");
    assert.equal(joinEntityIndices(undefined), "");
  });

  it("gives the same row the same key so an unchanged toolbar forwards once", () => {
    // The bindings re-emit on unrelated churn with fresh array identities, and
    // every spurious forward costs a full catalog rebuild.
    const a = { themes: [{ index: 11 }], packs: [], vanillaSelected: false, modsSelected: false };
    const b = { themes: [{ index: 11 }], packs: [], vanillaSelected: false, modsSelected: false };

    assert.equal(toolbarSelectionKey(a), toolbarSelectionKey(b));
  });

  it("distinguishes every part of the row", () => {
    const base = { themes: [], packs: [], vanillaSelected: false, modsSelected: false };
    const keys = new Set([
      toolbarSelectionKey(base),
      toolbarSelectionKey({ ...base, themes: [{ index: 11 }] }),
      toolbarSelectionKey({ ...base, packs: [{ index: 11 }] }),
      toolbarSelectionKey({ ...base, vanillaSelected: true }),
      toolbarSelectionKey({ ...base, modsSelected: true }),
    ]);

    assert.equal(keys.size, 5);
  });

  it("does not confuse a theme selection with a pack one", () => {
    // Both are entity-index lists, so a key that simply concatenated them
    // would collide: themes [1] packs [] against themes [] packs [1].
    const asTheme = toolbarSelectionKey({ themes: [{ index: 1 }], packs: [], vanillaSelected: false, modsSelected: false });
    const asPack = toolbarSelectionKey({ themes: [], packs: [{ index: 1 }], vanillaSelected: false, modsSelected: false });

    assert.notEqual(asTheme, asPack);
  });

  it("sends the two lists as strings and the two toggles as booleans", () => {
    const command = setVanillaToolbarSelectionCommand({
      themes: [{ index: 11 }],
      packs: [{ index: 7 }, { index: 8 }],
      vanillaSelected: true,
      modsSelected: false,
    });

    assert.equal(command.method, "SetVanillaToolbarSelection");
    assert.deepEqual([...command.args], ["11", "7,8", true, false]);
  });
});
