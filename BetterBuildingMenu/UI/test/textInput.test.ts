import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { textInputText, textInputValue } from "../src/domain/textInput.ts";

// The vanilla TextInput hands onChange an event; storing the event itself
// throws on the first keystroke.
const change = (value: unknown) => ({ target: { value } }) as unknown as Event;

describe("reading a TextInput change", () => {
  it("takes the text from the event's target", () => {
    assert.equal(textInputValue(change("wing")), "wing");
    assert.equal(textInputValue(change("")), "");
  });

  it("answers an empty string for anything that carries no text", () => {
    assert.equal(textInputValue(null), "");
    assert.equal(textInputValue(undefined), "");
    assert.equal(textInputValue({ target: null } as unknown as Event), "");
    assert.equal(textInputValue(change(42)), "");
  });
});

describe("reading the search box's change", () => {
  it("takes the text from a textarea or the fallback input alike", () => {
    assert.equal(textInputText(change("clinic")), "clinic");
    assert.equal(textInputText(change("")), "");
  });

  it("answers undefined, not an empty search, when the event carries no text", () => {
    assert.equal(textInputText(null), undefined);
    assert.equal(textInputText({ target: null } as unknown as Event), undefined);
    assert.equal(textInputText(change(42)), undefined);
  });
});
