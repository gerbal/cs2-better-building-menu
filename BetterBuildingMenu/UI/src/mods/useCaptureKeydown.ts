import { useEffect, useRef } from "react";

/**
 * Hears every keydown on the document while `onKeyDown` is set, through one
 * listener that calls the newest handler. Capture phase: the game's app container
 * stops keydown propagation, so a bubble listener on the document never hears it.
 */
export function useCaptureKeydown(onKeyDown: ((event: KeyboardEvent) => void) | null): void {
  const latest = useRef(onKeyDown);
  latest.current = onKeyDown;
  const listening = onKeyDown !== null;

  useEffect(() => {
    if (!listening) return;

    const listener = (event: KeyboardEvent) => latest.current?.(event);
    document.addEventListener("keydown", listener, true);

    return () => document.removeEventListener("keydown", listener, true);
  }, [listening]);
}
