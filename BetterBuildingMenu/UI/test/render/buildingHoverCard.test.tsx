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

describe("recreation on the hover card", () => {
  beforeEach(() => resetBindings());

  it("says how much recreation, not only which kind", () => {
    // "Outdoor recreation" alone does not separate a bench from a botanical
    // garden, and the amount is the figure a player compares. The kind's word
    // comes from the game (Properties.LEISURE_TYPE), so the test harness has
    // no translation for it and the enum is spelled out instead.
    const card = cardOf(entry(1, {
      name: "City Park",
      leisureType: "CityPark",
      leisureEfficiency: 60,
    } as Partial<BuildingCatalogEntry>));

    // The KIND is the label and the amount is the figure, like every other
    // line on the card. It used to read "Recreation: Outdoor Recreation 1",
    // whose label repeated the word already in the value.
    //
    // Not "1 Outdoor" under a "Recreation" label, which was the other
    // candidate: that needs the word "Recreation" stripped off a LOCALIZED
    // string, and three of the seven leisure types do not contain it in
    // English at all ("1 Meals"), while German has "Erholung im Innenraum" and
    // Italian "Servizi ricreativi al chiuso" — nothing to strip in either.
    assert.match(card, /City Park<\/span><span[^>]*>60/);
  });

  it("shows the kind alone when the building carries no amount", () => {
    const card = cardOf(entry(2, {
      name: "Plaza",
      leisureType: "CityPark",
    } as Partial<BuildingCatalogEntry>));

    assert.match(card, /City Park/);
    assert.doesNotMatch(card, /NaN|undefined/);
  });

  it("says nothing at all for a building that provides no recreation", () => {
    const card = cardOf(entry(3, { name: "Fire Station" }));

    assert.doesNotMatch(card, /Recreation/);
  });
});
