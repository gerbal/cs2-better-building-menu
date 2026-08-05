/**
 * Which of the city's demand series a building should be forecast against.
 *
 * The game publishes a capacity/demand pair per service infoview, but a
 * building's subcategory does not map onto them one to one: Health & Deathcare
 * is one subcategory covering both patients-against-sick and cemetery-places-
 * against-burials, Water & Sewage likewise, and Education & Research carries
 * four separate student series behind a single "students" unit.
 *
 * Where a subcategory has no series the answer is null. Fire and police are
 * coverage services — the game reports no capacity against a demand figure for
 * them — and a park has no demand at all. Forecasting those against something
 * unrelated would be worse than staying quiet.
 */

export interface ServiceForecastBinding {
  group: string;
  capacity: string;
  demand: string;
  unit: string;
}

/** Every series the forecast can read, keyed by the id the mapping returns. */
export const SERVICE_FORECAST_BINDINGS: Record<string, ServiceForecastBinding> = {
  elementary: { group: "educationInfo", capacity: "elementaryCapacity", demand: "elementaryEligible", unit: "students" },
  highSchool: { group: "educationInfo", capacity: "highSchoolCapacity", demand: "highSchoolEligible", unit: "students" },
  college: { group: "educationInfo", capacity: "collegeCapacity", demand: "collegeEligible", unit: "students" },
  university: { group: "educationInfo", capacity: "universityCapacity", demand: "universityEligible", unit: "students" },
  patients: { group: "healthcareInfo", capacity: "patientCapacity", demand: "sickCount", unit: "patients" },
  cemetery: { group: "healthcareInfo", capacity: "cemeteryCapacity", demand: "cemeteryUse", unit: "plots" },
  garbage: { group: "garbageInfo", capacity: "capacity", demand: "storedGarbage", unit: "t" },
  water: { group: "waterInfo", capacity: "waterCapacity", demand: "waterConsumption", unit: "m³" },
  sewage: { group: "waterInfo", capacity: "sewageCapacity", demand: "sewageConsumption", unit: "m³" },
  electricity: { group: "electricityInfo", capacity: "electricityProduction", demand: "electricityConsumption", unit: "MW" },
  prison: { group: "policeInfo", capacity: "prisonCapacity", demand: "prisoners", unit: "prisoners" },
};

export interface ServiceForecastKey {
  key: string;
  binding: ServiceForecastBinding;
}

const has = (name: string, ...needles: string[]) =>
  needles.some((needle) => name.toLowerCase().includes(needle.toLowerCase()));

/**
 * Education tiers, most specific first: "High School" contains "School", so
 * testing elementary first would swallow every high school in the game.
 *
 * The tier is only discoverable from the building's name — nothing in the
 * indexed data distinguishes them — so this is frankly a heuristic, and an
 * unrecognised education building returns null rather than being forecast
 * against a tier it may not serve.
 */
const EDUCATION_TIERS: Array<[string, string[]]> = [
  ["university", ["University"]],
  ["college", ["College"]],
  ["highSchool", ["High School", "Highschool"]],
  ["elementary", ["Elementary", "Primary", "Children's Clinic"]],
];

/**
 * The tier a school grants, straight from `SchoolData.m_EducationLevel`.
 *
 * These are the values the game's own education infoview switches on, so this
 * agrees with the simulation by construction rather than by resemblance. 0 and
 * 5 exist but are not tiers the infoview counts.
 */
const EDUCATION_LEVEL_TIERS: Record<number, string> = {
  1: "elementary",
  2: "highSchool",
  3: "college",
  4: "university",
};

function resolve(subCategory: string, name: string, educationLevel?: number | null): string | null {
  if (has(subCategory, "EducationResearch")) {
    // Data first. The name heuristic below cannot see a modded "Akademie" and
    // would silently drop it.
    if (typeof educationLevel === "number") {
      return EDUCATION_LEVEL_TIERS[educationLevel] ?? null;
    }

    for (const [key, needles] of EDUCATION_TIERS) {
      if (has(name, ...needles)) return key;
    }

    // Research institutes, telescopes and labs teach nobody.
    return null;
  }

  if (has(subCategory, "_Health")) {
    // Health & Deathcare is one subcategory with two demand series.
    return has(name, "Cemetery", "Crematorium", "Burial", "Columbarium", "Mausoleum", "Hearse", "Grave")
      ? "cemetery"
      : "patients";
  }

  if (has(subCategory, "_Water")) {
    return has(name, "Sewage", "Wastewater", "Treatment", "Settling")
      ? "sewage"
      : "water";
  }

  if (has(subCategory, "_Garbage")) return "garbage";
  if (has(subCategory, "_Electricity")) return "electricity";

  if (has(subCategory, "_Police")) {
    // Police stations provide coverage, not capacity against a demand figure;
    // only prisons and jails have a series to forecast against.
    return has(name, "Prison", "Jail") ? "prison" : null;
  }

  return null;
}

export function getServiceForecastKey(
  entry:
    | { subCategory?: string | null; name?: string | null; educationLevel?: number | null }
    | null
    | undefined
): ServiceForecastKey | null {
  const subCategory = entry?.subCategory ?? "";
  const name = entry?.name ?? "";
  if (!subCategory) return null;

  const key = resolve(subCategory, name, entry?.educationLevel);
  if (!key) return null;

  const binding = SERVICE_FORECAST_BINDINGS[key];

  return binding ? { key, binding } : null;
}
