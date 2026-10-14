import { forwardRef, type ReactNode } from "react";
// getModule under the harness: stylesheet modules answer with a class proxy,
// vanilla components with a plain element; anything else is undefined. The
// game's TextInput takes a ref, and so does this one.
const TextInput = forwardRef<HTMLInputElement, { value?: string; className?: string; placeholder?: string | null; children?: ReactNode }>(
  function TextInput({ value, className, placeholder }, ref) {
    return <input ref={ref} className={className} defaultValue={value} placeholder={placeholder ?? undefined} />;
  }
);
const registry: Record<string, Record<string, unknown>> = {
  "game-ui/common/input/text/text-input.tsx": { TextInput },
};
/** Test seam: let a test supply a vanilla component the game would provide. */
export function setModule(modulePath: string, name: string, value: unknown): void {
  (registry[modulePath] ??= {})[name] = value;
}
/** Test seam: forget anything a test supplied. */
export function resetModules(): void {
  for (const path of Object.keys(registry)) {
    if (path !== "game-ui/common/input/text/text-input.tsx") delete registry[path];
  }
}
export function getModule(modulePath: string, name: string): unknown {
  if (registry[modulePath]?.[name] !== undefined) return registry[modulePath][name];
  if (modulePath.endsWith(".scss") && name === "classes") return new Proxy({}, { get: (_, key) => (typeof key === "string" ? `vanilla-${key}` : "") });
  return undefined;
}
export type ModuleRegistryExtend = (component: (props: Record<string, unknown>) => unknown) => (props: Record<string, unknown>) => unknown;
export type ModuleRegistry = unknown;
export type ModRegistrar = (registry: unknown) => void;
