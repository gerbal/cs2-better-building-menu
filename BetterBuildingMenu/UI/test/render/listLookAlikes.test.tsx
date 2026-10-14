import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { linesOf, plannedNames } from "../harness/huggingNames";
import { entry } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import type { KeyKind } from "../../src/domain/rowNumbers";
import { ASSET_MENU_DEFAULT_HEIGHT } from "../../src/domain/sharedContracts.generated";
import { ListBody } from "../../src/mods/Bodies/ListBody";

/** A row: the base game's name, its cost (a network's per cell), and the word C# tells it apart by in the page, "" for none. */
type Row = readonly [name: string, cost: number, distinct: string];

/** A network's cost per cell from its cost per unit of length, as the game's rows say it. */
const CELL = 125;

/** Roads › Medium, as the menu orders it: its look-alikes "…Asymmetric Road" twice at 150%. */
const MEDIUM_ROADS: readonly Row[] = [
  ["Four-Lane Road 1", 44, "Road"], ["Four-Lane Divided Road", 44, "Road"], ["Four-Lane Asymmetric Road", 44, "Asymmetric"],
  ["Five-Lane Asymmetric Road", 50, "Asymmetric"], ["Four-Lane One-Way Road", 44, "One-Way"], ["Five-Lane One-Way Road", 50, "One-Way"],
  ["Four-Lane Perpendicular Parking Road", 44, "Perpendicular"], ["Four-Lane Angled Parking Road", 44, "Angled"],
  ["Wide Quay With Four-Lane Road", 44, ""], ["Four-Lane Truss Arch Bridge", 132, "Truss"], ["Four-Lane Tied Arch Bridge", 132, "Tied"],
  ["Four-Lane Divided Extradosed Bridge", 140, "Extradosed"], ["Four-Lane W/ Bike Road", 52, "W/"], ["Grand Bridge", 112, ""],
  ["Grand Bridge with Dedicated Tram Lanes", 112, "with"], ["Grand Bridge Viaduct", 140, "Viaduct"],
];

/** Roads › Small: "…Perpendicular…" three times at 150%. */
const SMALL_ROADS: readonly Row[] = [
  ["Two-Lane Half Road", 28, "Half"], ["Two-Lane Road 1", 32, "1"], ["Two-Lane Road 2", 32, "2"], ["Three-Lane Asymmetric Road", 38, "Asymmetric"],
  ["Four-Lane Road 2", 44, ""], ["One-Lane One-Way Road 1", 26, "1"], ["One-Lane One-Way Road 2", 26, "2"],
  ["Two-Lane One-Way Half Road Left", 28, "Left"], ["Two-Lane One-Way Half Road Right", 28, "Right"], ["Two-Lane One-Way Road 1", 32, "1"],
  ["Two-Lane One-Way Road 2", 32, "2"], ["Three-Lane One-Way Road", 38, "One-Way"], ["Gravel Road", 20, "Road"], ["Gravel One-Way Road", 16, "One-Way"],
  ["Alley", 24, ""], ["One-Way Alley", 18, ""], ["Two-Lane Perpendicular Parking Road", 32, "Perpendicular"],
  ["Two-Lane Angled Parking Road", 32, "Angled"], ["Two-Lane Divided Perpendicular Parking Road", 32, "Perpendicular"],
  ["Two-Lane Divided Angled Parking Road", 32, "Angled"], ["One-Lane One-Way Perpendicular Parking Road", 26, "Perpendicular"],
  ["One-Lane One-Way Angled Parking Road", 26, "Angled"],
];

/** Roads › Parking Spaces, the base game's: "…Single-Row…" twice at 150%. */
const PARKING: readonly Row[] = [
  ["Motorcycle Parking Lot", 3700, ""], ["Tiny Parking Lot", 3700, ""], ["Small Single-Row Parking Lot", 4000, "Single-Row"],
  ["Modest Parking Lot", 9000, ""], ["Canopy-Covered Parking Lot", 9000, ""], ["Small Solar Panel-Covered Parking Lot", 14000, "Solar"],
  ["Small Parking Lot", 11000, "Lot"], ["Long Parking Lot", 11000, ""], ["Medium Single-Row Parking Lot", 8000, "Single-Row"],
  ["Medium Parking Lot", 15000, "Parking"], ["Medium Solar Panel-Covered Parking Lot", 22000, "Solar"], ["Moderate Parking Lot", 20000, ""],
  ["Wide Parking Lot", 17000, ""], ["Large Parking Lot", 35000, "Parking"], ["Very Large Parking Lot", 80000, ""],
  ["Small Gravel Parking Lot", 3000, "Gravel"], ["Medium Gravel Parking Lot", 7000, "Gravel"], ["Small Parking Building", 40000, "Building"],
  ["Multi-Level Parking Building", 200000, ""], ["Overground Parking Building", 150000, ""], ["Bicycle Stand", 50, "Stand"],
  ["Bicycle Stands", 250, "Stands"], ["Bicycle Shelter", 500, "Shelter"], ["Bicycle Parking Area", 900, "Area"],
  ["Small Bicycle Shelter", 1000, "Shelter"], ["Large Bicycle Shelter", 3000, "Shelter"], ["Small Bicycle Storage", 1500, "Storage"],
  ["Medium Bicycle Storage", 2600, "Bicycle"], ["Large Bicycle Storage", 3500, "Storage"], ["Bicycle Parking Hall", 7200, "Hall"],
  ["Large Bicycle Parking Hall", 39000, "Parking"], ["Underground Bicycle Parking Hall", 54240, "Bicycle"],
  ["Underground Parking Building", 200000, "Parking"], ["Automated Parking Building", 630000, ""],
];

