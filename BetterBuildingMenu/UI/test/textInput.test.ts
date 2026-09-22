import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { textInputValue } from "../src/domain/textInput.ts";

// The vanilla TextInput hands onChange an event; FilterRail once stored the
// event itself and threw on the first keystroke.
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
