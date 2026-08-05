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
import {
  LENS_DISCLOSURE_KEYS,
  getLensDisclosure,
  setLensDisclosure,
} from "domain/buildingLensViewState";
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

function draftsFromState(state: BuildingCatalogMetricRangeState): MetricRangeDrafts {
  const ranges = rangeStateToRanges(state);
  return METRIC_RANGE_DEFINITIONS.reduce((drafts, definition) => {
    const range = ranges[definition.id];
    drafts[definition.id] = {
      minText: formatBound(range.min, definition.integer),
      maxText: formatBound(range.max, definition.integer),
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
  const [open, setOpenState] = useState(() => getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges));
  const setOpen = (next: boolean | ((current: boolean) => boolean)): void => {
    setOpenState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      setLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges, value);
      return value;
    });
  };
  const [drafts, setDrafts] = useState<MetricRangeDrafts>(() => draftsFromState(state));
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
      const next = draftsFromState(state);
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
    setDrafts(draftsFromState(emptyMetricRangeState));
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
              ? translate("Tooltip.LABEL[FindItBuildingMenu.HideMetricFilters]", "Hide metric filters")
              : translate("Tooltip.LABEL[FindItBuildingMenu.MetricFilters]", "Metric filters")}
          </span>
          {activeCount > 0 && <span className={styles.metricRangeSelectionCount}>{activeCount}</span>}
        </Button>
        {activeCount > 0 && (
          <Button className={styles.metricRangeClear} variant="icon" onSelect={clear}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.ClearLensMetricRanges]", "Clear metric ranges")}
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
                  "Tooltip.LABEL[FindItBuildingMenu.MetricRangeInvalid]",
                  "Not a number — this bound is ignored",
                ) ?? "Not a number — this bound is ignored"
              : swapped
                ? translate(
                    "Tooltip.LABEL[FindItBuildingMenu.MetricRangeSwapped]",
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
