import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderHtml, entry } from "../harness/render";
import { setBinding, resetBindings, triggers } from "../harness/stubs/cs2-api";
import { bindValue, useValue, trigger } from "cs2/api";
import { Button } from "cs2/ui";
import styles from "../../src/mods/BuildingCatalog/buildingCatalog.module.scss";

describe("the render harness", () => {
  it("answers a stylesheet import with the class names themselves", () => {
    // So `styles.row` is "row" and a test can assert on class="row".
    assert.equal(styles.row, "row");
    assert.equal(styles.anything, "anything");
  });

  it("lets a test set what a binding reads and see what a trigger sent", () => {
    resetBindings();
    const X$ = bindValue<number>("FindItBuildingMenu", "X", 1);
    const Probe = () => {
      const value = useValue(X$);
      trigger("FindItBuildingMenu", "Y", value);
      return <span>{value}</span>;
    };

    assert.equal(renderHtml(<Probe />), "<span>1</span>");
    setBinding("FindItBuildingMenu", "X", 2);
    assert.equal(renderHtml(<Probe />), "<span>2</span>");
    assert.deepEqual(triggers.at(-1), { group: "FindItBuildingMenu", name: "Y", args: [2] });
  });

  it("renders cs2/ui's Button as a button that keeps its labels and data attributes", () => {
    const html = renderHtml(<Button aria-label="Do" title="Do it" data-refused="true" onSelect={() => {}}>x</Button>);

    assert.match(html, /<button [^>]*aria-label="Do"/);
    assert.match(html, /data-refused="true"/);
    assert.match(html, /data-has-select="true"/);
  });

  it("builds an entry the components accept", () => {
    assert.equal(entry(3, { name: "Clinic" }).name, "Clinic");
    assert.equal(entry(3).prefabName, "Prefab3");
  });
});
