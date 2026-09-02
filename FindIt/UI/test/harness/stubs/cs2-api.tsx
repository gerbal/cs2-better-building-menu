// cs2/api under the harness: bindings are a registry the test writes to.
const values = new Map<string, unknown>();
export const triggers: Array<{ group: string; name: string; args: unknown[] }> = [];

export interface StubBinding<T> { key: string; fallback: T | undefined }

export function bindValue<T>(group: string, name: string, fallback?: T): StubBinding<T> {
  return { key: `${group}.${name}`, fallback };
}
export function useValue<T>(binding: StubBinding<T>): T {
  return (values.has(binding.key) ? values.get(binding.key) : binding.fallback) as T;
}
export function trigger(group: string, name: string, ...args: unknown[]): void {
  triggers.push({ group, name, args });
}
export function call(): Promise<unknown> { return Promise.resolve(undefined); }

/** Test seam: set what a binding reads. */
export function setBinding(group: string, name: string, value: unknown): void { values.set(`${group}.${name}`, value); }
export function resetBindings(): void { values.clear(); triggers.length = 0; }
