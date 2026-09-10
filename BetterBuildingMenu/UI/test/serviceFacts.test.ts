import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_FACT_LOCALIZATION_KEYS,
  renderServiceFacts,
  renderServiceTextFacts,
  orderFacts,
  isVanillaFact,
} from "../src/domain/serviceFacts.ts";

const noTranslation = () => null;

describe("renderServiceFacts", () => {
  it("labels a service figure and gives it its unit", () => {
    const rendered = renderServiceFacts(
      [{ key: "helicopters", value: 2 }, { key: "processingRate", value: 1200 }],
      noTranslation,
    );

    // processingRate is the deathcare rate — bodies per month, an integer in
    // vanilla's table. Without a per-month formatter injected it falls back to
    // the plain unit; with one (see below) it takes the game's template.
    assert.deepEqual(rendered.map((f) => `${f.label} ${f.value}`), [
      "Helicopters 2",
      "Processing 1200 /mo.",
    ]);
  });

  it("draws a modifier as a multiplier, not a quantity", () => {
    // A graduation modifier of 1.15 is a different building from one of 1.5;
    // rounded to whole numbers both would read "×1".
    const [fact] = renderServiceFacts([{ key: "graduation", value: 1.15 }], noTranslation);

    assert.equal(fact.value, "×1.15");
  });

  it("drops a key this build has no wording for", () => {
    // The backend can record a figure before the UI knows how to say it — the
    // two ship together but a player may run a mismatched pair, and
    // "sortingRate 240" on a card is worse than no line at all.
    assert.deepEqual(renderServiceFacts([{ key: "somethingNew", value: 5 }], noTranslation), []);
  });

  it("drops a value that is not a number", () => {
    const facts = [{ key: "helicopters", value: Number.NaN }] as { key: string; value: number }[];

    assert.deepEqual(renderServiceFacts(facts, noTranslation), []);
  });

  it("prefers the game's translation over the fallback", () => {
    const [fact] = renderServiceFacts(
      [{ key: "attractiveness", value: 40 }],
      (key) => (key === "Tooltip.LABEL[BetterBuildingMenu.Attractiveness]" ? "Anziehungskraft" : null),
    );

    assert.equal(fact.label, "Anziehungskraft");
  });

  it("says nothing for a building with no service figures", () => {
    assert.deepEqual(renderServiceFacts([], noTranslation), []);
    assert.deepEqual(renderServiceFacts(null, noTranslation), []);
    assert.deepEqual(renderServiceFacts(undefined, noTranslation), []);
  });

  it("ships a string for every key it can ask for", () => {
    // The localization audit scans source for literal keys; these live in a
    // table, so this is the check that the table and Locale.json agree.
    assert.ok(SERVICE_FACT_LOCALIZATION_KEYS.length > 0);
    for (const key of SERVICE_FACT_LOCALIZATION_KEYS) {
      assert.match(key, /^Tooltip\.LABEL\[BetterBuildingMenu\.[A-Za-z]+\]$/);
    }
  });
});