/** Landscaping › Pathways: "…Curvable & Il…ed" twice at 150%. */
const PATHWAYS: readonly Row[] = [
  ["Large Pedestrian Overpass", 30000, ""], ["Extra Large Pedestrian Overpass", 35000, ""], ["Pavement Path", 500, ""],
  ["Wide Pavement Path", 750, ""], ["Small Pedestrian Overpass", 20000, ""], ["Cable-stayed Pedestrian Bridge", 4500, "Bridge"],
  ["Covered Pedestrian Bridge", 4500, ""], ["Covered Pedestrian Bridge — Curvable & Illuminated", 4500, "Curvable"],
  ["Pedestrian Arch Bridge", 4500, ""], ["Pedestrian Arch Bridge — Curvable & Illuminated", 4500, "Curvable"],
  ["Wooden Covered Pedestrian Bridge", 4750, ""], ["Cable-Stayed Pedestrian Drawbridge", 4750, "Drawbridge"],
  ["Pedestrian Bascule Bridge", 4750, "Bascule"], ["Medium Pedestrian Overpass", 25000, ""],
];

/** Landscaping's search "garden bed" in its order, each free: "Garden Bed 01… Low" and "Garden Bed 03… Low" twice each at 130%. */
const GARDEN_BEDS: readonly Row[] = [
  "01 Wide Low", "02 Wide Low", "03 Wide Low", "01 Wide High", "02 Wide High", "03 Wide High", "01 Corner Low", "01 Narrow Low",
  "02 Corner Low", "02 Narrow Low", "03 Corner Low", "03 Narrow Low", "01 Corner High", "01 Narrow High", "02 Corner High",
  "02 Narrow High", "03 Corner High", "03 Narrow High", "01 Quadrant Low", "02 Quadrant Low", "03 Quadrant Low",
  "01 Quadrant High", "02 Quadrant High", "03 Quadrant High",
].map((shape) => [`Garden Bed ${shape}`, 0, shape.split(" ")[2]] as const);

interface Page {
  label: string;
  rows: readonly Row[];
  textScale: number;
  /** Whether a row's cost is per cell, a network's. */
  network: boolean;
  keyKind: KeyKind;
  typed: string;
}

const PAGES: readonly Page[] = [
  { label: "Roads › Medium at 150%", rows: MEDIUM_ROADS, textScale: 1.5, network: true, keyKind: "speed", typed: "" },
  { label: "Roads › Small at 150%", rows: SMALL_ROADS, textScale: 1.5, network: true, keyKind: "speed", typed: "" },
  { label: "Roads › Parking Spaces at 150%", rows: PARKING, textScale: 1.5, network: false, keyKind: "capacity", typed: "" },
  { label: "Landscaping › Pathways at 150%", rows: PATHWAYS, textScale: 1.5, network: false, keyKind: "capacity", typed: "" },
  { label: "Landscaping, \"garden bed\", at 130%", rows: GARDEN_BEDS, textScale: 1.3, network: false, keyKind: "capacity", typed: "garden bed" },
];

const entries = (page: Page): BuildingCatalogEntry[] => page.rows.map(([name, cost, distinct], at) => entry(at + 1, {
  name,
  distinctWord: distinct,
  constructionCost: page.network ? cost * CELL : cost,
  costIsPerDistance: page.network,
  capacity: null,
  ...(page.network ? { speedLimit: 80 } : {}),
} as Partial<BuildingCatalogEntry>));

describe("the list's look-alikes on one screen at large text, under More buildings", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: Record<string, unknown>;
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    saved = { requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    // No frame runs: each name keeps the body's estimate of its room, as a page's first draws do.
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  for (const look of ["standard", "plates"]) {
    for (const page of PAGES) {
      it(`draws no two buildings alike in ${page.label}, in ${look === "standard" ? "Standard" : "Plates"}`, () => {
        setBinding("options", "textScale", page.textScale);
        setBinding("BetterBuildingMenu", "AssetMenuLook", look);
        const grid = bodyGrid({ body: "list", boxWidth: 706, bodyHeight: ASSET_MENU_DEFAULT_HEIGHT, textScale: page.textScale, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0 });
        const rows = entries(page);
        // A search's first result is Enter's target, whose mark narrows its room.
        const enterId = page.typed === "" ? null : rows[0].id;
        act(() => {
          root = create(<ListBody entries={rows} grid={grid} keyKind={page.keyKind} typed={page.typed} enterId={enterId} onPlace={() => undefined} />);
        });

        // Every plate on or near the screen: the whole page, which the screen and the lines either side of it hold.
        const names = plannedNames(root!);
        assert.equal(names.length, rows.length);
        assert.ok(names.every((name) => name.props.near === true), page.label);
        const drawers = new Map<string, string[]>();
        for (const name of names) {
          const text = linesOf(name).join("\n");
          drawers.set(text, [...(drawers.get(text) ?? []), name.props.name as string]);
        }
        const alike = [...drawers].filter(([, drawn]) => drawn.length > 1).map(([text, drawn]) => `"${text}": ${drawn.join(" | ")}`);

        assert.deepEqual(alike, []);
      });
    }
  }
});
