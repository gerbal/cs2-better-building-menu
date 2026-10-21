import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Command } from "../src/domain/commands.ts";

describe("commands to C#", () => {
  it("types a command by the trigger table generated from C#", () => {
    // Checked by the typecheck: each line must be refused, or the directive above it fails.
    // @ts-expect-error no system registers this name
    const unregistered: Command = { method: "NoSuchTrigger", args: [] };
    // @ts-expect-error SetAssetMenuHeight reads a number
    const mistyped: Command = { method: "SetAssetMenuHeight", args: ["tall"] };
    // @ts-expect-error SetVanillaToolbarSelection reads four arguments
    const short: Command = { method: "SetVanillaToolbarSelection", args: ["", ""] };

    assert.equal([unregistered, mistyped, short].length, 3);
  });
});
