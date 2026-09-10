import { useState } from "react";
// cs2/api under the harness: bindings are a registry the test writes to.
const values = new Map<string, unknown>();
export const triggers: Array<{ group: string; name: string; args: unknown[] }> = [];

export interface StubBinding<T> { key: string; fallback: T | undefined; readonly value: T }

const read = <T,>(binding: { key: string; fallback: T | undefined }): T =>
  (values.has(binding.key) ? values.get(binding.key) : binding.fallback) as T;

export function bindValue<T>(group: string, name: string, fallback?: T): StubBinding<T> {
  const binding = { key: `${group}.${name}`, fallback } as StubBinding<T>;
  Object.defineProperty(binding, "value", { get: () => read(binding) });
  return binding;
}
// A real hook, like the game's useValue, so a wrapper that calls it changes a
// component's hook sequence in tests exactly as it would in the game.
export function useValue<T>(binding: StubBinding<T>): T {
  useState(0);
  return read(binding);
}
export function trigger(group: string, name: string, ...args: unknown[]): void {
  triggers.push({ group, name, args });
}
export function call(): Promise<unknown> { return Promise.resolve(undefined); }

// Map bindings: keyed by the entity's index:version, the way the game's own
// entityKey does it. The test seeds one key at a time with setMapBinding.
export interface StubMapBinding<K, V> { key: string; _k?: K; _v?: V }
export function bindMap<K, V>(group: string, name: string): StubMapBinding<K, V> {
  return { key: `${group}.${name}` };
}
const entityKey = (key: unknown): string =>
  key && typeof key === "object" && "index" in (key as object)
    ? `${(key as { index: number }).index}:${(key as { version: number }).version}`
    : String(key);
export function useMapValue<K, V>(binding: StubMapBinding<K, V>, key: K | undefined): V | undefined {
  if (key === undefined) return undefined;
  return values.get(`${binding.key}[${entityKey(key)}]`) as V | undefined;
}
export function setMapBinding(group: string, name: string, key: unknown, value: unknown): void {
  values.set(`${group}.${name}[${entityKey(key)}]`, value);
}

/** Test seam: set what a binding reads. */
export function setBinding(group: string, name: string, value: unknown): void { values.set(`${group}.${name}`, value); }
export function resetBindings(): void { values.clear(); triggers.length = 0; }
