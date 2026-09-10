import type { MetricRangeId, MetricRangeInput } from "./buildingCatalogRanges";

export type MetricRangeBound = "minText" | "maxText";

export interface MetricRangeDebouncerScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface MetricRangeDebouncer {
  schedule(id: MetricRangeId, bound: MetricRangeBound, input: MetricRangeInput): void;
  cancel(): void;
  /**
   * True while an edit to this metric has been typed but not yet sent, so the
   * drawer's echo of backend state leaves a field the player is still typing
   * in alone.
   */
  isPending(id: MetricRangeId): boolean;
}

export const METRIC_RANGE_DEBOUNCE_MS = 250;

export function createMetricRangeDebouncer(
  trigger: (id: MetricRangeId, input: MetricRangeInput) => void,
  scheduler: MetricRangeDebouncerScheduler,
  delayMs = METRIC_RANGE_DEBOUNCE_MS,
): MetricRangeDebouncer {
  const timers = new Map<string, unknown>();

  return {
    schedule(id, bound, input) {
      const key = `${id}:${bound}`;
      if (timers.has(key)) {
        scheduler.clearTimeout(timers.get(key));
      }

      const handle = scheduler.setTimeout(() => {
        timers.delete(key);
        trigger(id, input);
      }, delayMs);
      timers.set(key, handle);
    },

    cancel() {
      for (const handle of timers.values()) {
        scheduler.clearTimeout(handle);
      }
      timers.clear();
    },

    isPending(id) {
      for (const key of timers.keys()) {
        if (key.startsWith(`${id}:`)) {
          return true;
        }
      }

      return false;
    },
  };
}
