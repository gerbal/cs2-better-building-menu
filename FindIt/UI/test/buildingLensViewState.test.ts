import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  LENS_DISCLOSURE_KEYS,
  getLensDisclosure,
  resetLensViewState,
  setLensDisclosure,
} from "../src/domain/buildingLensViewState.ts";

describe("Building Lens view state", () => {
  beforeEach(() => resetLensViewState());

  it("falls back until a disclosure has been set", () => {
    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets), false);
    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true), true);
  });

  it("remembers an open drawer across a remount", () => {
    // The panel unmounts on close, on place, and on the lens toggle. Filters
    // are backend-owned and survive, so collapsing their drawer hid active
    // constraints behind a shut door.
    setLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges, true);

    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges), true);
  });

  it("keeps disclosures independent of one another", () => {
    setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true);

    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets), true);
    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges), false);
  });

  it("honours an explicit close rather than treating it as unset", () => {
    setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, false);

    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true), false);
  });
});
