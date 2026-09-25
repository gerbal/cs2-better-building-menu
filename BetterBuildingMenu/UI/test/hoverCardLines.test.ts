import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog.ts";
import { getNumberSeparators } from "../src/domain/buildingLensMetricFormat.ts";
import { TILE_TOOLTIP_MAX_LINES } from "../src/domain/buildingTileTooltip.ts";
import { hoverCardLabels, hoverCardTiers, type HoverCardLineContext } from "../src/domain/hoverCardLines.ts";

// Every key falls back to its English wording, as with no locale loaded.
const english = (_key: string, fallback: string | null) => fallback;

const context: HoverCardLineContext = {
  milestoneNames: ["", "Tiny Village", "Small Village"],
  separators: getNumberSeparators(),
  leisureName: (type) => (type ? `${type} recreation` : ""),
  translateFact: english,
  labels: hoverCardLabels(english),
};

const building = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1,
  name: "Hospital",
  prefabName: "Hospital01",
  category: "ServiceBuildings",
  subCategory: "ServiceBuildings_Health",
  lotWidth: 8,
  lotDepth: 6,
  constructionCost: 120000,
  upkeep: 4000,
  capacity: null,
  workers: null,
  parkingSlots: 0,
  bonuses: [],
  unlockMilestone: 0,
  unlockRequirements: [],
  ...over,
} as BuildingCatalogEntry);

const keys = (lines: { key: string }[]): string[] => lines.map((line) => line.key);
const line = (entry: BuildingCatalogEntry, key: string) => {
  const { vanilla, extra } = hoverCardTiers(entry, context);
  return [...vanilla, ...extra].find((candidate) => candidate.key === key);
};

