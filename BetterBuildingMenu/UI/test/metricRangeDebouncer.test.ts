import assert from "node:assert/strict";
import { describe, it } from "node:test";

type MetricRangeId = "cost" | "upkeep" | "workers" | "capacity" | "lotWidth" | "lotDepth";
type MetricRangeBound = "minText" | "maxText";

interface MetricRangeInput {
  minText: string;
  maxText: string;
}

interface MetricRangeScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface MetricRangeDebouncer {
  schedule(id: MetricRangeId, bound: MetricRangeBound, input: MetricRangeInput): void;
  cancel(): void;
  isPending(id: MetricRangeId): boolean;
}

interface MetricRangeDebouncerModule {
  createMetricRangeDebouncer(
    trigger: (id: MetricRangeId, input: MetricRangeInput) => void,
    scheduler: MetricRangeScheduler,
    delayMs?: number,
  ): MetricRangeDebouncer;
}

async function loadDebouncerModule(): Promise<{ module: MetricRangeDebouncerModule } | { error: unknown }> {
  try {
    return {
      module: (await import("../src/domain/metricRangeDebouncer.ts")) as MetricRangeDebouncerModule,
    };
  } catch (error) {
    return { error };
  }
}

interface ScheduledTimer {
  callback: () => void;
  delayMs: number;
}

function createSchedulerHarness(): {
  scheduler: MetricRangeScheduler;
  pendingCount: () => number;
  delays: () => number[];
  runAll(): void;
} {
  let nextHandle = 0;
  const timers = new Map<number, ScheduledTimer>();
  const scheduledDelays: number[] = [];

  return {
    scheduler: {
      setTimeout(callback, delayMs) {
        const handle = nextHandle++;
        timers.set(handle, { callback, delayMs });
        scheduledDelays.push(delayMs);
        return handle;
      },
      clearTimeout(handle) {
        if (typeof handle === "number") {
          timers.delete(handle);
        }
      },
    },
    pendingCount: () => timers.size,
    delays: () => [...scheduledDelays],
    runAll() {
      const pending = [...timers.values()];
      timers.clear();
      for (const timer of pending) {
        timer.callback();
      }
    },
  };
}

describe("metric range debouncer", () => {
  it("coalesces repeated edits to the same metric bound and uses the 250ms default", async () => {
    const loaded = await loadDebouncerModule();
    if (!("module" in loaded)) {
      assert.fail(`metric range debouncer helper is unavailable: ${String(loaded.error)}`);
    }

    const harness = createSchedulerHarness();
    const calls: Array<{ id: MetricRangeId; input: MetricRangeInput }> = [];
    const debouncer = loaded.module.createMetricRangeDebouncer(
      (id, input) => calls.push({ id, input }),
      harness.scheduler,
    );

    debouncer.schedule("capacity", "minText", { minText: "5", maxText: "" });
    debouncer.schedule("capacity", "minText", { minText: "50", maxText: "" });

    assert.equal(harness.pendingCount(), 1);
    assert.deepEqual(harness.delays(), [250, 250]);

    harness.runAll();

    assert.deepEqual(calls, [{ id: "capacity", input: { minText: "50", maxText: "" } }]);
  });

  it("keeps independent metric and bound fields on separate timers", async () => {
    const loaded = await loadDebouncerModule();
    if (!("module" in loaded)) {
      assert.fail(`metric range debouncer helper is unavailable: ${String(loaded.error)}`);
    }

    const harness = createSchedulerHarness();
    const calls: Array<{ id: MetricRangeId; input: MetricRangeInput }> = [];
    const debouncer = loaded.module.createMetricRangeDebouncer(
      (id, input) => calls.push({ id, input }),
      harness.scheduler,
    );

    debouncer.schedule("cost", "minText", { minText: "100", maxText: "" });
    debouncer.schedule("capacity", "minText", { minText: "500", maxText: "" });
    debouncer.schedule("cost", "maxText", { minText: "100", maxText: "1000" });

    assert.equal(harness.pendingCount(), 3);

    harness.runAll();

    assert.deepEqual(calls, [
      { id: "cost", input: { minText: "100", maxText: "" } },
      { id: "capacity", input: { minText: "500", maxText: "" } },
      { id: "cost", input: { minText: "100", maxText: "1000" } },
    ]);
  });

  it("cancels every pending metric timer", async () => {
    const loaded = await loadDebouncerModule();
    if (!("module" in loaded)) {
      assert.fail(`metric range debouncer helper is unavailable: ${String(loaded.error)}`);
    }

    const harness = createSchedulerHarness();
    const calls: Array<{ id: MetricRangeId; input: MetricRangeInput }> = [];
    const debouncer = loaded.module.createMetricRangeDebouncer(
      (id, input) => calls.push({ id, input }),
      harness.scheduler,
    );

    debouncer.schedule("workers", "minText", { minText: "10", maxText: "" });
    debouncer.schedule("lotDepth", "maxText", { minText: "", maxText: "20" });
    debouncer.cancel();

    assert.equal(harness.pendingCount(), 0);
    harness.runAll();
    assert.deepEqual(calls, []);
  });
  it("reports which metrics have an edit in flight so drafts are not clobbered", async () => {
    const loaded = await loadDebouncerModule();
    if (!("module" in loaded)) {
      assert.fail(`metric range debouncer helper is unavailable: ${String(loaded.error)}`);
    }

    const harness = createSchedulerHarness();
    const debouncer = loaded.module.createMetricRangeDebouncer(() => {}, harness.scheduler);

    debouncer.schedule("cost", "minText", { minText: "10", maxText: "" });

    // The drawer echoes backend state into every draft; without this the
    // half-typed "10" would be wiped when an unrelated metric settled.
    assert.equal(debouncer.isPending("cost"), true);
    assert.equal(debouncer.isPending("upkeep"), false);

    harness.runAll();
    assert.equal(debouncer.isPending("cost"), false);
  });

  it("clears pending state for every metric on cancel", async () => {
    const loaded = await loadDebouncerModule();
    if (!("module" in loaded)) {
      assert.fail(`metric range debouncer helper is unavailable: ${String(loaded.error)}`);
    }

    const harness = createSchedulerHarness();
    const debouncer = loaded.module.createMetricRangeDebouncer(() => {}, harness.scheduler);

    debouncer.schedule("workers", "minText", { minText: "5", maxText: "" });
    debouncer.cancel();

    assert.equal(debouncer.isPending("workers"), false);
  });
});
