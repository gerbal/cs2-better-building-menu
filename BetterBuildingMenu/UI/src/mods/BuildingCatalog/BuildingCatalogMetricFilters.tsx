import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { Button } from "cs2/ui";
import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import {
  clearBuildingCatalogMetricRangesCommand,
  setBuildingCatalogMetricRangeCommand,
} from "domain/buildingCatalogContracts";
import {
  countActiveMetricRanges,
  metricRangesFromState,
  METRIC_RANGE_DEFINITIONS,
  didSwapMetricBounds,
  getInvalidMetricBounds,
  type MetricRangeId,
  type MetricRangeInput,
} from "domain/buildingCatalogRanges";
import {
  createMetricRangeDebouncer,
  type MetricRangeDebouncerScheduler,
} from "domain/metricRangeDebouncer";
import { LENS_DISCLOSURE_KEYS, getLensDisclosure, setLensDisclosure } from "domain/lensViewStore";
import { useLensView } from "mods/useLensView";
import { textInputValue } from "domain/textInput";
import styles from "./buildingCatalog.module.scss";

import type { BuildingLensMetricRangeState as BuildingCatalogMetricRangeState } from "domain/buildingLensFilterSummary";
import { BuildingCatalogMetricBounds$, BuildingCatalogMetricRanges$, send } from "mods/bindings";
import { GameTextInput, gameClasses } from "mods/gameModules";

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

const TextInputTheme = gameClasses("game-ui/editor/widgets/item/editor-item.module.scss");

const metricRangeScheduler: MetricRangeDebouncerScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

type MetricRangeDrafts = Record<MetricRangeId, MetricRangeInput>;

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
  const ranges = metricRangesFromState(state);
  const limits = metricRangesFromState(bounds);
  return METRIC_RANGE_DEFINITIONS.reduce((drafts, definition) => {
    const range = ranges[definition.id];
    const limit = limits[definition.id];
    // The bound stands in only where the player has chosen nothing, so a field
    // they HAVE set is never overwritten by a view change, and clearing reads
    // as "back to the full range" rather than "back to blank".
    drafts[definition.id] = {
      minText: formatBound(range.min ?? limit.min, definition.integer),
      maxText: formatBound(range.max ?? limit.max, definition.integer),
    };
    return drafts;
  }, {} as MetricRangeDrafts);
}

export const BuildingCatalogMetricFilters = () => {
  const { translate } = useLocalization();
  const state = useValue(BuildingCatalogMetricRanges$) ?? emptyMetricRangeState;
  // In the shared store, so this drawer outlives the remount and the metric
  // ranges the player set stay visible.
  const open = useLensView((view) => view.disclosures[LENS_DISCLOSURE_KEYS.metricRanges] ?? false);
  const setOpen = (next: boolean | ((current: boolean) => boolean)): void => {
    const current = getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges);
    setLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges, typeof next === "function" ? next(current) : next);
  };
  // The spread each metric has here. A field with no selection shows its bound,
  // so the control states the scale before asking anyone to narrow it.
  const bounds = useValue(BuildingCatalogMetricBounds$) ?? emptyMetricRangeState;
  // A stable key for the twelve numbers: the binding hands back a fresh object
  // on every emit, so depending on `bounds` itself re-seeds the drafts on
  // unrelated churn, including while the player is typing.
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
        send(setBuildingCatalogMetricRangeCommand(id, input.minText, input.maxText));
      }, metricRangeScheduler),
    [],
  );

  useEffect(() => () => metricRangeDebouncer.cancel(), [metricRangeDebouncer]);

  useEffect(() => {
    // Echo backend state into the drafts, but never over a field the player is
    // still typing into: this effect fires whenever ANY metric settles, and a
    // blanket rewrite would delete half-typed text elsewhere in the drawer.
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

  const ranges = useMemo(() => metricRangesFromState(state), [
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
    const nextText = textInputValue(value);
    const nextInput: MetricRangeInput = {
      ...drafts[id],
      [bound]: nextText,
    };
    setDrafts((current) => ({ ...current, [id]: nextInput }));
    metricRangeDebouncer.schedule(id, bound, nextInput);
  }

  function clear(): void {
    metricRangeDebouncer.cancel();
    // Back to the full range of what is in view, not back to blank: clearing a
    // filter should say what is there again.
    setDrafts(draftsFromState(emptyMetricRangeState, bounds));
    send(clearBuildingCatalogMetricRangesCommand());
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
                  <GameTextInput
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
                  <GameTextInput
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