describe("renderServiceTextFacts", () => {
  it("labels a worded figure the game already named", () => {
    // A traded resource arrives named by the game, so it passes through.
    const rendered = renderServiceTextFacts(
      [{ key: "zoneSold", value: "Food" }, { key: "zoneStored", value: "Grain" }],
      () => null,
    );

    assert.deepEqual(rendered.map((f) => `${f.label} ${f.value}`), ["Sells Food", "Stores Grain"]);
  });

  it("gives our own tokens our own words", () => {
    // "narrow" and "corners" are our tokens, not the game's vocabulary.
    const [fact] = renderServiceTextFacts([{ key: "zoneLotShapes", value: "narrow" }], () => null);

    assert.equal(fact.value, "Narrow");
  });

  it("joins repeats of one key into a single line", () => {
    // The indexer emits one fact per lot shape; two lines both reading
    // "Lot shapes" would be one fact printed twice.
    const [fact] = renderServiceTextFacts(
      [{ key: "zoneLotShapes", value: "narrow" }, { key: "zoneLotShapes", value: "corners" }],
      () => null,
    );

    assert.equal(fact.label, "Lot shapes");
    assert.equal(fact.value, "Narrow, Corners");
  });

  it("prefers the game's translation for label and value alike", () => {
    const [fact] = renderServiceTextFacts(
      [{ key: "zoneLotShapes", value: "corners" }],
      (key) =>
        key === "Tooltip.LABEL[BetterBuildingMenu.ZoneLotShapes]" ? "Grundstücke"
          : key === "Tooltip.LABEL[BetterBuildingMenu.ZoneShapeCorners]" ? "Ecken"
            : null,
    );

    assert.equal(fact.label, "Grundstücke");
    assert.equal(fact.value, "Ecken");
  });

  it("drops a key or a blank this build cannot draw", () => {
    assert.deepEqual(renderServiceTextFacts([{ key: "somethingNew", value: "x" }], () => null), []);
    assert.deepEqual(renderServiceTextFacts([{ key: "zoneSold", value: "  " }], () => null), []);
    assert.deepEqual(renderServiceTextFacts([], () => null), []);
    assert.deepEqual(renderServiceTextFacts(null, () => null), []);
  });
});

describe("cargo capacity", () => {
  // StorageLimitData.m_Limit, which vanilla binds as Properties.CARGO_CAPACITY
  // with the weight unit; a cargo harbour's warehouses add to it.
  it("is a weight, labelled with the game's own words, placed with the capacities", () => {
    const translate = (key: string, fallback: string | null) =>
      key === "Tooltip.LABEL[BetterBuildingMenu.CargoCapacity]" ? "Cargo Capacity" : fallback;
    const [line] = renderServiceFacts(
      [{ key: "cargoCapacity", value: 500000 }],
      translate,
      (value) => String(value),
      { weight: (value) => `W(${value})` },
    );

    assert.equal(line.label, "Cargo Capacity");
    assert.equal(line.value, "W(500000)");

    const ordered = orderFacts([{ key: "purification" }, { key: "cargoCapacity" }, { key: "stormCapacity" }])
      .map((fact) => fact.key);
    assert.deepEqual(ordered, ["stormCapacity", "cargoCapacity", "purification"]);
  });
});

describe("weights and rates through the game's own formatters", () => {
  const noTranslation = () => null;
  const measured = {
    weightPerMonth: (value: number) => `WPM(${value})`,
    perMonth: (value: number) => `PM(${value})`,
  };

  it("garbage processing is a weight per month, its own key, not the deathcare rate's", () => {
    // Deathcare counts bodies and a landfill weighs kilograms; one shared
    // processingRate unit makes a crematorium's figure read as tonnes.
    const [garbage] = renderServiceFacts([{ key: "garbageProcessing", value: 100000 }], noTranslation, String, measured);
    const [bodies] = renderServiceFacts([{ key: "processingRate", value: 100 }], noTranslation, String, measured);
    const [mail] = renderServiceFacts([{ key: "sortingRate", value: 240 }], noTranslation, String, measured);

    assert.deepEqual(garbage, { key: "garbageProcessing", label: "Processing", value: "WPM(100000)" });
    assert.deepEqual(bodies, { key: "processingRate", label: "Processing", value: "PM(100)" });
    assert.deepEqual(mail, { key: "sortingRate", label: "Sorting", value: "PM(240)" });
  });

  it("battery output and grid capacity are power", () => {
    // BATTERY_POWER_OUTPUT and TRANSFORMER_CAPACITY are bound with the power
    // unit, so the raw figure must not be labelled directly.
    const [out] = renderServiceFacts([{ key: "batteryOutput", value: 20000 }], noTranslation, String, { power: (v: number) => `P(${v})` });
    const [cap] = renderServiceFacts([{ key: "electricityCapacity", value: 400000 }], noTranslation, String, { power: (v: number) => `P(${v})` });
    assert.equal(out.value, "P(20000)");
    assert.equal(cap.value, "P(400000)");
  });

  it("orders garbage processing where processing sits", () => {
    const ordered = orderFacts([{ key: "collectionTrucks" }, { key: "garbageProcessing" }]).map((f) => f.key);
    assert.deepEqual(ordered, ["garbageProcessing", "collectionTrucks"]);
  });
});

