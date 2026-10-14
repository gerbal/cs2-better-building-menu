import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { create } from "react-test-renderer";
import { TopEdge } from "../../src/mods/TopEdge/TopEdge";

const edge = (active: boolean, onBeginResize: (event: unknown) => void = () => undefined) =>
  create(<TopEdge active={active} onBeginResize={onBeginResize} />).root;

describe("the top edge", () => {
  it("labels itself through the game's Tooltip, never a title", () => {
    const root = edge(false);

    assert.equal(root.findByProps({ className: "topEdge" }).props.title, undefined);
    assert.deepEqual(root.findByProps({ "data-tooltip": "true" }).children, ["Drag to resize · double-click for the game's size"]);
  });

  it("names its edge for the live check and the render tests", () => {
    assert.equal(edge(false).findByProps({ className: "topEdge" }).props["data-bbm-edge"], "top");
  });

  it("shows its grip pressed while a drag is on", () => {
    assert.equal(edge(false).findAll((node) => node.props.className === "grip").length, 1);
    assert.equal(edge(true).findAll((node) => node.props.className === "grip gripActive").length, 1);
  });

  it("starts the drag on a press", () => {
    const pressed: unknown[] = [];
    const event = { clientY: 12 };
    edge(false, (received) => pressed.push(received)).findByProps({ className: "topEdge" }).props.onMouseDown(event);

    assert.deepEqual(pressed, [event]);
  });
});
