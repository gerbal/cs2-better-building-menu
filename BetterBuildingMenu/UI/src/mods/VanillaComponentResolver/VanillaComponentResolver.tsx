import { FocusKey, Theme, UniqueFocusKey } from "cs2/bindings";
import { ModuleRegistry } from "cs2/modding";
import { HTMLAttributes, ReactNode } from "react";
import { reportMissing } from "mods/gameModules";

// Prop shapes for the vanilla components this mod borrows. The game ships no
// types for them, so these are read off the shipped bundle in the UI developer
// tools at http://localhost:9444/ under Sources -> Index.js.
type PropsToolButton = {
  focusKey?: UniqueFocusKey | null;
  src: string;
  selected?: boolean;
  multiSelect?: boolean;
  disabled?: boolean;
  tooltip?: string | ReactNode | null;
  selectSound?: any;
  uiTag?: string;
  className?: string;
  children?: string | JSX.Element | JSX.Element[];
  onSelect?: (x: any) => any;
} & HTMLAttributes<any>;

type PropsStepToolButton = {
  focusKey?: UniqueFocusKey | null;
  selectedValue: number;
  values: number[];
  tooltip?: string | null;
  uiTag?: string;
  onSelect?: (x: any) => any;
} & HTMLAttributes<any>;

type PropsSection = {
  title?: string | null;
  uiTag?: string;
  children: string | JSX.Element | JSX.Element[];
};

// The game's own segmented control. The minifier renames locals but keeps
// destructured property names, so these are the real ones.
type PropsTabBar = {
  className?: string;
  children?: ReactNode;
};

type PropsTab = {
  // Tab marks itself selected when id === selectedId; there is no `selected`
  // prop, and passing one does nothing.
  id: string;
  selectedId?: string;
  uiTag?: string;
  disabled?: boolean;
  locked?: boolean;
  selectSound?: any;
  className?: string;
  children?: ReactNode;
  onSelect: (id: string) => void;
};

// Wraps a TabBar to bind the gamepad/keyboard "Switch Tab" action. Disabled by
// the component itself when there is nothing to switch between.
type PropsTabNav = {
  tabs: string[];
  selectedTab?: string;
  selectPreviousSound?: any;
  selectNextSound?: any;
  children?: ReactNode;
  onSelect: (id: string) => void;
};

// Every vanilla component and stylesheet theme this mod pulls out of the
// registry, by module path and export name.
const registryIndex = {
  Section: ["game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", "Section"],
  ToolButton: ["game-ui/game/components/tool-options/tool-button/tool-button.tsx", "ToolButton"],
  StepToolButton: ["game-ui/game/components/tool-options/tool-button/tool-button.tsx", "StepToolButton"],
  toolButtonTheme: ["game-ui/game/components/tool-options/tool-button/tool-button.module.scss", "classes"],
  mouseToolOptionsTheme: ["game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.module.scss", "classes"],
  FOCUS_DISABLED: ["game-ui/common/focus/focus-key.ts", "FOCUS_DISABLED"],
  FOCUS_AUTO: ["game-ui/common/focus/focus-key.ts", "FOCUS_AUTO"],
  useUniqueFocusKey: ["game-ui/common/focus/focus-key.ts", "useUniqueFocusKey"],
  assetGridTheme: ["game-ui/game/components/item-grid/item-grid.module.scss", "classes"],
  TabBar: ["game-ui/common/tabs/tabs.tsx", "TabBar"],
  Tab: ["game-ui/common/tabs/tabs.tsx", "Tab"],
  TabNav: ["game-ui/common/tabs/tabs.tsx", "TabNav"],
  tabsTheme: ["game-ui/common/tabs/tabs.module.scss", "classes"],
};

// Written by Klyte for his mods' UI and used here unchanged.
export class VanillaComponentResolver {
  public static get instance(): VanillaComponentResolver {
    return this._instance!!;
  }
  private static _instance?: VanillaComponentResolver;

  public static setRegistry(in_registry: ModuleRegistry) {
    this._instance = new VanillaComponentResolver(in_registry);
  }
  private registryData: ModuleRegistry;

  constructor(in_registry: ModuleRegistry) {
    this.registryData = in_registry;
  }

  private cachedData: Partial<Record<keyof typeof registryIndex, any>> = {};
  private updateCache(entry: keyof typeof registryIndex) {
    const [path, name] = registryIndex[entry];
    // A game update can move any of these. Missing, it is logged once here and
    // the render that needed it falls to the extension's boundary.
    const found = this.registryData.registry.get(path)?.[name];

    if (found === undefined) reportMissing(`${path}#${name}`);

    return (this.cachedData[entry] = found);
  }

  public get Section(): (props: PropsSection) => JSX.Element {
    return this.cachedData["Section"] ?? this.updateCache("Section");
  }
  public get ToolButton(): (props: PropsToolButton) => JSX.Element {
    return this.cachedData["ToolButton"] ?? this.updateCache("ToolButton");
  }
  public get StepToolButton(): (props: PropsStepToolButton) => JSX.Element {
    return this.cachedData["StepToolButton"] ?? this.updateCache("StepToolButton");
  }

  public get TabBar(): (props: PropsTabBar) => JSX.Element {
    return this.cachedData["TabBar"] ?? this.updateCache("TabBar");
  }
  public get Tab(): (props: PropsTab) => JSX.Element {
    return this.cachedData["Tab"] ?? this.updateCache("Tab");
  }
  public get TabNav(): (props: PropsTabNav) => JSX.Element {
    return this.cachedData["TabNav"] ?? this.updateCache("TabNav");
  }
  // Stylesheets fall back to no classes: unstyled beats a render that throws.
  public get tabsTheme(): Theme | any {
    return this.cachedData["tabsTheme"] ?? this.updateCache("tabsTheme") ?? {};
  }
  public get toolButtonTheme(): Theme | any {
    return this.cachedData["toolButtonTheme"] ?? this.updateCache("toolButtonTheme") ?? {};
  }
  public get mouseToolOptionsTheme(): Theme | any {
    return this.cachedData["mouseToolOptionsTheme"] ?? this.updateCache("mouseToolOptionsTheme") ?? {};
  }
  public get assetGridTheme(): Theme | any {
    return this.cachedData["assetGridTheme"] ?? this.updateCache("assetGridTheme") ?? {};
  }

  public get FOCUS_DISABLED(): UniqueFocusKey {
    return this.cachedData["FOCUS_DISABLED"] ?? this.updateCache("FOCUS_DISABLED");
  }
  public get FOCUS_AUTO(): UniqueFocusKey {
    return this.cachedData["FOCUS_AUTO"] ?? this.updateCache("FOCUS_AUTO");
  }
  public get useUniqueFocusKey(): (focusKey: FocusKey, debugName: string) => UniqueFocusKey | null {
    return this.cachedData["useUniqueFocusKey"] ?? this.updateCache("useUniqueFocusKey");
  }
}