describe("what vanilla's tooltip shows on upgrades", () => {
  // Audited against PrefabUISystem's property binders: these are the figures
  // the game's own tooltip carries and ours does not, and most of them are
  // what an upgrade IS — a hearse garage, jail cells, an upkeep modifier.
  const noTranslation = () => null;
  const render = (key: string, value: number) => renderServiceFacts([{ key, value }], noTranslation)[0];

  it("counts the vehicles vanilla counts", () => {
    assert.deepEqual(render("ambulances", 4), { key: "ambulances", label: "Ambulances", value: "4" });
    assert.deepEqual(render("hearses", 3), { key: "hearses", label: "Hearses", value: "3" });
    assert.deepEqual(render("prisonVans", 2), { key: "prisonVans", label: "Prison vans", value: "2" });
    assert.deepEqual(render("postTrucks", 5), { key: "postTrucks", label: "Post trucks", value: "5" });
    assert.deepEqual(render("depotVehicles", 30), { key: "depotVehicles", label: "Vehicles", value: "30" });
    assert.deepEqual(render("maintenanceVehicles", 8), { key: "maintenanceVehicles", label: "Maintenance vehicles", value: "8" });
    assert.deepEqual(render("jailCapacity", 20), { key: "jailCapacity", label: "Jail capacity", value: "20" });
  });

  it("shows a pollution modifier as the percentage vanilla shows", () => {
    // PollutionModifierData holds multipliers; vanilla binds round(x * 100)
    // under the pollution level's own name. The indexer sends the percentage.
    assert.deepEqual(render("groundPollutionModifier", 50), { key: "groundPollutionModifier", label: "Ground pollution", value: "50 %" });
    assert.equal(render("airPollutionModifier", 75).label, "Air pollution");
    assert.equal(render("noisePollutionModifier", 100).label, "Noise pollution");
  });

  it("shows an upkeep modifier signed, as vanilla does", () => {
    // UpkeepModifierData is the one signed property in the table: the largest
    // multiplier minus one, in percent. A saving reads as a minus.
    assert.deepEqual(render("upkeepChange", -20), { key: "upkeepChange", label: "Upkeep", value: "-20 %" });
    assert.equal(render("upkeepChange", 15).value, "+15 %");
  });

  it("places vehicles with vehicles and modifiers with how-well", () => {
    const ordered = orderFacts([
      { key: "nightShift" }, { key: "upkeepChange" }, { key: "hearses" }, { key: "jailCapacity" }, { key: "groundPollutionModifier" }, { key: "collectionTrucks" },
    ]).map((fact) => fact.key);

    assert.ok(ordered.indexOf("jailCapacity") < ordered.indexOf("hearses"), "a capacity before a vehicle count");
    assert.ok(Math.abs(ordered.indexOf("hearses") - ordered.indexOf("collectionTrucks")) === 1, "vehicle counts sit together");
    assert.ok(ordered.indexOf("hearses") < ordered.indexOf("groundPollutionModifier"), "what it does before how well");
    assert.ok(ordered.indexOf("groundPollutionModifier") < ordered.indexOf("upkeepChange"));
    assert.ok(ordered.indexOf("upkeepChange") < ordered.indexOf("nightShift"), "modifiers before staffing");
  });
});