describe("the hover card's lines", () => {
  it("keep one order whatever the building carries, the game's before ours", () => {
    const { vanilla, extra } = hoverCardTiers(building({
      isLocked: true,
      capacity: 200,
      leisureType: "Park",
      leisureEfficiency: 30,
      serviceRange: 1500,
      parkingSlots: 20,
      households: 4,
      workers: 60,
      supportedUpgrades: ["Hospital01 Wing"],
      bonuses: ["+10 Health"],
      serviceFacts: [{ key: "upkeep:Coal", value: 500 }, { key: "ambulances", value: 10 }, { key: "xpReward", value: 300 }],
    }), context);

    assert.deepEqual(keys(vanilla), ["locked", "cost", "upkeep", "upkeep:Coal", "capacity", "leisure", "ambulances", "bonuses"]);
    assert.deepEqual(keys(extra), ["range", "parking", "households", "workers", "xpReward", "upgrades", "lot"]);
  });

  it("list every unlock condition once, the milestone first", () => {
    const locked = line(building({ isLocked: true, unlockMilestone: 2, unlockRequirements: ["Hospital node", "Hospital node", "50 citizens"] }), "locked");

    assert.equal(locked?.label, "Requires");
    assert.deepEqual(locked?.values, ["Small Village", "Hospital node", "50 citizens"]);
    assert.equal(locked?.tone, "warn");
  });

  it("say Locked when the building is locked for no reason it names", () => {
    assert.deepEqual(line(building({ isLocked: true }), "locked")?.values, ["Locked"]);
  });

  it("say Already built as a line of its own, with no figure", () => {
    const built = line(building({ isAlreadyBuilt: true }), "alreadyBuilt");

    assert.deepEqual([built?.label, built?.value, built?.tone], ["Already built", "", "warn"]);
  });

  it("leave out a capacity or a workforce of zero, which is the absence of one", () => {
    const entry = building({ capacity: 0, workers: 0 });

    assert.equal(line(entry, "capacity"), undefined);
    assert.equal(line(entry, "workers"), undefined);
  });

  it("count parking in bays, and only where there are some", () => {
    assert.equal(line(building({ parkingSlots: 1200 }), "parking")?.value, `1${context.separators.group}200 bays`);
    assert.equal(line(building({ parkingSlots: 0 }), "parking"), undefined);
  });

  it("name the kind of recreation even without an amount", () => {
    const kindOnly = line(building({ leisureType: "Park", leisureEfficiency: null }), "leisure");

    assert.deepEqual([kindOnly?.label, kindOnly?.value], ["Park recreation", ""]);
    assert.equal(line(building({ leisureType: "" }), "leisure"), undefined);
  });

  it("list upgrades and effects one per line, effects in the good tone", () => {
    const entry = building({ supportedUpgrades: ["Hospital01 Wing", "Hospital01 Helipad"], bonuses: ["+10 Health", "+5 Wellbeing"] });

    assert.equal(line(entry, "upgrades")?.values?.length, 2);
    assert.deepEqual(line(entry, "bonuses")?.values, ["+10 Health", "+5 Wellbeing"]);
    assert.equal(line(entry, "bonuses")?.tone, "good");
  });

  it("move a road's speed and width, and a zone's make-up, into the game's tier", () => {
    const road = hoverCardTiers(building({ category: "Networks", speedLimit: 80, networkWidth: 16, lotWidth: 0, lotDepth: 0 }), context);
    assert.deepEqual(keys(road.vanilla), ["cost", "upkeep", "speedLimit", "networkWidth"]);

    const zone = hoverCardTiers(building({ category: "Zones", serviceFacts: [{ key: "zoneMaxHeight", value: 20 }, { key: "zoneUpkeep", value: 6 }] }), context);
    assert.ok(keys(zone.vanilla).includes("zoneMaxHeight"));
    assert.ok(keys(zone.extra).includes("zoneUpkeep"));

    // The same figures on a building stay ours.
    assert.ok(keys(hoverCardTiers(building({ speedLimit: 80 }), context).extra).includes("speedLimit"));
  });

  it("cap our tier and never the game's", () => {
    const ours = ["xpReward", "minCrew", "eveningShift", "nightShift", "workConditions", "graduation", "studentWellbeing", "studentHealth"]
      .map((key) => ({ key, value: 3 }));
    const { vanilla, extra } = hoverCardTiers(building({
      isLocked: true,
      bonuses: ["+1"],
      serviceRange: 1500,
      parkingSlots: 20,
      households: 4,
      workers: 60,
      serviceFacts: ours,
    }), context);

    assert.ok(ours.length + 5 > TILE_TOOLTIP_MAX_LINES, "more of ours than the cap");
    assert.equal(extra.length, TILE_TOOLTIP_MAX_LINES);
    assert.deepEqual(keys(vanilla), ["locked", "cost", "upkeep", "bonuses"]);
  });
});

describe("the hover card's labels", () => {
  it("fall back to English where the locale has no word", () => {
    const labels = hoverCardLabels(() => null);

    assert.equal(labels.locked, "Requires");
    assert.equal(labels.parkingBays, "bays");
    assert.equal(labels.alreadyBuilt, "Already built");
  });

  it("take the game's own already-built wording first, and ours when the game's is empty", () => {
    const withGame = hoverCardLabels((key, fallback) => (key === "Toolbar.ASSET_ALREADY_BUILT" ? "Déjà construit" : fallback));
    assert.equal(withGame.alreadyBuilt, "Déjà construit");

    const withoutGame = hoverCardLabels((key, fallback) => (key === "Toolbar.ASSET_ALREADY_BUILT" ? "" : fallback === "Already built" ? "Bereits gebaut" : fallback));
    assert.equal(withoutGame.alreadyBuilt, "Bereits gebaut");
  });

  it("name cost and upkeep as vanilla's tooltip does, by its own keys", () => {
    const german: Record<string, string> = { "Properties.CONSTRUCTION_COST": "Baukosten", "Properties.UPKEEP": "Unterhalt" };
    const labels = hoverCardLabels((key, fallback) => german[key] ?? fallback);

    assert.equal(labels.cost, "Baukosten");
    assert.equal(labels.upkeep, "Unterhalt");
    assert.equal(hoverCardLabels(() => null).cost, "Cost");
  });
});
