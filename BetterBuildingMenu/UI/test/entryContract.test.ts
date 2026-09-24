import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

/**
 * Every field the UI reads off a catalog entry must be one the backend writes.
 *
 * A field the UI reads and nothing writes compiles, yields undefined forever,
 * and looks finished. Three separate features have shipped that way.
 *
 * The two halves live in different languages, so no compiler spans them. This
 * does: BuildingCatalogEntry.Write is the wire format, buildingCatalog.ts is
 * what the UI believes, and a name in one and not the other is the bug, in
 * either direction.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const ENTRY_CS = read("../../Domain/BuildingCatalogEntry.cs");
const ENTRY_TS = read("../src/domain/buildingCatalog.ts");

/** The JSON names the C# writer emits, in the order it emits them. */
function writtenNames(): string[] {
  const names: string[] = [];
  // Two spellings, because the writer has two: the bare PropertyName call and
  // the Write* helpers (WriteNullable, WriteStringArray, WriteArray) that take
  // the name as their second argument. Missing one makes this test cry wolf.
  const pattern =
    /writer\.PropertyName\("([A-Za-z0-9_]+)"\)|Write[A-Za-z]*\(\s*writer,\s*"([A-Za-z0-9_]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(ENTRY_CS)) !== null) {
    names.push(match[1] ?? match[2]);
  }

  return names;
}

/** The field names the UI's entry interface declares. */
function declaredNames(): string[] {
  const body = ENTRY_TS.slice(ENTRY_TS.indexOf("export interface BuildingCatalogEntry"));
  const end = body.indexOf("\n}");
  const names: string[] = [];
  const pattern = /^\s{2}([A-Za-z][A-Za-z0-9_]*)\??:/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body.slice(0, end))) !== null) {
    names.push(match[1]);
  }

  return names;
}

describe("the catalog entry's two halves agree", () => {
  it("writes something for every field the UI declares", () => {
    // The direction that matters: a field the UI reads and nothing writes is
    // silently undefined at runtime.
    const written = new Set(writtenNames());
    const missing = declaredNames().filter((name) => !written.has(name));

    assert.deepEqual(
      missing,
      [],
      `declared in buildingCatalog.ts but never written by BuildingCatalogEntry.Write: ${missing.join(", ")}`,
    );
  });

  it("declares every field the backend writes", () => {
    // The other direction: a field written for nothing costs every entry, on
    // every page, and reads as used to whoever changes the writer next.
    const declared = new Set(declaredNames());
    const unread = writtenNames().filter((name) => !declared.has(name));

    assert.deepEqual(
      unread,
      [],
      `written by BuildingCatalogEntry.Write but not declared in buildingCatalog.ts: ${unread.join(", ")}`,
    );
  });

  it("finds both halves at all, so a rename cannot make this vacuous", () => {
    // A test that silently matches nothing would pass forever.
    assert.ok(writtenNames().length > 20, "expected the C# writer's property names");
    assert.ok(declaredNames().length > 20, "expected the UI entry's declared fields");
  });

  it("names no field twice on the wire", () => {
    const written = writtenNames();

    assert.equal(new Set(written).size, written.length, "a duplicate property name overwrites the first");
  });
});
