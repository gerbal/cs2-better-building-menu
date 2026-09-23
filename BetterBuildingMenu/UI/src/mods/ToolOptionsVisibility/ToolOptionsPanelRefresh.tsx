import { ModuleRegistryExtend } from "cs2/modding";
import { useValue } from "cs2/api";
import { forwardRef } from "react";
import { LensOwnsCurrentMenu$ } from "mods/bindings";

/**
 * Re-renders the vanilla tool options panel whenever lens ownership changes,
 * so the hook-free ToolOptionsVisibility reads a fresh value. A component of
 * our own can subscribe freely: a swap of the panel's type remounts it.
 */
export const ToolOptionsPanelRefresh: ModuleRegistryExtend = (Component: any) => {
  const Refresh = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    useValue(LensOwnsCurrentMenu$);

    return <Component {...props} ref={ref} />;
  });

  // The registry's type wants a plain function component; forwardRef's
  // exotic component renders the same way.
  return Refresh as unknown as (props: unknown) => JSX.Element;
};
