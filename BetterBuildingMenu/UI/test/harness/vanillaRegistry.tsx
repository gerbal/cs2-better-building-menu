import type { ReactNode } from "react";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

/**
 * The game's module registry, as far as VanillaComponentResolver reads it.
 *
 * index.tsx hands the resolver the real registry at boot; under the harness
 * the same paths answer with plain elements and class proxies, so a component
 * that draws a vanilla ToolButton or reads a vanilla theme renders.
 */
type Any = Record<string, unknown>;

const classes = (prefix: string) => new Proxy({}, { get: (_, key) => (typeof key === "string" ? `${prefix}-${key}` : "") });

const ToolButton = ({ children, className, selected, tooltip, onSelect, disabled, ...rest }: Any & { children?: ReactNode }) => (
  <button
    className={className as string}
    title={typeof tooltip === "string" ? tooltip : undefined}
    disabled={disabled as boolean}
    data-selected={selected ? "true" : undefined}
    data-has-select={onSelect ? "true" : undefined}
    {...Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("data-") || k.startsWith("aria-")))}
  >
    {children}
  </button>
);
const Section = ({ title, children }: { title?: string | null; children?: ReactNode }) => <div data-section={title ?? ""}>{children}</div>;
const TabBar = ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>;
const Tab = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const TabNav = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

const modules = new Map<string, Any>([
  ["game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", { Section }],
  ["game-ui/game/components/tool-options/tool-button/tool-button.tsx", { ToolButton, StepToolButton: ToolButton }],
  ["game-ui/game/components/tool-options/tool-button/tool-button.module.scss", { classes: classes("tool-button") }],
  ["game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.module.scss", { classes: classes("mouse-tool-options") }],
  ["game-ui/common/focus/focus-key.ts", { FOCUS_DISABLED: "disabled", FOCUS_AUTO: "auto", useUniqueFocusKey: () => null }],
  ["game-ui/game/components/item-grid/item-grid.module.scss", { classes: classes("item-grid") }],
  ["game-ui/common/tabs/tabs.tsx", { TabBar, Tab, TabNav }],
  ["game-ui/common/tabs/tabs.module.scss", { classes: classes("tabs") }],
]);

export function installVanillaRegistry(): void {
  VanillaComponentResolver.setRegistry({ registry: modules } as never);
}
