import { Component, forwardRef, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import type { ModuleRegistryExtend } from "cs2/modding";

interface ExtensionBoundaryProps {
  name: string;
  /** What draws instead once ours has failed: the game's own component, or nothing. */
  fallback: () => ReactNode;
  children: ReactNode;
}

/**
 * Keeps a render error in our code out of the game's UI. The mod draws inside
 * vanilla's tree, so an error with nowhere to stop takes the whole screen down;
 * here it logs once and the game's own component draws in its place.
 */
export class ExtensionBoundary extends Component<ExtensionBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[BetterBuildingMenu] ${this.props.name} failed; the game's own stands in.`, error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback() : this.props.children;
  }
}

/**
 * A component extension that falls back to the component it extends. Only for
 * components: a hook extension (useToolOptionsVisible) cannot take a boundary.
 * The ref vanilla passes reaches ours, or the game's own in its place.
 */
export function safeExtension(name: string, extension: ModuleRegistryExtend): ModuleRegistryExtend {
  return (VanillaComponent: any) => {
    const Extended = extension(VanillaComponent) as ComponentType<any>;

    const Safe = forwardRef<unknown, any>((props, ref) => (
      <ExtensionBoundary name={name} fallback={() => <VanillaComponent {...props} ref={ref} />}>
        <Extended {...props} ref={ref} />
      </ExtensionBoundary>
    ));

    // The registry's type wants a plain function component; forwardRef's
    // exotic component renders the same way.
    return Safe as unknown as (props: any) => JSX.Element;
  };
}

/** An appended component, which draws nothing of the game's; on failure, nothing. */
export function safeAppend(name: string, Appended: ComponentType): ComponentType {
  return () => (
    <ExtensionBoundary name={name} fallback={() => null}>
      <Appended />
    </ExtensionBoundary>
  );
}
