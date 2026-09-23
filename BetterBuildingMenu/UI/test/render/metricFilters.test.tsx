import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { getModule } from "../harness/stubs/cs2-modding";
import { Button } from "../harness/stubs/cs2-ui";
import type { BuildingLensMetricRangeState } from "../../src/domain/buildingLensFilterSummary";
import { METRIC_RANGE_DEBOUNCE_MS } from "../../src/domain/metricRangeDebouncer";
import { LENS_DISCLOSURE_KEYS, resetLensView, setLensDisclosure } from "../../src/domain/lensViewStore";
import { BuildingCatalogMetricFilters } from "../../src/mods/BuildingCatalog/BuildingCatalogMetricFilters";

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput") as () => JSX.Element;

const none: BuildingLensMetricRangeState = {
  minCost: null, maxCost: null,
  minUpkeep: null, maxUpkeep: null,
  minWorkers: null, maxWorkers: null,
  minCapacity: null, maxCapacity: null,
  minLotWidth: null, maxLotWidth: null,
  minLotDepth: null, maxLotDepth: null,
  hasSelection: false,
};
// The spread of what is in view, which an empty field shows.
const bounds = { ...none, minCost: 500, maxCost: 90000, minUpkeep: 0, maxUpkeep: 1200, minLotWidth: 1.4, maxLotWidth: 6 };

const ranges = (over: Partial<BuildingLensMetricRangeState>) => setBinding("BetterBuildingMenu", "BuildingCatalogMetricRanges", { ...none, ...over });

describe("the metric-range drawer", () => {
  let root: ReactTestRenderer | undefined;

  const render = () => act(() => {
    root = create(<BuildingCatalogMetricFilters />);
  });
  const text = (node: ReactTestInstance): string =>
    node.children.map((child) => (typeof child === "string" ? child : text(child))).join("");
  const buttons = (): string[] => root!.root.findAllByType(Button).map(text);
  const field = (label: string): ReactTestInstance => root!.root.findAllByType(TextInput).find((node) => node.props["aria-label"] === label)!;
  const value = (label: string): string => field(label).props.value;
  const type = (label: string, typed: string) => act(() => field(label).props.onChange({ target: { value: typed } }));
  const notices = (): string[] => root!.root.findAll((node) => node.props.className === "metricRangeNotice").map(text);
  const sent = () => triggers.map((call) => [call.name, ...call.args]);
  const wait = (ms: number) => act(() => mock.timers.tick(ms));
  const open = () => setLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges, true);

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    resetBindings();
    resetLensView();
    setBinding("BetterBuildingMenu", "BuildingCatalogMetricBounds", bounds);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    mock.timers.reset();
  });

  it("is one closed toggle while nothing is set", () => {
    render();

    assert.deepEqual(buttons(), ["Metric filters"]);
    assert.equal(root!.root.findAllByType(TextInput).length, 0);
  });

  it("counts ranges, not bounds, and offers to clear them", () => {
    // A cost range has two bounds and is one filter; the rail's badge agrees.
    ranges({ minCost: 10, maxCost: 20, minWorkers: 5, hasSelection: true });
    render();

    const badge = root!.root.findAll((node) => node.props.className === "metricRangeSelectionCount").map(text);
    assert.deepEqual(badge, ["2"]);
    assert.deepEqual(buttons(), ["Metric filters2", "Clear metric ranges"], "the badge sits in the toggle");
  });

  it("opens on a press, and is still open after the drawer is drawn again", () => {
    render();
    act(() => root!.root.findAllByType(Button)[0].props.onSelect());
    assert.equal(root!.root.findAllByType(TextInput).length, 12, "a min and a max for each of six metrics");
    assert.deepEqual(buttons(), ["Hide metric filters"]);

    act(() => root!.unmount());
    render();
    assert.equal(root!.root.findAllByType(TextInput).length, 12);
  });

  it("shows the spread of what is in view where nothing is set, and the setting where something is", () => {
    ranges({ minCost: 1000, hasSelection: true });
    open();
    render();

    assert.deepEqual([value("Cost minimum"), value("Cost maximum")], ["1000", "90000"]);
    assert.deepEqual([value("Upkeep minimum"), value("Upkeep maximum")], ["0", "1200"]);
    assert.deepEqual([value("Workers minimum"), value("Workers maximum")], ["", ""], "no spread known");
    assert.equal(value("Lot Width minimum"), "1", "a lot is whole cells");
  });

  it("sends what was typed once the typing stops, and only the last of it", () => {
    open();
    render();

    type("Cost minimum", "1");
    type("Cost minimum", "12");
    assert.equal(value("Cost minimum"), "12");
    wait(METRIC_RANGE_DEBOUNCE_MS - 1);
    assert.deepEqual(sent(), []);

    wait(1);
    assert.deepEqual(sent(), [["SetBuildingCatalogMetricRange", "cost", "12", "90000"]]);
  });

  it("says when a bound is not a number, and when the two are the wrong way round", () => {
    open();
    render();

    type("Cost minimum", "lots");
    assert.deepEqual(notices(), ["Not a number — this bound is ignored"]);
    assert.equal(field("Cost minimum").props["data-invalid"], "true");

    type("Cost minimum", "95000");
    assert.deepEqual(notices(), ["Bounds reversed — showing lowest to highest"]);
  });

  it("leaves a field still being typed in alone when another metric's range comes back", () => {
    open();
    render();

    type("Cost minimum", "7");
    act(() => ranges({ minUpkeep: 40, hasSelection: true }));

    assert.equal(value("Cost minimum"), "7");
    assert.equal(value("Upkeep minimum"), "40");
  });

  it("fills empty fields with the new spread when the view changes", () => {
    open();
    render();

    act(() => setBinding("BetterBuildingMenu", "BuildingCatalogMetricBounds", { ...bounds, minCost: 2000, maxCost: 4000 }));

    assert.deepEqual([value("Cost minimum"), value("Cost maximum")], ["2000", "4000"]);
  });

  it("clears every range at once, drops what was still to be sent, and shows the spread again", () => {
    ranges({ minCost: 1000, hasSelection: true });
    open();
    render();

    type("Upkeep maximum", "30");
    act(() => root!.root.findAllByType(Button).find((node) => text(node) === "Clear metric ranges")!.props.onSelect());
    wait(METRIC_RANGE_DEBOUNCE_MS);

    assert.deepEqual(sent(), [["ClearBuildingCatalogMetricRanges"]]);
    assert.deepEqual([value("Cost minimum"), value("Upkeep maximum")], ["500", "1200"]);
  });
});
