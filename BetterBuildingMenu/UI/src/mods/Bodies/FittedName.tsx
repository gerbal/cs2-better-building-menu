import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import { lineBudgetFromDrawn } from "domain/measuredFit";
import { wrapTileLabel } from "domain/tileLabel";
import styles from "./fittedName.module.scss";

/**
 * A name shortened for drawing only, over as many lines as it is given; the hover card and the
 * aria-label carry the whole of it. The character budget is an estimate corrected from what was
 * drawn, and the correction only tightens, so it cannot spiral.
 */
export const FittedName = ({ label, budget, lines, className }: { label: string; budget: number; lines: number; className?: string }) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  // A new name or a new estimate starts from the estimate again.
  useEffect(() => {
    setFit(null);
  }, [label, budget]);
  const effective = fit === null ? budget : Math.min(budget, fit);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const next = lineBudgetFromDrawn(effective, Array.from(box.children) as HTMLElement[]);
      if (next < effective) setFit(next);
    };
    // Never in the tick of the render: Cohtml reports the PREVIOUS text's
    // scrollWidth for a line whose text just changed, and 0 for one it has not
    // laid out. Every read waits two frames, the observer's included.
    let outer = 0;
    let inner = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(measure);
      });
    };
    // Watch the box rather than guess when it settles — Cohtml relayouts a
    // frame after a view change; the box's own resize is the signal.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(box);
    scheduleMeasure();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [label, effective]);

  return (
    <span ref={boxRef} className={classNames(styles.fitted, className)}>
      {wrapTileLabel(label, effective, lines).map((line, index) => (
        // A line wrapTileLabel already cut carries its own ellipsis, so CSS must not add a second one.
        <span key={index} className={classNames(styles.line, line.includes("…") && styles.elided)}>
          {line}
        </span>
      ))}
    </span>
  );
};
