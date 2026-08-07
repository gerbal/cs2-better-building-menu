import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyThumbnailFallback } from "../src/domain/thumbnailFallback.ts";

/** Enough of an HTMLImageElement for the fallback rule. */
const fakeImage = (src: string) =>
  ({ src, onerror: (() => {}) as unknown, style: { visibility: "" } }) as unknown as HTMLImageElement;

describe("thumbnail fallback", () => {
  it("swaps a thumbnail that failed to render for the fallback", () => {
    const image = fakeImage("thumbnail://ThumbnailCamera/BuildingPrefab/EU_CommercialGasStation01_L1_2x2");
    applyThumbnailFallback(image, "coui://finditbuildingmenu/Icons/Commercial.svg");
    assert.equal(image.src, "coui://finditbuildingmenu/Icons/Commercial.svg");
  });

  it("clears the handler so a failing fallback cannot loop", () => {
    const image = fakeImage("thumbnail://broken");
    applyThumbnailFallback(image, "coui://fallback.svg");
    assert.equal(image.onerror, null);
  });

  it("hides the image when there is no fallback to try", () => {
    const image = fakeImage("thumbnail://broken");
    applyThumbnailFallback(image, undefined);
    assert.equal(image.src, "thumbnail://broken");
    assert.equal(image.style.visibility, "hidden");
  });

  it("hides rather than re-assigns when the fallback is what already failed", () => {
    const image = fakeImage("coui://fallback.svg");
    applyThumbnailFallback(image, "coui://fallback.svg");
    assert.equal(image.style.visibility, "hidden");
  });

  it("treats an empty fallback as no fallback", () => {
    const image = fakeImage("thumbnail://broken");
    applyThumbnailFallback(image, "");
    assert.equal(image.style.visibility, "hidden");
  });
});
