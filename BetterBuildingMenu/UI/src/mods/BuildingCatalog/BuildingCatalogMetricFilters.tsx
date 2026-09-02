import { bindValue, trigger, useValue } from "cs2/api";
import { Theme } from "cs2/bindings";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { getModule } from "cs2/modding";
import { Button } from "cs2/ui";
import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import mod from "../../../mod.json";
import {
  clearBuildingCatalogMetricRangesCommand,
  setBuildingCatalogMetricRangeCommand,
} from "domain/buildingCatalogContracts";
import {
  countActiveMetricRanges,
  METRIC_RANGE_DEFINITIONS,
  didSwapMetricBounds,
  getInvalidMetricBounds,
  type MetricRangeId,
  type MetricRangeInput,
  type NormalizedMetricRange,
} from "domain/buildingCatalogRanges";
import {
  createMetricRangeDebouncer,
  type MetricRangeDebouncerScheduler,
} from "domain/metricRangeDebouncer";
import { LENS_DISCLOSURE_KEYS, getLensDisclosure, setLensDisclosure } from "domain/lensViewStore";
import { useLensView } from "mods/useLensView";
import styles from "./buildingCatalog.module.scss";

import type { BuildingLensMetricRangeState as BuildingCatalogMetricRangeState } from "domain/buildingLensFilterSummary";

const emptyMetricRangeState: BuildingCatalogMetricRangeState = {
  minCost: null,
  maxCost: null,
  minUpkeep: null,
  maxUpkeep: null,
  minWorkers: null,
  maxWorkers: null,
  minCapacity: null,
  maxCapacity: null,
  minLotWidth: null,
  maxLotWidth: null,
  minLotDepth: null,
  maxLotDepth: null,
  hasSelection: false,
};

const BuildingCatalogMetricRanges$ = bindValue<BuildingCatalogMetricRangeState>(
  mod.id,
  "BuildingCatalogMetricRanges",
  emptyMetricRangeState,
);

/**
 * The spread each metric has in the current view.
 *
 * Same shape as the selection above, and the pairing is the point: one says
 * what the player asked for, the other what there is to ask about. A field with
 * no selection shows its bound, so the control states the scale before it asks
 * you to narrow it — a Police menu runs 30,000 to 650,000 and nothing used to
 * say so, which made a bound typed outside the range look like a broken filter
 * rather than an empty result.
 */
const BuildingCatalogMetricBounds$ = bindValue<BuildingCatalogMetricRangeState>(
  mod.id,
  "BuildingCatalogMetricBounds",
  emptyMetricRangeState,
);

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");
const TextInputTheme: Theme | any = getModule("game-ui/editor/widgets/item/editor-item.module.scss", "classes");

const metricRangeScheduler: MetricRangeDebouncerScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

type MetricRangeDrafts = Record<MetricRangeId, MetricRangeInput>;

function rangeStateToRanges(state: BuildingCatalogMetricRangeState): Record<MetricRangeId, NormalizedMetricRange> {
  return {
    cost: { min: state.minCost, max: state.maxCost },
    upkeep: { min: state.minUpkeep, max: state.maxUpkeep },
    workers: { min: state.minWorkers, max: state.maxWorkers },
    capacity: { min: state.minCapacity, max: state.maxCapacity },
    lotWidth: { min: state.minLotWidth, max: state.maxLotWidth },
    lotDepth: { min: state.minLotDepth, max: state.maxLotDepth },
  };
}

function formatBound(value: number | null, integer: boolean): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (integer) {
    return String(Math.round(value));
  }

  return String(Number(value.toFixed(2)));
}

