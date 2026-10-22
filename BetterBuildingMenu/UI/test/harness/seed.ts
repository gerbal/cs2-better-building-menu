import type { ValueBinding } from "cs2/api";
import { setBinding } from "./stubs/cs2-api";

/** Sets what a binding reads, typed by the binding; under the harness a binding carries its group.name key. */
export function seed<T>(binding: ValueBinding<T>, value: T): void {
  const { key } = binding as unknown as { key: string };
  const dot = key.indexOf(".");
  setBinding(key.slice(0, dot), key.slice(dot + 1), value);
}