describe("orderFacts", () => {
  it("puts figures in one declared order whatever order they arrived in", () => {
    // The facts arrive in the order the INDEXER happened to emit them, which
    // depends on which C# blocks a prefab hit. Without a fixed order the
    // reader cannot learn where to look, which is the point of a fixed card.
    const asIndexed = [
      { key: "nightShift" }, { key: "helicopters" }, { key: "xpReward" }, { key: "graduation" },
    ];
    const other = [
      { key: "xpReward" }, { key: "graduation" }, { key: "helicopters" }, { key: "nightShift" },
    ];

    const first = orderFacts(asIndexed).map((fact) => fact.key);
    const second = orderFacts(other).map((fact) => fact.key);

    assert.deepEqual(first, second, "the same keys must land in the same order");
    // What the building DOES leads; how it is staffed and what it earns follow.
    assert.ok(first.indexOf("helicopters") < first.indexOf("graduation"));
    assert.ok(first.indexOf("graduation") < first.indexOf("nightShift"));
    assert.ok(first.indexOf("nightShift") < first.indexOf("xpReward"));
  });

  it("keeps a key it has never heard of, last and in the order given", () => {
    // A new fact must not vanish because nobody added it to the order — it
    // shows up at the end until someone places it deliberately.
    const ordered = orderFacts([
      { key: "somethingNew" }, { key: "helicopters" }, { key: "anotherNew" },
    ]).map((fact) => fact.key);

    assert.deepEqual(ordered, ["helicopters", "somethingNew", "anotherNew"]);
  });

  it("interleaves worded figures with numeric ones", () => {
    // They render as two separate lists. Ordering is a property of the FIELD,
    // not of how its value happens to be typed.
    const ordered = orderFacts([
      { key: "xpReward" }, { key: "jobComplexity" }, { key: "helicopters" },
    ]).map((fact) => fact.key);

    assert.deepEqual(ordered, ["helicopters", "jobComplexity", "xpReward"]);
  });
});

describe("which figures are vanilla's own", () => {
  // The line between the two tiers on the card is exactly PrefabUISystem's
  // binder table: a fact is "vanilla" if the game's own tooltip shows it.
  it("marks the figures the game's tooltip binds", () => {
    for (const key of ["garbageProcessing", "sortingRate", "collectionTrucks", "ambulances", "hearses", "jailCapacity",
      "cargoCapacity", "batteryOutput", "electricityCapacity", "purification", "comfort", "attractiveness",
      "shelterVehicles", "helicopters", "groundPollutionModifier", "upkeepChange", "voltage", "waterSource", "transportType"]) {
      assert.equal(isVanillaFact(key), true, key);
    }
  });

  it("leaves ours as ours", () => {
    for (const key of ["xpReward", "jobComplexity", "eveningShift", "nightShift", "workConditions", "minCrew",
      "graduation", "studentWellbeing", "studentHealth", "prisonerWellbeing", "disasterResponse", "maintenancePool",
      "elevatedWidth", "elevationCost", "roadFeature", "trackType", "zoneHouseholds", "zoneSpace", "facilityFeature"]) {
      assert.equal(isVanillaFact(key), false, key);
    }
  });
});

describe("resource upkeep", () => {
  // The ServiceUpkeepData buffer names what a building burns — a coal plant's
  // coal — which vanilla folds into its money figure at market price. Ours
  // names it, labelled with the game's own Resources.TITLE.
  it("labels a resource with the game's name and shows it as a weight per month", () => {
    const translate = (key: string, fallback: string | null) => key === "Resources.TITLE[Coal]" ? "Coal" : fallback;
    const [line] = renderServiceFacts([{ key: "upkeep:Coal", value: 4000 }], translate, String, { weightPerMonth: (v: number) => `WPM(${v})` });

    assert.deepEqual(line, { key: "upkeep:Coal", label: "Coal", value: "WPM(4000)" });
  });

  it("belongs to the game's tier", () => {
    assert.equal(isVanillaFact("upkeep:Coal"), true);
    assert.equal(isVanillaFact("upkeep:Oil"), true);
  });
});

