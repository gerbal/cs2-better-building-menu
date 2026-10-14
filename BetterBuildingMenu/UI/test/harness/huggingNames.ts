import { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { textWidth } from "../../src/domain/textWidth";

/** Every planned name drawn, in the order their boxes mount, with the room each was given. */
export const plannedNames = (root: ReactTestRenderer): ReactTestInstance[] =>
  root.root.findAll((node) => typeof node.props.name === "string" && typeof node.props.width === "number" && typeof node.props.font === "number" && typeof node.props.lines === "number");

const textOf = (node: ReactTestInstance): string => node.children.map((child) => (typeof child === "string" ? child : textOf(child))).join("");

/** A planned name's lines as drawn. */
export const linesOf = (name: ReactTestInstance): string[] =>
  name.findAll((node) => node.type === "span" && String(node.props.className ?? "").split(" ").includes("line")).map(textOf);

/**
 * A `createNodeMock` for the planned names in a host that sizes them to their lines, as Cohtml lays a
 * name out in a flex column or an absolute band: each line drawn `share` of its estimate (the game's
 * font runs narrower than the advance table), the box as wide as the widest line, nothing overflowing.
 * Any other element is `other`'s.
 */
export function huggingNames(root: () => ReactTestRenderer, other: (element: { type: unknown; props: Record<string, unknown> }) => unknown = () => null, share = 0.93) {
  let mounted = 0;
  return (element: { type: unknown; props: Record<string, unknown> }): unknown => {
    if (element.type !== "span" || !String(element.props.className ?? "").split(" ").includes("planned")) return other(element);
    const at = mounted++;
    const drawn = () => {
      const name = plannedNames(root())[at];
      return linesOf(name).map((line) => textWidth(line, name.props.font as number) * share);
    };
    return {
      get clientWidth() { return Math.max(0, ...drawn()); },
      get children() { return drawn().map((width) => ({ clientWidth: width, offsetWidth: width, scrollWidth: width })); },
    };
  };
}

/** Runs every frame asked for, and the frames those ask for, until none is asked or `most` have run. */
export function settleFrames(frames: Map<number, () => void>, most = 40): void {
  for (let pass = 0; pass < most && frames.size > 0; pass += 1) {
    const due = [...frames.values()];
    frames.clear();
    act(() => due.forEach((frame) => frame()));
  }
}
