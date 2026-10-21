import { useEffect, type DependencyList, type RefObject } from "react";

/**
 * Reads what was drawn once Cohtml has laid it out: two frames after each render
 * that changes `deps`, and two frames after each resize of the element. `measure`
 * is handed those deps, so a component drawn per row passes a module-level one; null reads nothing.
 */
export function useSettledMeasure<E extends Element, D extends DependencyList>(
  ref: RefObject<E>,
  measure: ((element: E, deps: D) => void) | null,
  deps: D
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || !measure) return;

    // Never in the tick of the render: Cohtml reports the PREVIOUS text's
    // scrollWidth for a line whose text just changed, and 0 for one it has not
    // laid out. Every read waits two frames, the observer's included.
    const read = () => measure(element, deps);
    let outer = 0;
    let inner = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(read);
      });
    };
    // Watch the box rather than guess when it settles — Cohtml relayouts a
    // frame after a view change; the box's own resize is the signal.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(element);
    scheduleMeasure();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
    // The caller's deps say when to read afresh; measure and deps are that render's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
