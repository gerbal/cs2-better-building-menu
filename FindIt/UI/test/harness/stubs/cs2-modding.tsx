import type { ReactNode } from "react";
// getModule under the harness: stylesheet modules answer with a class proxy,
// vanilla components with a plain element; anything else is undefined.
const TextInput = ({ value, className }: { value?: string; className?: string; children?: ReactNode }) => <input className={className} defaultValue={value} />;
const registry: Record<string, Record<string, unknown>> = {
  "game-ui/common/input/text/text-input.tsx": { TextInput },
};
export function getModule(modulePath: string, name: string): unknown {
  if (registry[modulePath]?.[name] !== undefined) return registry[modulePath][name];
  if (modulePath.endsWith(".scss") && name === "classes") return new Proxy({}, { get: (_, key) => (typeof key === "string" ? `vanilla-${key}` : "") });
  return undefined;
}
export type ModuleRegistryExtend = (component: (props: Record<string, unknown>) => unknown) => (props: Record<string, unknown>) => unknown;
export type ModuleRegistry = unknown;
export type ModRegistrar = (registry: unknown) => void;
