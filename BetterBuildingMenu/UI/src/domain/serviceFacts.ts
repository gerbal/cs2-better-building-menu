/**
 * Service figures beyond a building's headline capacity.
 *
 * The backend sends `{ key, value }` and never a label: a hospital's
 * helicopters, a garbage plant's processing rate and a post office's sorting
 * rate are each meaningful to one service and absent from the other twenty, so
 * they travel as a keyed list rather than twenty always-null fields on every
 * entry in the catalog. See BetterBuildingMenu.Domain.ServiceFact.
 *
 * This module owns the wording and the units, which is where wording belongs —
 * the indexer decides what is true, the UI decides how to say it.
 */
/**
 * The number formatter is INJECTED rather than imported.
 *
 * Every other module in this folder cross-imports types only, which is what
 * lets each be loaded on its own under Node's type stripping — a value import
 * here would be the first, and would make this module require a runtime
 * resolution its siblings do not. The caller already holds the separators.
 */
export type FormatNumber = (value: number) => string;

export interface ServiceFact {
  key: string;
  value: number;
}

interface ServiceFactPresentation {
  /** Our own key, so a translation can be shipped for it. */
  localizationKey: string;
  fallback: string;
  /** Appended after the number; "" for a bare count. */
  unit: string;
  /** A multiplier reads as "×1.2", not as a quantity. */
  multiplier?: boolean;
}

const PRESENTATION: Readonly<Record<string, ServiceFactPresentation>> = {
  helicopters: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Helicopters]",
    fallback: "Helicopters",
    unit: "",
  },
  disasterResponse: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.DisasterResponse]",
    fallback: "Disaster response",
    unit: "",
  },
  processingRate: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ProcessingRate]",
    fallback: "Processing",
    unit: "t/mo",
  },
  collectionTrucks: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.CollectionTrucks]",
    fallback: "Collection trucks",
    unit: "",
  },
  sortingRate: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.SortingRate]",
    fallback: "Sorting",
    unit: "t/mo",
  },
  postVans: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PostVans]",
    fallback: "Post vans",
    unit: "",
  },
  graduation: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Graduation]",
    fallback: "Graduation",
    unit: "",
    multiplier: true,
  },
  attractiveness: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Attractiveness]",
    fallback: "Attractiveness",
    unit: "",
  },

  // Zones. Per cell rather than per building, which is what a zone is: a rate
  // the player paints rather than a thing they place.
  zoneHouseholds: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]",
    fallback: "Homes",
    unit: "",
  },
  zoneMaxHeight: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHeight]",
    fallback: "Height",
    unit: "m",
  },
  zoneUpkeep: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Upkeep]",
    fallback: "Upkeep",
    unit: "",
  },
  zoneElectricity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Electricity]",
    fallback: "Electricity",
    unit: "",
  },
  zoneWater: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Water]",
    fallback: "Water",
    unit: "",
  },
  zoneGarbage: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Garbage]",
    fallback: "Garbage",
    unit: "",
  },
  zoneGroundPollution: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.GroundPollution]",
    fallback: "Ground pollution",
    unit: "",
  },
  zoneAirPollution: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.AirPollution]",
    fallback: "Air pollution",
    unit: "",
  },
  zoneNoisePollution: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.NoisePollution]",
    fallback: "Noise pollution",
    unit: "",
  },
};

/** The keys this build knows how to draw, for the localization audit. */
export const SERVICE_FACT_KEYS: readonly string[] = Object.keys(PRESENTATION);

/** Every localization key a service fact can ask for. */
export const SERVICE_FACT_LOCALIZATION_KEYS: readonly string[] =
  Object.values(PRESENTATION).map((entry) => entry.localizationKey);

export interface RenderedServiceFact {
  key: string;
  label: string;
  value: string;
}

/**
 * The facts this build can draw, in the order the indexer recorded them.
 *
 * A key with no entry here is DROPPED rather than shown raw. The backend can
 * add a figure before the UI has wording for it — the two ship together but a
 * player may run a mismatched pair — and "sortingRate 240" on a card is worse
 * than the line not being there.
 */
export function renderServiceFacts(
  facts: readonly ServiceFact[] | null | undefined,
  translate: (key: string, fallback: string | null) => string | null,
  formatNumber: FormatNumber = (value) => String(value),
): RenderedServiceFact[] {
  if (!facts || facts.length === 0) {
    return [];
  }

  const rendered: RenderedServiceFact[] = [];

  for (const fact of facts) {
    const presentation = PRESENTATION[fact?.key ?? ""];

    if (!presentation) continue;
    if (typeof fact.value !== "number" || !Number.isFinite(fact.value)) continue;

    const label = translate(presentation.localizationKey, null) ?? presentation.fallback;

    let value: string;

    if (presentation.multiplier) {
      // One decimal: a graduation modifier of 1.15 is a different building
      // from one of 1.5, and rounding to whole numbers makes both read "×1".
      value = `×${(Math.round(fact.value * 100) / 100).toFixed(2).replace(/0$/, "")}`;
    } else {
      const number = formatNumber(Math.round(fact.value));
      value = presentation.unit === "" ? number : `${number} ${presentation.unit}`;
    }

    rendered.push({ key: fact.key, label, value });
  }

  return rendered;
}