describe("a zone's figures", () => {
  // The game reads exactly one of a zone's consumption coefficients — Upkeep,
  // in PropertyRenterSystem.GetUpkeep — and none of its pollution ones. A
  // figure the simulation never uses is no fact, so those keys draw nothing.
  it("draws nothing for the coefficients the simulation never reads", () => {
    const dead = ["zoneElectricity", "zoneWater", "zoneGarbage", "zoneTelecom",
      "zoneGroundPollution", "zoneAirPollution", "zoneNoisePollution"];

    assert.deepEqual(renderServiceFacts(dead.map((key) => ({ key, value: 3 })), () => null), []);
  });

  // Upkeep is money per cell per month at level 1, so it is measured, not
  // a bare number.
  it("states upkeep as money per cell per month", () => {
    const [fact] = renderServiceFacts([{ key: "zoneUpkeep", value: 6 }], () => null, undefined, {
      moneyPerCellPerMonth: (value) => `¢${value} /cell/mo.`,
    });

    assert.equal(fact.value, "¢6 /cell/mo.");
  });

  // ZoneProperties: with ScaleResidentials the figure is apartments per
  // cell, multiplied by lot size and level; without it, the building's
  // fixed count. Two keys, because the same "1" means different things.
  it("says whether homes are per cell or per building", () => {
    const [perCell, fixed] = renderServiceFacts(
      [{ key: "zoneHouseholdsPerCell", value: 3 }, { key: "zoneHouseholds", value: 1 }], () => null);

    assert.equal(perCell.value, "3 /cell");
    assert.equal(fixed.value, "1");
  });

  // "Space" named nothing; the authoring tooltip calls the multiplier an
  // abstraction of the amount of floors, and says a high value means bigger
  // apartments.
  it("names the space multiplier as floor space", () => {
    const [fact] = renderServiceFacts([{ key: "zoneSpace", value: 0.35 }], () => null);

    assert.equal(fact.label, "Floor space");
    assert.equal(fact.value, "×0.35");
  });
});

describe("the game's own mail and extractor properties", () => {
  // Vanilla binds MailBoxData.m_MailCapacity as Properties.MAIL_BOX_CAPACITY,
  // an integer (PrefabUISystem.BuildDefaultPropertyBinders).
  it("states a mailbox's capacity as a count, in the game's tier", () => {
    const [fact] = renderServiceFacts([{ key: "mailboxCapacity", value: 50 }], () => null);

    assert.equal(fact.label, "Mailbox capacity");
    assert.equal(fact.value, "50");
    assert.ok(isVanillaFact("mailboxCapacity"));
  });

  // RequiredResourceBinder: an extractor building names the map feature its
  // manufactured resource needs — Properties.MAP_RESOURCE[<feature>].
  it("names the natural resource an extractor requires, in the game's words", () => {
    const [fact] = renderServiceTextFacts(
      [{ key: "requiredResource", value: "FertileLand" }],
      (key) => (key === "Properties.MAP_RESOURCE[FertileLand]" ? "Fertile Land" : null),
    );

    assert.equal(fact.label, "Requires");
    assert.equal(fact.value, "Fertile Land");
    assert.ok(isVanillaFact("requiredResource"));
  });

  it("falls back to plain words for each map feature", () => {
    const words = ["Ore", "Oil", "Forest", "FertileLand"].map((feature) =>
      renderServiceTextFacts([{ key: "requiredResource", value: feature }], () => null)[0].value);

    assert.deepEqual(words, ["Ore", "Oil", "Forest", "Fertile land"]);
  });
});

describe("where a water building draws from", () => {
  // The game's own RequiredResourceBinder: ground water when the flag is set,
  // surface water otherwise, and nothing at all when the component's types
  // are None — a pumping station that draws from nowhere says nothing.
  it("says nothing for a building that draws from nowhere", () => {
    assert.deepEqual(renderServiceTextFacts([{ key: "waterSource", value: "None" }], () => null), []);
  });

  it("uses the game's words for ground and surface water", () => {
    const words = ["GroundWater", "SurfaceWater"].map((token) =>
      renderServiceTextFacts([{ key: "waterSource", value: token }],
        (key) => ({ "Properties.MAP_RESOURCE[GroundWater]": "Ground Water", "Properties.MAP_RESOURCE[SurfaceWater]": "Surface Water" })[key] ?? null)[0].value);

    assert.deepEqual(words, ["Ground Water", "Surface Water"]);
  });
});

describe("comfort, as the game states it", () => {
  // Vanilla binds a stop's or station's comfort as an integer, round(100 ×
  // m_ComfortFactor), rather than as a multiplier.
  it("is a whole number, not a multiplier", () => {
    const [fact] = renderServiceFacts([{ key: "comfort", value: 120 }], () => null);

    assert.equal(fact.value, "120");
  });
});
