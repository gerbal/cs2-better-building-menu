import classNames from "classnames";
import { memo, useEffect, useRef, useState } from "react";

import { deviceRem } from "domain/bodyGeometry";
import { drawnRoom, type DrawnRoom } from "domain/measuredFit";
import { nameRuns, planFits, planName } from "domain/namePlan";
import styles from "./plannedName.module.scss";

export interface PlannedNameProps {
  name: string;
  /** The room the name draws in, in rem, as the body works it out. */
  width: number;
  lines: number;
  /** The name's type, in rem, at the text scale. */
  font: number;
  /** Room the stylesheet adds after each character, in rem: a label's caps are tracked. */
  tracking?: number;
  /** The row's distinguishing word, which a cut keeps; "" for none. */
  distinct?: string;
  /** The query the page answers, whose words a cut keeps; "" without one. */
  typed?: string;
  /** Whether the typed word is drawn dimmed, by the Dim the typed word knob. */
  dim?: boolean;
  /**
   * Whether the box hugs its lines rather than taking the room its container gives it: its drawn width
   * then says nothing of the room, and only a line that ran past it narrows the plan.
   */
  hugs?: boolean;
  /** Whether the box carries `data-bbm-name`, a building's name's length: a label's name does not. */
  marked?: boolean;
  className?: string;
}

/** Before a frame has drawn the name: the body's estimate, as it is. */
const UNDRAWN: DrawnRoom = { box: null, fit: 1 };

/** A box that hugs its lines reads as one not laid out: its width is no room. */
const NO_BOX = { clientWidth: 0 };

/**
 * A name planned over its lines, each line a box of its own, whole where it fits and cut once where it
 * does not; the hover card and the aria-label carry the whole of it. The room is the body's estimate
 * until a frame has drawn the name, then the box as drawn, narrowed by any line the estimate said fits
 * that ran past it. It never widens again until the name, its type, its lines, the typed text or the
 * distinguishing word change. See docs/design-notes.md, "Names".
 */
export const PlannedName = memo(function PlannedName({ name, width, lines, font, tracking = 0, distinct = "", typed = "", dim = false, hugs = false, marked = true, className }: PlannedNameProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  // A room drawn for one name, type, line count, typed text or distinguishing word says nothing of
  // another: they start from the estimate again in the same render, not a frame late.
  const key = `${name}\n${font}\n${lines}\n${typed}\n${distinct}`;
  const [state, setState] = useState<{ key: string; drawn: DrawnRoom }>({ key, drawn: UNDRAWN });
  const drawn = state.key === key ? state.drawn : UNDRAWN;
  if (state.key !== key) setState({ key, drawn });
  const room = { width: (drawn.box ?? width) * drawn.fit, lines, font, tracking };
  // Each word typed is kept on its own: a search matches its phrase anywhere in the name.
  const plan = planName(name, room, { keep: [distinct], typed: typed.split(/\s+/) });
  const fitted = planFits(plan.lines, room);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const next = drawnRoom(drawn, hugs ? NO_BOX : box, Array.from(box.children) as HTMLElement[], deviceRem(window.innerHeight), fitted);
      if (next !== drawn) setState({ key, drawn: next });
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
  }, [key, drawn, hugs, fitted]);

  return (
    <span ref={boxRef} className={classNames(styles.planned, className)} data-bbm-name={marked ? name.length : undefined}>
      {plan.lines.map((line, index) => (
        <span key={index} className={styles.line}>
          {dim && typed.trim() !== ""
            // The typed word in a span of its own; the run after it keeps its space (nameRuns).
            ? nameRuns(line, typed).map((run, at) => (run.typed ? <span key={at} className={styles.typed}>{run.text}</span> : run.text))
            : line}
        </span>
      ))}
    </span>
  );
});
