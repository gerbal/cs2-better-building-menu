import { useCallback, useEffect, useState } from "react";
import { getLensChoice, setLensChoice, subscribeLensChoice } from "domain/buildingLensViewState";

/**
 * A lens choice as React state, shared across subtrees.
 *
 * The control plane sits beside the panel rather than inside it, so the group
 * dimension and the view mode are read and written from two places that share
 * no ancestor. This subscribes both to the one module-scoped value, so setting
 * it anywhere re-renders everywhere.
 */
export function useLensChoice(key: string, fallback: string): [string, (next: string) => void] {
  const [value, setValue] = useState(() => getLensChoice(key, fallback));

  useEffect(
    () => subscribeLensChoice(() => setValue(getLensChoice(key, fallback))),
    [key, fallback]
  );

  return [value, useCallback((next: string) => setLensChoice(key, next), [key])];
}