function draftsFromState(
  state: BuildingCatalogMetricRangeState,
  bounds: BuildingCatalogMetricRangeState = emptyMetricRangeState,
): MetricRangeDrafts {
  const ranges = rangeStateToRanges(state);
  const limits = rangeStateToRanges(bounds);
  return METRIC_RANGE_DEFINITIONS.reduce((drafts, definition) => {
    const range = ranges[definition.id];
    const limit = limits[definition.id];
    // The bound stands in only where the player has chosen nothing, so a field
    // they HAVE set is never quietly overwritten by a view change. Clearing a
    // filter therefore reads as "back to the full range" rather than "back to
    // blank", which is what was asked for.
    drafts[definition.id] = {
      minText: formatBound(range.min ?? limit.min, definition.integer),
      maxText: formatBound(range.max ?? limit.max, definition.integer),
    };
    return drafts;
  }, {} as MetricRangeDrafts);
}

function readInputValue(value: Event): string {
  const target = value?.target as HTMLInputElement | HTMLTextAreaElement | null;
  return target?.value ?? "";
}

export const BuildingCatalogMetricFilters = () => {
  const { translate } = useLocalization();
  const state = useValue(BuildingCatalogMetricRanges$) ?? emptyMetricRangeState;
  // See BuildingCatalogFacetPanel: drawer state outlives the remount so the
  // metric ranges the player set stay visible.
  const open = useLensView((view) => view.disclosures[LENS_DISCLOSURE_KEYS.metricRanges] ?? false);
  const setOpen = (next: boolean | ((current: boolean) => boolean)): void => {
    const current = getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges);
    setLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges, typeof next === "function" ? next(current) : next);
  };
  const bounds = useValue(BuildingCatalogMetricBounds$);
  // A stable key for the twelve numbers. The binding hands back a fresh object
  // on every emit, so depending on `bounds` itself would re-seed the drafts on
  // unrelated churn — including while the player is typing.
  const boundsKey = [
    bounds.minCost, bounds.maxCost,
    bounds.minUpkeep, bounds.maxUpkeep,
    bounds.minWorkers, bounds.maxWorkers,
    bounds.minCapacity, bounds.maxCapacity,
    bounds.minLotWidth, bounds.maxLotWidth,
    bounds.minLotDepth, bounds.maxLotDepth,
  ].join("|");
  const [drafts, setDrafts] = useState<MetricRangeDrafts>(() => draftsFromState(state, bounds));
  const metricRangeDebouncer = useMemo(
    () =>
      createMetricRangeDebouncer((id, input) => {
        const command = setBuildingCatalogMetricRangeCommand(id, input.minText, input.maxText);
        trigger(mod.id, command.method, ...command.args);
      }, metricRangeScheduler),
    [],
  );

  useEffect(() => () => metricRangeDebouncer.cancel(), [metricRangeDebouncer]);

  useEffect(() => {
    // Echo backend state into the drafts, but never over a field the player is
    // still typing into. This effect fires whenever any metric settles, and it
    // used to rewrite all six drafts — deleting half-typed text elsewhere in
    // the drawer.
    setDrafts((current) => {
      const next = draftsFromState(state, bounds);
      for (const definition of METRIC_RANGE_DEFINITIONS) {
        if (metricRangeDebouncer.isPending(definition.id)) {
          next[definition.id] = current[definition.id];
        }
      }

      return next;
    });
  }, [
    state.minCost,
    state.maxCost,
    state.minUpkeep,
    state.maxUpkeep,
    state.minWorkers,
    state.maxWorkers,
    state.minCapacity,
    state.maxCapacity,
    state.minLotWidth,
    state.maxLotWidth,
    state.minLotDepth,
    state.maxLotDepth,
    // Re-seed when the view changes: opening a different menu changes what
    // there is to ask about, so an empty field has to show the NEW range rather
    // than the last menu's.
    boundsKey,
  ]);

  const ranges = useMemo(() => rangeStateToRanges(state), [
    state.minCost,
    state.maxCost,
    state.minUpkeep,
    state.maxUpkeep,
    state.minWorkers,
    state.maxWorkers,
    state.minCapacity,
    state.maxCapacity,
    state.minLotWidth,
    state.maxLotWidth,
    state.minLotDepth,
    state.maxLotDepth,
  ]);
  const activeCount = countActiveMetricRanges(ranges);

  function updateBound(id: MetricRangeId, bound: "minText" | "maxText", value: Event): void {
    const nextText = readInputValue(value);
    const nextInput: MetricRangeInput = {
      ...drafts[id],
      [bound]: nextText,
    };
    setDrafts((current) => ({ ...current, [id]: nextInput }));
    metricRangeDebouncer.schedule(id, bound, nextInput);
  }

  function clear(): void {
    metricRangeDebouncer.cancel();
    // Back to the full range of what is in view, not back to blank. Clearing a
    // filter should say what is there again, which is the same thing the fields
    // showed before anything was typed.
    setDrafts(draftsFromState(emptyMetricRangeState, bounds));
    const command = clearBuildingCatalogMetricRangesCommand();
    trigger(mod.id, command.method, ...command.args);
  }

  return (
    <div className={styles.metricRangePanel} data-open={open}>
      <div className={styles.metricRangeToolbar}>
        <Button
          className={classNames(styles.metricRangeToggle, activeCount > 0 && styles.metricRangeToggleActive)}
          variant="icon"
          onSelect={() => setOpen((value) => !value)}
        >
          <span>
            {open
              ? translate("Tooltip.LABEL[BetterBuildingMenu.HideMetricFilters]", "Hide metric filters")
              : translate("Tooltip.LABEL[BetterBuildingMenu.MetricFilters]", "Metric filters")}
          </span>
          {activeCount > 0 && <span className={styles.metricRangeSelectionCount}>{activeCount}</span>}
        </Button>
        {activeCount > 0 && (
          <Button className={styles.metricRangeClear} variant="icon" onSelect={clear}>
            {translate("Tooltip.LABEL[BetterBuildingMenu.ClearLensMetricRanges]", "Clear metric ranges")}
          </Button>
        )}
      </div>

      {open && (
        <div className={styles.metricRangeGroups}>
          {METRIC_RANGE_DEFINITIONS.map((definition) => {
            const label = translate(definition.localizationKey, definition.label) ?? definition.label;
            const draft = drafts[definition.id];
            // Say what happened to the text instead of dropping it in silence.
            const invalid = getInvalidMetricBounds(definition.id, draft);
            const swapped = didSwapMetricBounds(definition.id, draft);
            const notice = invalid.min || invalid.max
              ? translate(
                  "Tooltip.LABEL[BetterBuildingMenu.MetricRangeInvalid]",
                  "Not a number — this bound is ignored",
                ) ?? "Not a number — this bound is ignored"
              : swapped
                ? translate(
                    "Tooltip.LABEL[BetterBuildingMenu.MetricRangeSwapped]",
                    "Bounds reversed — showing lowest to highest",
                  ) ?? "Bounds reversed — showing lowest to highest"
                : "";
            return (
              <div className={styles.metricRangeGroup} key={definition.id}>
                <span className={styles.metricRangeLabel}>{label}</span>
                <div className={styles.metricRangeInputs}>
                  <TextInput
                    multiline={1}
                    value={draft.minText}
                    disabled={false}
                    type="text"
                    className={classNames(TextInputTheme.input, styles.metricRangeInput)}
                    focusKey={FOCUS_DISABLED}
                    placeholder="min"
                    aria-label={`${label} minimum`}
                    data-invalid={invalid.min ? "true" : undefined}
                    onChange={(value: Event) => updateBound(definition.id, "minText", value)}
                  />
                  <span className={styles.metricRangeSeparator}>–</span>
                  <TextInput
                    multiline={1}
                    value={draft.maxText}
                    disabled={false}
                    type="text"
                    className={classNames(TextInputTheme.input, styles.metricRangeInput)}
                    focusKey={FOCUS_DISABLED}
                    placeholder="max"
                    aria-label={`${label} maximum`}
                    data-invalid={invalid.max ? "true" : undefined}
                    onChange={(value: Event) => updateBound(definition.id, "maxText", value)}
                  />
                </div>
                {notice !== "" && <span className={styles.metricRangeNotice}>{notice}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
