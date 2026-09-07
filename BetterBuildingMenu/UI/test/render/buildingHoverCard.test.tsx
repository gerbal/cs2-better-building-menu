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

describe("cargo capacity on the card", () => {
  it("shows a warehouse's storage in tonnes, under the game's own label", () => {
    // A cargo harbour's Warehouses upgrade carries StorageLimitData; vanilla's
    // tooltip shows it as Cargo capacity in the weight unit. Ours showed
    // nothing for it.
    resetBindings();
    const card = cardOf(entry(1, { serviceFacts: [{ key: "cargoCapacity", value: 500000 }] }));

    assert.match(card, /Cargo capacity/);
    assert.match(card, /500 t/);
  });
});

describe("two tiers on the card", () => {
  // Vanilla's figures first and bright; ours after a divider, dimmer. The two
  // used to blend into one list, and the game's own facts are the ones a
  // player already knows how to read.
  it("puts the game's figures before ours, and marks our block", () => {
    resetBindings();
    const card = cardOf(entry(1, {
      constructionCost: 100000,
      capacity: 200000,
      workers: 37,
      serviceFacts: [{ key: "xpReward", value: 300 }, { key: "cargoCapacity", value: 20000 }],
    }));

    const cost = card.indexOf("Cost");
    const cargo = card.indexOf("Cargo capacity");
    const divider = card.indexOf('data-tier="extra"');
    const workers = card.indexOf("Workers");
    const xp = card.indexOf("XP");

    assert.ok(cost >= 0 && cargo >= 0 && divider >= 0 && workers >= 0 && xp >= 0, "every line drawn");
    assert.ok(cost < divider && cargo < divider, "vanilla's lines come before the divider");
    assert.ok(divider < workers && divider < xp, "ours come after it");
  });

  it("draws no divider when nothing of ours applies", () => {
    resetBindings();
    const card = cardOf(entry(1, { constructionCost: 100000, capacity: 200000, workers: null as never, upkeep: 500, lotWidth: 0, lotDepth: 0, serviceFacts: [] }));

    assert.doesNotMatch(card, /data-tier="extra"/);
  });
});

describe("resource upkeep on the card", () => {
  it("names the fuel right after Upkeep, in the game's tier", () => {
    resetBindings();
    const card = cardOf(entry(1, { upkeep: 5000, workers: 37, serviceFacts: [{ key: "upkeep:Coal", value: 4000 }] }));

    const upkeep = card.indexOf("Upkeep");
    const coal = card.indexOf("Coal");
    const divider = card.indexOf('data-tier="extra"');

    assert.ok(upkeep >= 0 && coal >= 0 && divider >= 0, "all three present");
    assert.ok(upkeep < coal && coal < divider, "Upkeep, then Coal, then the divider");
    assert.match(card.slice(coal, coal + 200), /4 t\/mo\./);
  });
});

describe("the line cap never cuts the game's own lines", () => {
  // TILE_TOOLTIP_MAX_LINES was applied to the whole card, and Upkeep and Lot
  // sit at the end of the list — so a school with eight of our figures lost
  // its Upkeep, a line vanilla's own tooltip shows. Vanilla's tier is drawn in
  // full; the cap applies to ours alone.
  it("keeps Upkeep when our tier is long", () => {
    resetBindings();
    const card = cardOf(entry(1, {
      constructionCost: 100000, capacity: 1000, upkeep: 12500, workers: 50, households: null as never,
      serviceRange: 3500, parkingSlots: 54, supportedUpgrades: ["A", "B", "C"],
      serviceFacts: [
        { key: "xpReward", value: 300 }, { key: "minCrew", value: 15 }, { key: "eveningShift", value: 12.5 },
        { key: "nightShift", value: 10 }, { key: "workConditions", value: 3 }, { key: "graduation", value: 1.1 },
        { key: "studentWellbeing", value: 5 }, { key: "studentHealth", value: 5 },
      ],
    }));

    const vanilla = card.slice(0, card.indexOf('data-tier="extra"'));
    assert.match(vanilla, /Upkeep/);
    assert.match(vanilla, /Capacity/);
    const extraLines = (card.slice(card.indexOf('data-tier="extra"')).match(/class="cardLine/g) || []).length;
    assert.ok(extraLines <= 10, `our tier is capped, got ${extraLines}`);
    assert.ok(extraLines >= 8, `our tier is not starved, got ${extraLines}`);
  });
});

describe("a card with nothing of vanilla's", () => {
  // A zone tile: vanilla's tooltip has no figure for it, so every line is
  // ours. Dimming the whole card and ruling off an empty block above it made
  // the zone cards read as an afterthought. When the game's tier is empty,
  // ours is the card: normal weight, no divider.
  it("draws our lines as the primary block and no divider", () => {
    resetBindings();
    const card = cardOf(entry(1, {
      constructionCost: null as never, upkeep: null as never, capacity: null as never, workers: 50,
      serviceFacts: [{ key: "zoneHouseholds", value: 12 }],
    }));

    assert.doesNotMatch(card, /data-tier="extra"/);
    assert.doesNotMatch(card, /cardDivider/);
    assert.match(card, /Workers/);
  });
});
