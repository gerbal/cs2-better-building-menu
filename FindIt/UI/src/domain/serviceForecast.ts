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

/**
 * Role to demand series.
 *
 * Find It classifies by component query — one processor per network
 * subcategory, a component check per service role — and the indexer already
 * derives exactly the distinctions this module used to guess at from a display
 * name. DeathcareFacilityData is what makes a building a cemetery;
 * WastewaterTreatmentPlantData is what makes one a treatment plant. Matching
 * "Cemetery" or "Wastewater" in a name was reading the label off the box
 * instead of looking inside it, and it could not see a modded name or a
 * localized one.
 *
 * The education tier stays separate because a school's series depends on
 * SchoolData.m_EducationLevel rather than on being a school.
 */
const ROLE_SERIES: Record<string, string> = {
  Hospital: "patients",
  DeathcareFacility: "cemetery",
  WaterPumpingStation: "water",
  WastewaterTreatmentPlant: "sewage",
  SewageOutlet: "sewage",
  GarbageFacility: "garbage",
  PowerPlant: "electricity",
  Prison: "prison",
  // FireStation, PoliceStation and EmergencyShelter are coverage services: the
  // game reports no capacity against a demand figure for them, and forecasting
  // against something unrelated would be worse than staying quiet.
};

const has = (name: string, ...needles: string[]) =>
  needles.some((needle) => name.toLowerCase().includes(needle.toLowerCase()));

/**
 * The tier a school grants, straight from `SchoolData.m_EducationLevel`.
 *
 * These are the values the game's own education infoview switches on, so this
 * agrees with the simulation by construction rather than by resemblance. 0 and
 * 5 exist but are not tiers the infoview counts.
 *
 * The same four rows also head the School tier grouping, as SCHOOL_TIERS in
 * buildingGroups.ts. They are duplicated rather than shared because this
 * toolchain cannot express a value import between two src modules — TypeScript
 * 4.9 rejects the `.ts` specifier the test runner's ESM resolver requires, and
 * accepts a `.js` one the resolver cannot find. So drift is caught by a test
 * instead: "the forecast knows every tier the headings do", in
 * serviceForecast.test.ts.
 */
const EDUCATION_LEVEL_TIERS: Record<number, string> = {
  1: "elementary",
  2: "highSchool",
  3: "college",
  4: "university",
};

function resolve(
  subCategory: string,
  name: string,
  educationLevel?: number | null,
  role?: string | null
): string | null {
  // A school's series is its tier, which the role alone does not carry.
  if (role === "School" || has(subCategory, "EducationResearch")) {
    // No name heuristic here any more. m_EducationLevel is a field of
    // SchoolData, so anything with student capacity always carries it, and a
    // building without SchoolData has no capacity to forecast from. Measured on
    // a real catalog: of 44 education buildings, 40 have a level and the four
    // without are research facilities that teach nobody.
    return typeof educationLevel === "number"
      ? EDUCATION_LEVEL_TIERS[educationLevel] ?? null
      : null;
  }

  // The role decides everything else. It comes from the component the prefab
  // actually carries, so it is right for a modded building and for every
  // language, neither of which a name match manages.
  if (typeof role === "string" && role.trim() !== "") {
    return ROLE_SERIES[role.trim()] ?? null;
  }

  // No role means no service component, which means no capacity to forecast.
  // Parks, props and zoned buildings all land here.
  return null;
}

export function getServiceForecastKey(
  entry:
    | {
        subCategory?: string | null;
        name?: string | null;
        educationLevel?: number | null;
        /** The component-derived role, from BuildingRole.ResolvePrimary. */
        buildingType?: string | null;
      }
    | null
    | undefined
): ServiceForecastKey | null {
  const subCategory = entry?.subCategory ?? "";
  const name = entry?.name ?? "";
  const role = entry?.buildingType ?? null;
  if (!subCategory && !role) return null;

  const key = resolve(subCategory, name, entry?.educationLevel, role);
  if (!key) return null;

  const binding = SERVICE_FORECAST_BINDINGS[key];

  return binding ? { key, binding } : null;
}
