import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry } from "../harness/render";
import { resetBindings } from "../harness/stubs/cs2-api";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { BuildingHoverCard, useHoverCardContext } from "../../src/mods/BuildingHoverCard/BuildingHoverCard";

// The context is built once per grid by a hook and handed to every card; the
// test builds it the same way, one level up.
const Card = ({ subject }: { subject: BuildingCatalogEntry }) => {
  const context = useHoverCardContext();

  return (
    <BuildingHoverCard entry={subject} context={context}>
      <span>anchor</span>
    </BuildingHoverCard>
  );
};

const cardOf = (subject: BuildingCatalogEntry): string => {
  const html = renderHtml(<Card subject={subject} />);
  const start = html.indexOf('data-tooltip="true"');

  assert.ok(start >= 0, "the card's content should render beside its anchor");

  return html.slice(start);
};

describe("the hover card", () => {
  beforeEach(() => resetBindings());

  it("names the building and lists the upgrades it supports", () => {
    // supportedUpgrades, never extensions: extensions is a self-tag, empty for
    // every asset a menu can show (cm-2xvs.19).
    const card = cardOf(entry(1, { name: "Clinic", supportedUpgrades: ["Extra Wing"], extensions: ["Clinic"] }));

    assert.match(card, /Clinic/);
    assert.match(card, /Upgrades/);
    assert.match(card, /Extra Wing/);
  });

  it("says nothing about upgrades when the building supports none", () => {
    const card = cardOf(entry(1, { name: "Clinic", supportedUpgrades: [], extensions: ["Clinic"] }));

    assert.doesNotMatch(card, /Upgrades/);
  });

  it("keeps the anchor it wraps", () => {
    assert.match(renderHtml(<Card subject={entry(1)} />), /<span>anchor<\/span>/);
  });
});
