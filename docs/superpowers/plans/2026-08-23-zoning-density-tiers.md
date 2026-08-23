# Zoning Density Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every zone a density tier, order and label it, and make each (family, tier) pair its own tab in the lens category strip.

**Architecture:** One pure classifier in `FindIt/Domain/` owns the tier rules and is unit-tested against real probe data. `IndexZones` runs it once per zone into a cache; `ZonePrefabCategoryProcessor` reads that cache when it builds each zone's `PrefabIndex`, which is what puts the tier on the catalog entries the menu renders. An explicit rank table replaces the raw enum value on both sides of the C#/TS boundary. The category strip then substitutes a family's tier tabs for the family itself, the way it already substitutes school tiers for the Education category.

**Tech Stack:** C# net48 (mod) + net10.0 xUnit (tests); TypeScript/React 18 in Coherent Gameface (Cohtml 1.64.0.7); SCSS modules; `just` recipes for build/test/deploy.

**Spec:** `docs/superpowers/specs/2026-08-23-zoning-density-subgrouping-design.md`

**Probe data:** `docs/superpowers/specs/2026-08-23-zone-density-probe-data.txt` — 88 real zones with the fields the classifier reads. Build test fixtures from these values, not invented ones.

## Global Constraints

- Tier order is exactly: `Low, Row, Medium, Mixed, LowRent, High`. Decided by the user; do not reorder.
- `ZoneTypeFilter` members keep their existing values. New members are additive: `Mixed = 32`, `LowRent = 64`.
- Building-side zone classification is out of scope. `_zoneTypeCache` and `ZonedBuildingPrefabCategoryProcessor` behaviour must not change; buildings never receive `Mixed` or `LowRent`.
- Chrome uses vanilla, content is ours. Headings and tooltips use the game's own words.
- No `var(--name, fallback)` in SCSS — Cohtml drops the declaration.
- `gap` does nothing in Cohtml; use `> * + *` sibling margins.
- Every new guard test must be confirmed to **fail** against the pre-change code before it is trusted. Two guards in this repo have passed on the bug they named.
- Run `just build findit-building-menu` before any deploy; an SCSS-only change otherwise ships the old bundle.
- Never deploy into a running game — stop it first.

---

### Task 1: Tier vocabulary and rank table

**Files:**
- Modify: `FindIt/Domain/Enums/ZoneTypeFilter.cs`
- Modify: `FindIt/Domain/BuildingCatalogGrouping.cs:117`
- Test: `FindItBuildingMenu.Tests/BuildingCatalogGroupingTests.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: `ZoneTypeFilter.Mixed`, `ZoneTypeFilter.LowRent`; `BuildingCatalogGrouping.DensityRank(ZoneTypeFilter) -> string`; `BuildingCatalogGrouping.DensityOrder` (the ordered array).

- [ ] **Step 1: Write the failing test**

Add to `FindItBuildingMenu.Tests/BuildingCatalogGroupingTests.cs`:

```csharp
[Fact]
public void RanksDensityByTheDecidedOrderRatherThanTheEnumValue()
{
    // Low, Row, Medium, Mixed, LowRent, High — the order the player meets
    // them in. The enum values are 1, 2, 4, 32, 64, 8, so ranking by the
    // raw number would put Mixed and LowRent after High.
    var ranked = new[]
    {
        ZoneTypeFilter.Low,
        ZoneTypeFilter.Row,
        ZoneTypeFilter.Medium,
        ZoneTypeFilter.Mixed,
        ZoneTypeFilter.LowRent,
        ZoneTypeFilter.High,
    }.Select(BuildingCatalogGrouping.DensityRank).ToArray();

    Assert.Equal(ranked.OrderBy(rank => rank, StringComparer.Ordinal).ToArray(), ranked);
}

[Fact]
public void SortsUntieredZonesAfterEveryRankedTier()
{
    Assert.True(
        string.CompareOrdinal(
            BuildingCatalogGrouping.DensityRank(ZoneTypeFilter.High),
            BuildingCatalogGrouping.DensityRank(ZoneTypeFilter.Any)) < 0);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `just test-backend-one findit-building-menu`
Expected: FAIL — `ZoneTypeFilter` does not contain `Mixed`, and `DensityRank` does not exist.

- [ ] **Step 3: Add the two members**

In `FindIt/Domain/Enums/ZoneTypeFilter.cs`:

```csharp
namespace FindItBuildingMenu.Domain.Enums
{
	public enum ZoneTypeFilter
	{
		Any = 0,
		Low = 1,
		Row = 2,
		Medium = 4,
		High = 8,
		Signature = 16,

		/// <summary>Residential over commerce — the game's "Mixed Housing".</summary>
		/// <remarks>
		/// Additive, and deliberately not slotted between Medium and High
		/// despite reading there: the existing values are load-bearing for
		/// anything that persisted one, and the reading order is stated by
		/// BuildingCatalogGrouping.DensityOrder instead.
		/// </remarks>
		Mixed = 32,

		/// <summary>The game's "Low Rent Housing", which is HIGH density.</summary>
		/// <remarks>
		/// The name invites the opposite reading and the name-stem table used
		/// to take it: "LowRent" contains "Low". Measured, these zones pack
		/// four residential properties into one unit of space where high
		/// density gets two.
		/// </remarks>
		LowRent = 64,
	}
}
```

- [ ] **Step 4: Add the rank table**

In `FindIt/Domain/BuildingCatalogGrouping.cs`, beside `CostBands`:

```csharp
		/// <summary>Density tiers in reading order. Mirrored in buildingGroups.ts.</summary>
		/// <remarks>
		/// An explicit table, because the enum's own values do not encode this
		/// order and never did — Low=1, Row=2, Medium=4, High=8 happened to
		/// sort correctly, which hid the fact that the rank was accidental.
		/// Mixed=32 and LowRent=64 read between Medium and High but sort after
		/// Signature, so the accident stops working the moment the vocabulary
		/// grows.
		///
		/// Row before Medium because row housing unlocks at milestone 1 and
		/// medium at 2. LowRent immediately before High because it IS high
		/// density.
		/// </remarks>
		public static readonly ZoneTypeFilter[] DensityOrder =
		{
			ZoneTypeFilter.Low,
			ZoneTypeFilter.Row,
			ZoneTypeFilter.Medium,
			ZoneTypeFilter.Mixed,
			ZoneTypeFilter.LowRent,
			ZoneTypeFilter.High,
			ZoneTypeFilter.Signature,
		};

		/// <summary>The sort key for one tier. Untiered sorts last.</summary>
		public static string DensityRank(ZoneTypeFilter density)
		{
			var index = Array.IndexOf(DensityOrder, density);

			return index < 0 ? UnrankedKey : index.ToString(CultureInfo.InvariantCulture);
		}
```

- [ ] **Step 5: Point PrimaryKey at the table**

In `FindIt/Domain/BuildingCatalogGrouping.cs`, replace the Density branch of `PrimaryKey`:

```csharp
			if (Is(dimension, Density)) return DensityRank(entry.ZoneType);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `just test-backend-one findit-building-menu`
Expected: PASS, and every pre-existing test still green.

- [ ] **Step 7: Commit**

```bash
git add FindIt/Domain/Enums/ZoneTypeFilter.cs FindIt/Domain/BuildingCatalogGrouping.cs FindItBuildingMenu.Tests/BuildingCatalogGroupingTests.cs
git commit -m "feat(findit): density tiers get a stated order instead of an accidental one"
```

---

### Task 2: The zone density classifier

**Files:**
- Create: `FindIt/Domain/ZoneDensityClassifier.cs`
- Test: `FindItBuildingMenu.Tests/ZoneDensityClassifierTests.cs`

**Interfaces:**
- Consumes: `ZoneTypeFilter` from Task 1.
- Produces: `ZoneDensityClassifier.Classify(ZoneDensityFacts facts) -> ZoneTypeFilter` and the record `ZoneDensityFacts(bool IsResidential, float ResidentialProperties, float SpaceMultiplier, bool ScaleResidentials, bool SellsGoods, int MaxLotWidth, string PrefabName)`.

- [ ] **Step 1: Write the failing tests**

Create `FindItBuildingMenu.Tests/ZoneDensityClassifierTests.cs`. Every fixture below is a real zone from `docs/superpowers/specs/2026-08-23-zone-density-probe-data.txt`.

```csharp
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	public class ZoneDensityClassifierTests
	{
		private static ZoneDensityFacts Residential(
			float properties, float space, bool scale, bool sells, int maxLotWidth, string name) =>
			new(true, properties, space, scale, sells, maxLotWidth, name);

		[Fact]
		public void ReadsMixedFromTheCommerceItAllows_NotFromItsName()
		{
			// EU Residential Mixed: sells goods, so it is mixed use whatever
			// the ratio says. All thirteen mixed zones carry m_AllowedSold and
			// nothing else does.
			Assert.Equal(
				ZoneTypeFilter.Mixed,
				ZoneDensityClassifier.Classify(
					Residential(2f, 2.667f, true, sells: true, 5, "EU Residential Mixed")));
		}

		[Fact]
		public void DoesNotCallATownhouseMixedJustBecauseOfItsName()
		{
			// UK London Townhouse sells nothing and is a plain high-density
			// zone. A name test for "townhouse" pulls it into Mixed; the data
			// does not.
			Assert.Equal(
				ZoneTypeFilter.High,
				ZoneDensityClassifier.Classify(
					Residential(0.5f, 0.2f, true, sells: false, 3, "UK London Townhouse")));
		}

		[Fact]
		public void ReadsLowRentFromItsDensityRatio()
		{
			// CN Residential LowRent: four properties per unit of space. The
			// densest thing in the game; the ratio derivation alone calls it
			// High, which loses the distinction the player navigates by.
			Assert.Equal(
				ZoneTypeFilter.LowRent,
				ZoneDensityClassifier.Classify(
					Residential(4f, 1f, true, sells: false, 6, "CN Residential LowRent")));
		}

		[Fact]
		public void DoesNotCallAnUnscaledZoneLowRentAtTheSameRatio()
		{
			// UK Residential Low Terraced sits at ratio 3.0 with
			// m_ScaleResidentials FALSE. Without that guard the low-rent test
			// captures it and a low-density terrace is filed as high-density
			// affordable housing.
			Assert.Equal(
				ZoneTypeFilter.Low,
				ZoneDensityClassifier.Classify(
					Residential(3f, 1f, scale: false, sells: false, 3, "UK Residential Low Terraced")));
		}

		[Theory]
		// name, properties, space, scale, maxLotWidth, expected
		[InlineData("CN Residential Low", 1f, 1f, false, 4, ZoneTypeFilter.Low)]
		[InlineData("EU Residential Medium Row", 0.5f, 1f, true, 2, ZoneTypeFilter.Row)]
		[InlineData("CN Residential Medium", 0.75f, 1f, true, 4, ZoneTypeFilter.Medium)]
		[InlineData("CN Residential High", 6f, 3f, true, 6, ZoneTypeFilter.High)]
		public void KeepsTheExistingFourTiers(
			string name, float properties, float space, bool scale, int maxLotWidth, ZoneTypeFilter expected)
		{
			Assert.Equal(
				expected,
				ZoneDensityClassifier.Classify(Residential(properties, space, scale, false, maxLotWidth, name)));
		}

		[Theory]
		[InlineData("EU Commercial High", ZoneTypeFilter.High)]
		[InlineData("EE Commercial Low", ZoneTypeFilter.Low)]
		[InlineData("Office Low", ZoneTypeFilter.Low)]
		[InlineData("CN Office High", ZoneTypeFilter.High)]
		public void FallsBackToTheNameForZonesWithNoResidents(string name, ZoneTypeFilter expected)
		{
			// m_ResidentialProperties is 0 for commercial and office, so the
			// ratio derivation cannot speak for them at all.
			Assert.Equal(
				expected,
				ZoneDensityClassifier.Classify(new ZoneDensityFacts(false, 0f, 30f, false, true, 6, name)));
		}

		[Fact]
		public void LeavesIndustrialUntiered()
		{
			Assert.Equal(
				ZoneTypeFilter.Any,
				ZoneDensityClassifier.Classify(
					new ZoneDensityFacts(false, 0f, 1f, false, false, 6, "Industrial Manufacturing")));
		}

		[Fact]
		public void DoesNotLetTheLowStemCaptureLowRentInTheNameFallback()
		{
			// The stem table is Row, Low, Medium, High in that order, so
			// "LowRent" matched "Low". Only reachable for a zone with no
			// usable residential data, but the ordering has to be right.
			Assert.Equal(
				ZoneTypeFilter.LowRent,
				ZoneDensityClassifier.Classify(
					new ZoneDensityFacts(false, 0f, 1f, false, false, 6, "XX Residential LowRent")));
		}
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `just test-backend-one findit-building-menu`
Expected: FAIL — `ZoneDensityClassifier` does not exist.

- [ ] **Step 3: Write the classifier**

Create `FindIt/Domain/ZoneDensityClassifier.cs`:

```csharp
using FindItBuildingMenu.Domain.Enums;

using System;

namespace FindItBuildingMenu.Domain
{
	/// <summary>What a zone's own data says about its density tier.</summary>
	/// <remarks>
	/// Primitive fields rather than the ECS components they come from, so the
	/// rules can be tested without a world. Every field is read from
	/// ZonePropertiesData except MaxLotWidth, which comes from the widest
	/// building the zone can actually grow.
	/// </remarks>
	public sealed record ZoneDensityFacts(
		bool IsResidential,
		float ResidentialProperties,
		float SpaceMultiplier,
		bool ScaleResidentials,
		bool SellsGoods,
		int MaxLotWidth,
		string PrefabName);

	/// <summary>
	/// The density tier a zone belongs to, from the game's own data.
	/// </summary>
	/// <remarks>
	/// Probed against all 88 shipped zones on 2026-08-23; the raw output is in
	/// docs/superpowers/specs/2026-08-23-zone-density-probe-data.txt and the
	/// reasoning is in the design beside it. Two things that look like signals
	/// and are not: ZonePropertiesData.m_IgnoreLandValue is false on every
	/// zone in the game, and ZoneFlags has no low-rent bit.
	///
	/// Order matters in both tests below. Mixed leads because a mixed zone
	/// also has a ratio and would otherwise be filed by it. Low Rent must beat
	/// the ratio derivation, which calls all five of those zones High.
	/// </remarks>
	public static class ZoneDensityClassifier
	{
		/// <summary>
		/// Residential properties per unit of space, above which a zone is low
		/// rent rather than merely high density.
		/// </summary>
		/// <remarks>
		/// The measured ratios are discrete — 0.5 row, 0.75 medium, 2.0 high,
		/// 2.5 high, 4.0 low rent — so this sits in the middle of a real gap
		/// rather than on a boundary. It is the mechanic, not a coincidence:
		/// low rent packs four properties into the space high density gives
		/// two.
		/// </remarks>
		private const float LowRentRatio = 3f;

		/// <summary>
		/// Name stems, longest-qualified first.
		/// </summary>
		/// <remarks>
		/// LowRent before Low and Mixed before Medium, because these are
		/// substring tests: "LowRent" contains "Low" and the old table put Low
		/// first, so every low-rent zone read as low density. Row leads for the
		/// same reason against Medium — "Medium Row" is row housing.
		/// </remarks>
		private static readonly (string Stem, ZoneTypeFilter Density)[] NameStems =
		{
			("LowRent", ZoneTypeFilter.LowRent),
			("Low Rent", ZoneTypeFilter.LowRent),
			("Mixed", ZoneTypeFilter.Mixed),
			("Row", ZoneTypeFilter.Row),
			("Low", ZoneTypeFilter.Low),
			("Medium", ZoneTypeFilter.Medium),
			("High", ZoneTypeFilter.High),
		};

		public static ZoneTypeFilter Classify(ZoneDensityFacts facts)
		{
			if (facts is null)
			{
				throw new ArgumentNullException(nameof(facts));
			}

			if (facts.IsResidential && facts.ResidentialProperties > 0f && facts.SpaceMultiplier > 0f)
			{
				// Residential AND selling goods is the game's mixed-use zone.
				// Exact across all thirteen of them, with no false positives.
				if (facts.SellsGoods)
				{
					return ZoneTypeFilter.Mixed;
				}

				var ratio = facts.ResidentialProperties / facts.SpaceMultiplier;

				// The scale guard comes first, exactly as the existing
				// derivation orders it. Without it, UK Residential Low
				// Terraced (ratio 3.0, unscaled) is filed as low rent.
				if (!facts.ScaleResidentials)
				{
					return ZoneTypeFilter.Low;
				}

				if (ratio >= LowRentRatio)
				{
					return ZoneTypeFilter.LowRent;
				}

				if (ratio < 1f)
				{
					// "No spawnable building wider than 2" is exactly "the
					// widest is at most 2". A zone with none at all stays row.
					return facts.MaxLotWidth <= 2 ? ZoneTypeFilter.Row : ZoneTypeFilter.Medium;
				}

				return ZoneTypeFilter.High;
			}

			return FromName(facts.PrefabName);
		}

		/// <summary>The tier a zone's name carries, or Any for none.</summary>
		/// <remarks>
		/// The only source for commercial and office, whose
		/// m_ResidentialProperties is zero, so the ratio derivation is silent
		/// for them. Industrial and extractor zones carry no tier word and
		/// correctly come back Any.
		/// </remarks>
		public static ZoneTypeFilter FromName(string? prefabName)
		{
			if (string.IsNullOrWhiteSpace(prefabName))
			{
				return ZoneTypeFilter.Any;
			}

			foreach (var (stem, density) in NameStems)
			{
				if (prefabName!.IndexOf(stem, StringComparison.OrdinalIgnoreCase) >= 0)
				{
					return density;
				}
			}

			return ZoneTypeFilter.Any;
		}
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `just test-backend-one findit-building-menu`
Expected: PASS, all nine.

- [ ] **Step 5: Prove the scale guard is load-bearing**

Temporarily delete the `if (!facts.ScaleResidentials)` block, re-run, and confirm `DoesNotCallAnUnscaledZoneLowRentAtTheSameRatio` FAILS. Restore the block. This is the step that stops the guard from being decorative — a green test proves nothing until it has been seen to fail.

- [ ] **Step 6: Commit**

```bash
git add FindIt/Domain/ZoneDensityClassifier.cs FindItBuildingMenu.Tests/ZoneDensityClassifierTests.cs
git commit -m "feat(findit): a zone's density tier, read from its own data"
```

---

### Task 3: Put the tier on the zone entries the menu renders

**Files:**
- Modify: `FindIt/Systems/PrefabIndexingSystem.cs` (the `IndexZones` derivation, ~2446-2480, and the `ZoneCatalogEntry` construction, ~2526)
- Modify: `FindIt/Utilities/PrefabCategoryProcessor/ZonePrefabCategoryProcessor.cs`
- Test: `FindItBuildingMenu.Tests/ZoneDensityClassifierTests.cs` (extend)

**Interfaces:**
- Consumes: `ZoneDensityClassifier.Classify` from Task 2.
- Produces: `PrefabIndexingSystem.GetZoneDensity(Entity zonePrefab) -> ZoneTypeFilter`, and zone `PrefabIndex` entries whose `ZoneType` is no longer always `Any`.

**Why a second cache:** `_zoneTypeCache` feeds `ZonedBuildingPrefabCategoryProcessor`, which classifies BUILDINGS by the zone they spawn in. Widening it would start splitting commercial buildings by density, which is out of scope. Zones get their own cache; buildings keep theirs unchanged.

- [ ] **Step 1: Add the zone density cache beside the existing one**

In `FindIt/Systems/PrefabIndexingSystem.cs`, beside `_zoneTypeCache` (line ~44):

```csharp
		/// <summary>
		/// Density per ZONE prefab, which is not the same question
		/// <see cref="_zoneTypeCache"/> answers.
		/// </summary>
		/// <remarks>
		/// That one classifies a zone so its BUILDINGS can be filtered by the
		/// zone they grow in, and it deliberately knows only Low/Row/Medium/
		/// High. This one is the zone's own tier and adds Mixed and LowRent,
		/// which no building should ever receive. Kept apart so widening the
		/// zone vocabulary cannot silently reclassify 3,000 buildings.
		/// </remarks>
		private static Dictionary<Entity, ZoneTypeFilter> _zoneDensityCache;
```

- [ ] **Step 2: Fill it in the same loop**

In `IndexZones`, inside the existing `for` loop that builds `dictionary`, after the existing classification assigns `dictionary[zone]`, add a second dictionary populated from the classifier. Replace the whole loop body with:

```csharp
			var dictionary = new Dictionary<Entity, ZoneTypeFilter>();
			var densities = new Dictionary<Entity, ZoneTypeFilter>();

			for (var i = 0; i < zones.Length; i++)
			{
				var zone = zones[i];
				var info = propertiesData[i];
				var maxLotWidth = lotSizes.TryGetValue(zone, out var zoneSizes) ? zoneSizes.MaxWidth : 0;

				// The building-side answer, unchanged: four tiers, and Any for
				// anything with no residents. See _zoneTypeCache.
				if (info.m_ResidentialProperties <= 0f)
				{
					dictionary[zone] = ZoneTypeFilter.Any;
				}
				else if (!info.m_ScaleResidentials)
				{
					dictionary[zone] = ZoneTypeFilter.Low;
				}
				else if (info.m_ResidentialProperties / info.m_SpaceMultiplier < 1f)
				{
					dictionary[zone] = maxLotWidth <= 2 ? ZoneTypeFilter.Row : ZoneTypeFilter.Medium;
				}
				else
				{
					dictionary[zone] = ZoneTypeFilter.High;
				}

				// The zone's own answer, which is the one the menu navigates
				// by. Six tiers, from the same fields plus the two the four-
				// tier derivation cannot express.
				densities[zone] = ZoneDensityClassifier.Classify(new ZoneDensityFacts(
					IsResidential: info.m_ResidentialProperties > 0f,
					ResidentialProperties: info.m_ResidentialProperties,
					SpaceMultiplier: info.m_SpaceMultiplier,
					ScaleResidentials: info.m_ScaleResidentials,
					SellsGoods: propertiesData[i].m_AllowedSold != default,
					MaxLotWidth: maxLotWidth,
					PrefabName: _prefabSystem.TryGetPrefab<PrefabBase>(zone, out var densityPrefab)
						? densityPrefab?.name ?? string.Empty
						: string.Empty));
			}

			_zoneTypeCache = dictionary;
			_zoneDensityCache = densities;
```

- [ ] **Step 3: Add the accessor**

Beside `GetZoneType` (~line 3052):

```csharp
		/// <summary>The zone's own density tier. Any when it has none.</summary>
		/// <remarks>
		/// Fails soft like GetZoneType, and for the same reason: the cache is
		/// built in IndexZones, which runs at :401 — before the prefab
		/// category processors start at :408 — so a cold read here means the
		/// indexing order changed, not that the zone is untiered.
		/// </remarks>
		public static ZoneTypeFilter GetZoneDensity(Entity zonePrefab)
		{
			if (_zoneDensityCache != null && _zoneDensityCache.TryGetValue(zonePrefab, out var density))
			{
				return density;
			}

			return ZoneTypeFilter.Any;
		}
```

- [ ] **Step 4: Use the classifier for the zone catalog too**

In the `catalog.Add(new ZoneCatalogEntry(` block, replace the `Density:` argument with the shared answer, so the catalog and the index cannot disagree:

```csharp
					Density: GetZoneDensity(zone),
```

- [ ] **Step 5: Set ZoneType on the zone's PrefabIndex**

In `FindIt/Utilities/PrefabCategoryProcessor/ZonePrefabCategoryProcessor.cs`:

```csharp
			prefabIndex = new PrefabIndex(prefab)
			{
				Category = Domain.Enums.PrefabCategory.Zones,
				SubCategory = ResolveSubCategory(entity),
				// The one line that makes the tier reach the menu. Without it
				// every zone entry shipped ZoneType = Any, which is why the
				// Density grouping was filtered out of the picker entirely —
				// a dimension whose entries all share one value is dropped as
				// useless, and it was.
				ZoneType = PrefabIndexingSystem.GetZoneDensity(entity),
			};
```

- [ ] **Step 6: Build and run the whole backend suite**

Run: `just build findit-building-menu && just test-backend-one findit-building-menu`
Expected: build clean, all tests pass. `BuildingCatalogZoneFilterTests` in particular must still pass — it covers the building-side path this task must not disturb.

- [ ] **Step 7: Commit**

```bash
git add FindIt/Systems/PrefabIndexingSystem.cs FindIt/Utilities/PrefabCategoryProcessor/ZonePrefabCategoryProcessor.cs
git commit -m "feat(findit): zones carry their own density tier"
```

---

### Task 4: Density headings that read as words

**Files:**
- Modify: `FindIt/UI/src/domain/buildingGroups.ts` (the `density` case, ~539-544)
- Test: `FindIt/UI/test/buildingGroups.test.ts`

**Interfaces:**
- Consumes: the numeric `zoneType` values from Task 1's enum.
- Produces: `DENSITY_TIERS` (ordered `{ value, key, label }` records) and `densityTierLabel(value: number | string | null | undefined): string`.

**Why:** today this branch emits `String(entry.zoneType)`, so the Density grouping's headings read `"0"`, `"1"`, `"2"`, `"4"`, `"8"`. It has never been seen because the dimension was always filtered out.

- [ ] **Step 1: Write the failing test**

Add to `FindIt/UI/test/buildingGroups.test.ts`:

```ts
describe("Density tiers", () => {
  it("names each tier rather than printing its enum value", () => {
    assert.equal(densityTierLabel(1), "Low Density");
    assert.equal(densityTierLabel(2), "Row Housing");
    assert.equal(densityTierLabel(4), "Medium Density");
    assert.equal(densityTierLabel(32), "Mixed Housing");
    assert.equal(densityTierLabel(64), "Low Rent Housing");
    assert.equal(densityTierLabel(8), "High Density");
  });

  it("orders them the way the player meets them", () => {
    // Mirrors BuildingCatalogGrouping.DensityOrder. The enum values are
    // 1, 2, 4, 32, 64, 8 — deliberately not ascending.
    assert.deepEqual(
      DENSITY_TIERS.map((tier) => tier.value),
      [1, 2, 4, 32, 64, 8, 16]
    );
  });

  it("falls back to the ungrouped label for an untiered zone", () => {
    assert.equal(densityTierLabel(0), UNGROUPED_LABEL);
    assert.equal(densityTierLabel(null), UNGROUPED_LABEL);
    assert.equal(densityTierLabel(999), UNGROUPED_LABEL);
  });

  it("groups zones by tier name", () => {
    const rows = [
      { id: 1, name: "EU Residential Low", zoneType: 1 },
      { id: 2, name: "EU Residential Mixed", zoneType: 32 },
    ] as never[];

    assert.deepEqual(
      buildGroupedView(rows, "density").map((node) => node.label),
      ["Low Density", "Mixed Housing"]
    );
  });
});
```

Import `DENSITY_TIERS`, `densityTierLabel` and `UNGROUPED_LABEL` alongside the existing imports at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `just test-frontend-one findit-building-menu`
Expected: FAIL — `densityTierLabel` is not exported.

- [ ] **Step 3: Add the table and the label**

In `FindIt/UI/src/domain/buildingGroups.ts`:

```ts
/**
 * Density tiers, in the order the player meets them.
 *
 * Mirrors `BuildingCatalogGrouping.DensityOrder`. There is no shared source
 * across the boundary — the same arrangement the cost and footprint bands
 * have — so drift is caught by the two suites rather than prevented.
 *
 * The values are ZoneTypeFilter's, which are NOT in reading order: Mixed is
 * 32 and LowRent 64, both of which read between Medium and High. Row precedes
 * Medium because row housing unlocks a milestone earlier; LowRent sits just
 * before High because it IS high density, whatever its name suggests.
 *
 * The labels are the game's own words, taken off the zone names it ships:
 * "Low Density Housing", "Medium Density Row Housing", "Mixed Housing",
 * "Low Rent Housing". Trimmed of "Housing" where the tier applies to
 * commercial and office zones too.
 */
export const DENSITY_TIERS: readonly { value: number; key: string; label: string }[] = [
  { value: 1, key: "Low", label: "Low Density" },
  { value: 2, key: "Row", label: "Row Housing" },
  { value: 4, key: "Medium", label: "Medium Density" },
  { value: 32, key: "Mixed", label: "Mixed Housing" },
  { value: 64, key: "LowRent", label: "Low Rent Housing" },
  { value: 8, key: "High", label: "High Density" },
  { value: 16, key: "Signature", label: "Signature" },
];

/** The heading for one tier, or the ungrouped label when there is none. */
export function densityTierLabel(value: number | string | null | undefined): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  const tier = DENSITY_TIERS.find((candidate) => candidate.value === numeric);

  return tier?.label ?? UNGROUPED_LABEL;
}
```

- [ ] **Step 4: Point the density case at it**

Replace the `density` branch of `groupLevelsFor`:

```ts
    case "density":
      // Was String(entry.zoneType), which drew headings reading "0", "1",
      // "4". Never seen, because the dimension is dropped from the picker
      // whenever its entries share one value — and until zones carried a
      // tier, they always did.
      return [densityTierLabel(entry.zoneType)];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `just test-frontend-one findit-building-menu`
Expected: PASS. All 594 pre-existing tests still green.

- [ ] **Step 6: Assert the mirror from the C# side**

The tier words are written twice — `DENSITY_TIERS` here and
`BuildingCatalogLabels.DensityTier` in Task 7 — with no shared source, exactly
like the cost and footprint bands. Add to
`FindItBuildingMenu.Tests/BuildingCatalogGroupingTests.cs`:

```csharp
[Fact]
public void TierLabelsAndOrderAgreeWithTheUiCopyOfThem()
{
    // Read from buildingGroups.ts rather than restated, because a test that
    // restates both sides passes when both are wrong together.
    var source = File.ReadAllText(Path.Combine(
        RepoRoot(), "FindIt", "UI", "src", "domain", "buildingGroups.ts"));

    var table = Regex.Match(source, @"DENSITY_TIERS[^=]*=\s*\[(?<body>.*?)\];", RegexOptions.Singleline);
    Assert.True(table.Success, "DENSITY_TIERS not found in buildingGroups.ts");

    var ui = Regex.Matches(table.Groups["body"].Value, @"value:\s*(?<value>\d+),\s*key:\s*""[^""]*"",\s*label:\s*""(?<label>[^""]*)""")
        .Cast<Match>()
        .Select(match => (Value: int.Parse(match.Groups["value"].Value), Label: match.Groups["label"].Value))
        .ToArray();

    Assert.Equal(
        BuildingCatalogGrouping.DensityOrder.Select(tier => ((int)tier, BuildingCatalogLabels.DensityTier(tier))).ToArray(),
        ui);
}
```

This is the guard that would have caught the original bug: the raw enum value
was the C# rank and the TS side had no rank at all, so the two could not have
been compared even in principle.

- [ ] **Step 7: Run it and confirm it fails on a deliberate mismatch**

Change one label in `DENSITY_TIERS` to "Low", run
`just test-backend-one findit-building-menu`, confirm FAIL, then restore it.
A green mirror test that has never been seen red is not a mirror.

- [ ] **Step 8: Commit**

```bash
git add FindIt/UI/src/domain/buildingGroups.ts FindIt/UI/test/buildingGroups.test.ts FindItBuildingMenu.Tests/BuildingCatalogGroupingTests.cs
git commit -m "fix(findit): density headings say the tier instead of its enum value"
```

**Ordering note:** this step depends on `BuildingCatalogLabels.DensityTier`
from Task 7 Step 4a. If executing strictly in order, add that method here in
Task 4 instead and drop it from Task 7.

---

### Task 5: Locale keys and tier icons

**Files:**
- Modify: `FindIt/Locale.json`
- Modify: `FindIt/Domain/Options/ZoneTypeOption.cs`
- Create: `FindIt/Resources/Images/Icons/Standard/MixedLevel.svg`
- Create: `FindIt/Resources/Images/Icons/Standard/LowRentLevel.svg`
- Test: `FindItBuildingMenu.Tests/GameLocaleKeyTests.cs`

**Interfaces:**
- Consumes: `ZoneTypeFilter.Mixed`, `ZoneTypeFilter.LowRent`.
- Produces: `Tooltip.LABEL[FindItBuildingMenu.ZoneMixed]`, `Tooltip.LABEL[FindItBuildingMenu.ZoneLowRent]`, and icon paths for both.

**Why the icons matter:** `ZoneTypeOption` projects its chips from `_styles`, **not** from the enum, so a member with no dictionary entry is silently invisible — no crash, no placeholder, the chip simply never appears.

- [ ] **Step 1: Write the failing test**

Add to `FindItBuildingMenu.Tests/GameLocaleKeyTests.cs`:

```csharp
[Fact]
public void NamesEveryZoneTypeTheOptionsRowCanShow()
{
    // The chips are projected from a hand-built dictionary rather than from
    // the enum, so a member missing an entry does not fail loudly — it just
    // never draws. Assert against the enum so that cannot happen quietly.
    var locale = LoadLocale();

    foreach (ZoneTypeFilter density in Enum.GetValues(typeof(ZoneTypeFilter)))
    {
        if (density == ZoneTypeFilter.Any)
        {
            continue;
        }

        Assert.True(
            locale.ContainsKey($"Tooltip.LABEL[FindItBuildingMenu.Zone{density}]"),
            $"no tooltip for ZoneTypeFilter.{density}");
    }
}
```

Use whatever `LoadLocale()` helper the file already has; if it has none, read `FindIt/Locale.json` with the same JSON approach the surrounding tests use.

- [ ] **Step 2: Run the test to verify it fails**

Run: `just test-backend-one findit-building-menu`
Expected: FAIL — "no tooltip for ZoneTypeFilter.Mixed".

- [ ] **Step 3: Add the two keys**

In `FindIt/Locale.json`, beside the existing `ZoneLow`/`ZoneRow`/`ZoneMedium`/`ZoneHigh` entries:

```json
  "Tooltip.LABEL[FindItBuildingMenu.ZoneMixed]": "\"Mixed\" Buildings",
  "Tooltip.LABEL[FindItBuildingMenu.ZoneLowRent]": "\"Low Rent\" Buildings",
```

- [ ] **Step 4: Draw the two icons**

The existing set is `LowLevel.svg`, `MediumLevel.svg`, `HighLevel.svg`, `Row.svg`. Open `MediumLevel.svg` first and match its viewBox, stroke width and fill convention exactly — these sit in one row and a mismatched weight is obvious.

`MixedLevel.svg`: a medium-height block with a distinct ground floor band, which is what mixed use is — shops under flats.
`LowRentLevel.svg`: a high block, matching `HighLevel.svg`'s silhouette, subdivided into more, smaller windows — the four-properties-per-unit-of-space this tier is.

Keep both single-path where the others are single-path. **Do not** add a `filter`, `mask` or `opacity` to either: Cohtml cannot composite over a vector and they will flicker or vanish.

- [ ] **Step 5: Register them**

In `FindIt/Domain/Options/ZoneTypeOption.cs`:

```csharp
				[ZoneTypeFilter.Mixed] = "coui://finditbuildingmenu/Icons/Standard/MixedLevel.svg",
				[ZoneTypeFilter.LowRent] = "coui://finditbuildingmenu/Icons/Standard/LowRentLevel.svg",
```

Place them between `Medium` and `High` so the row draws in reading order.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `just test-backend-one findit-building-menu`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add FindIt/Locale.json FindIt/Domain/Options/ZoneTypeOption.cs FindIt/Resources/Images/Icons/Standard/MixedLevel.svg FindIt/Resources/Images/Icons/Standard/LowRentLevel.svg FindItBuildingMenu.Tests/GameLocaleKeyTests.cs
git commit -m "feat(findit): the two new tiers get words and icons"
```

---

### Task 6: Checkpoint — verify density grouping in game

**Files:** none.

This is the first point at which the feature is visible, and it is worth stopping here: Tasks 1-5 are shippable on their own, and Tasks 7-9 build on a foundation that has to be right.

- [ ] **Step 1: Stop any running game, then deploy**

```bash
just cs2-status
# only if a game of YOURS is running:
just game-stop <your-agent-id> <pid>
just build findit-building-menu && just deploy findit-building-menu 949230-c
```

Never deploy into a running game — writing the DLL under it kills it.

- [ ] **Step 2: Launch and load a city with content packs**

```bash
just launch-cs2 <your-agent-id> --no-steam --prefix 949230-c --cdp-port 9666 --check-menu
just game-adopt <your-agent-id> <pid>
```

Then load a save. Indexing runs on game load, not at the main menu.

- [ ] **Step 3: Confirm the tier reached the entries**

Open the Zones menu and check three things, which fail together if Task 3 did not take:
1. **Density is offered** in the Group-by picker. It is dropped whenever every sampled entry shares a value, so its mere presence proves the tier varies.
2. Grouping by Density gives headings reading `Low Density`, `Row Housing`, `Medium Density`, `Mixed Housing`, `Low Rent Housing`, `High Density` — in that order, not `"0"`/`"1"`/`"4"`.
3. The counts match the probe: Residential 22/7/11/13/5/9, Commercial 7/3, Office 2/4.

- [ ] **Step 4: Confirm nothing else moved**

Open the Signatures menu. Every entry there carries `zoneType 16`, so Density must still be **absent** from its picker. If it appears, the dimension-relevance filter is not doing its job.

---

### Task 7: Let the strip expand more than one category

**Files:**
- Modify: `FindIt/Services/BuildingCatalogAdapter.cs:285-342` (`GetExpandedCategoryId`, `GetExpandedCategoryTabs`)
- Modify: `FindIt/Systems/FindItUISystem.Methods.cs:181-183`
- Modify: `FindIt/Systems/FindItUISystem.Setup.cs:137-138,299-300`
- Test: `FindItBuildingMenu.Tests/BuildingLensDimensionTests.cs`

**Interfaces:**
- Consumes: zone `ZoneType` from Task 3.
- Produces: binding `BuildingLensExpandedCategories` carrying `MenuCategoryTabs[]`, where `MenuCategoryTabs(string CategoryId, MenuBranchCount[] Tabs)`. Replaces the `BuildingLensExpandedCategory` / `BuildingLensExpandedTabs` pair.

**Why:** `GetExpandedCategoryId` filters on `!string.IsNullOrEmpty(entry.DevTreeBranch)` and ends in `FirstOrDefault` — one category, chosen by size. Zones need three expanded at once (Residential, Commercial, Office), on a different axis.

**Testability note:** the decision goes in a **static** method over entries,
mirroring `BuildingCatalogAdapter.BuildFacetState`, which is how the existing
adapter tests avoid constructing a live adapter. The instance method just
projects the query and delegates.

- [ ] **Step 1: Write the failing test**

Create `FindItBuildingMenu.Tests/MenuCategoryExpansionTests.cs`. Copy the
`Base` entry record and the `Entry(...)` helper from
`FindItBuildingMenu.Tests/BuildingLensFacetRelevanceTests.cs:1-45` — the same
`Base with { ... }` pattern the other adapter tests use.

```csharp
		private static BuildingCatalogEntry Zone(int id, string category, ZoneTypeFilter density) =>
			Base with
			{
				Id = id,
				PrefabName = $"Zone{id}",
				Name = $"Zone {id}",
				UiMenu = "Zones",
				UiCategory = category,
				ZoneType = density,
			};

		[Fact]
		public void ExpandsEveryFamilyThatHasMoreThanOneTier()
		{
			var entries = new[]
			{
				Zone(1, "ZonesResidential", ZoneTypeFilter.Low),
				Zone(2, "ZonesResidential", ZoneTypeFilter.High),
				Zone(3, "ZonesCommercial", ZoneTypeFilter.Low),
				Zone(4, "ZonesCommercial", ZoneTypeFilter.High),
				Zone(5, "ZonesIndustrial", ZoneTypeFilter.Any),
			};

			var expanded = BuildingCatalogAdapter.BuildExpandedCategories(entries, StripAxes.Density, "Zones");

			Assert.Equal(
				new[] { "ZonesCommercial", "ZonesResidential" },
				expanded.Select(group => group.CategoryId).OrderBy(id => id, StringComparer.Ordinal).ToArray());
		}

		[Fact]
		public void LeavesAFamilyWithOneTierUnexpanded()
		{
			// Industrial is a single untiered zone. Sub-tabs may stand in for
			// a category only when they partition it — a lone tab is a heading
			// that says nothing, which is the rule the school-tier
			// substitution states.
			var entries = new[]
			{
				Zone(1, "ZonesIndustrial", ZoneTypeFilter.Any),
				Zone(2, "ZonesResidential", ZoneTypeFilter.Low),
				Zone(3, "ZonesResidential", ZoneTypeFilter.High),
			};

			Assert.DoesNotContain(
				BuildingCatalogAdapter.BuildExpandedCategories(entries, StripAxes.Density, "Zones"),
				group => group.CategoryId == "ZonesIndustrial");
		}

		[Fact]
		public void OrdersTierTabsByTheDecidedOrderRatherThanByName()
		{
			// Alphabetically this is High, Low, Low Rent, Medium, Mixed, Row —
			// which is meaningless for what is a progression.
			var entries = new[]
			{
				Zone(1, "ZonesResidential", ZoneTypeFilter.High),
				Zone(2, "ZonesResidential", ZoneTypeFilter.Low),
				Zone(3, "ZonesResidential", ZoneTypeFilter.LowRent),
				Zone(4, "ZonesResidential", ZoneTypeFilter.Medium),
				Zone(5, "ZonesResidential", ZoneTypeFilter.Mixed),
				Zone(6, "ZonesResidential", ZoneTypeFilter.Row),
			};

			var tabs = BuildingCatalogAdapter
				.BuildExpandedCategories(entries, StripAxes.Density, "Zones")
				.Single()
				.Tabs;

			Assert.Equal(
				new[] { "Low Density", "Row Housing", "Medium Density", "Mixed Housing", "Low Rent Housing", "High Density" },
				tabs.Select(tab => tab.Id).ToArray());
		}

		[Fact]
		public void StillExpandsExactlyOneCategoryOnTheDevelopmentAxis()
		{
			// The dev tree picks the largest category and stops. Generalising
			// the shape must not generalise that behaviour.
			var entries = new[]
			{
				Base with { Id = 1, UiCategory = "Healthcare", DevTreeBranch = "Health" },
				Base with { Id = 2, UiCategory = "Healthcare", DevTreeBranch = "Deathcare" },
				Base with { Id = 3, UiCategory = "Police", DevTreeBranch = "Patrol" },
				Base with { Id = 4, UiCategory = "Police", DevTreeBranch = "Admin" },
			};

			Assert.Single(BuildingCatalogAdapter.BuildExpandedCategories(entries, StripAxes.Development, ""));
		}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `just test-backend-one findit-building-menu`
Expected: FAIL — `BuildExpandedCategories` does not exist.

- [ ] **Step 3: Add the record**

Create `FindIt/Domain/MenuCategoryTabs.cs`, following `FindIt/Domain/MenuBranchCount.cs` for the `IJsonWritable` shape:

```csharp
	/// <summary>One category's sub-tabs, drawn in its place in the strip.</summary>
	/// <remarks>
	/// A list rather than the single category the dev-tree expansion assumed.
	/// Zones need three families expanded at once, and the dev tree never did
	/// because it picks the largest category and stops.
	/// </remarks>
	public sealed record MenuCategoryTabs(string CategoryId, MenuBranchCount[] Tabs) : IJsonWritable
```

Write both properties in `Write`, mirroring `MenuBranchCount`'s implementation exactly.

- [ ] **Step 4: Generalise the producer**

Replace `GetExpandedCategoryId` and `GetExpandedCategoryTabs` in `BuildingCatalogAdapter` with a static decision and a thin instance wrapper:

```csharp
		/// <summary>Every category whose sub-tabs should stand in for it.</summary>
		/// <remarks>
		/// Two axes today. Development expands the ONE largest category, which
		/// is what the dev tree has always done and must keep doing. Density
		/// expands every zone family that has more than one tier, because
		/// residential, commercial and office all do.
		///
		/// The rule they share is the one the school-tier substitution states:
		/// sub-tabs may replace a category only when they partition it, so a
		/// category whose entries all share one value is left alone. That is
		/// what keeps Industrial and the extractors as plain tabs, and it is
		/// also why no separate suppression is needed for menus where the axis
		/// does not vary at all.
		/// </remarks>
		public static IReadOnlyList<MenuCategoryTabs> BuildExpandedCategories(
			IEnumerable<BuildingCatalogEntry> entries,
			string axis,
			string uiMenu)
		{
			var isDensity = string.Equals(axis, StripAxes.Density, StringComparison.OrdinalIgnoreCase);

			var candidates = entries
				.Where(entry => isDensity || !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, uiMenu) ?? string.Empty)
				.Where(group => group.Key.Length > 0)
				.Select(group => new
				{
					Category = group.Key,
					Tabs = isDensity ? DensityTabs(group) : BranchTabs(group),
				})
				.Where(candidate => candidate.Tabs.Length > 1);

			// Development keeps its "largest category only" behaviour; density
			// takes every family that qualifies.
			var chosen = isDensity
				? candidates.OrderBy(candidate => candidate.Category, StringComparer.Ordinal)
				: candidates
					.OrderByDescending(candidate => candidate.Tabs.Sum(tab => tab.Count))
					.ThenBy(candidate => candidate.Category, StringComparer.Ordinal)
					.Take(1);

			return chosen
				.Select(candidate => new MenuCategoryTabs(candidate.Category, candidate.Tabs))
				.ToArray();
		}

		private static MenuBranchCount[] DensityTabs(IEnumerable<BuildingCatalogEntry> group) =>
			group
				.Where(entry => entry.ZoneType != ZoneTypeFilter.Any)
				.GroupBy(entry => entry.ZoneType)
				.OrderBy(tier => Array.IndexOf(BuildingCatalogGrouping.DensityOrder, tier.Key))
				.Select(tier => new MenuBranchCount(
					BuildingCatalogLabels.DensityTier(tier.Key),
					tier.Count(),
					ZoneTypeOption.IconFor(tier.Key)))
				.ToArray();

		private static MenuBranchCount[] BranchTabs(IEnumerable<BuildingCatalogEntry> group) =>
			group
				.GroupBy(entry => entry.DevTreeBranch!)
				.OrderBy(branch => branch.Min(entry => entry.DevTreeBranchDepth))
				.ThenBy(branch => branch.Key, StringComparer.Ordinal)
				.Select(branch => new MenuBranchCount(
					branch.Key,
					branch.Count(),
					TabIcon(branch, authored: true)))
				.ToArray();

		public IReadOnlyList<MenuCategoryTabs> GetExpandedCategories(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var unscoped = query with { UiCategory = string.Empty, StripTabs = null, SchoolTier = -1 };

			return BuildExpandedCategories(
				BuildingCatalogQueryEngine.InScope(ProjectForMenu(query.UiMenu, unscoped.DlcIds), unscoped),
				GetStripAxis(query),
				query.UiMenu);
		}
```

- [ ] **Step 4a: Add the two small helpers the above needs**

`StripAxes` already holds `Development`; add `Density` beside it with the same
string convention the existing members use.

In `FindIt/Domain/Options/ZoneTypeOption.cs`, expose the icon dictionary so the
adapter does not hold a second copy:

```csharp
		/// <summary>The tier's icon, or empty when it has none.</summary>
		/// <remarks>
		/// Static and public because the category strip needs the same icons
		/// the filter chips use, and two copies of this table is exactly how
		/// the badge and the picture ended up disagreeing elsewhere.
		/// </remarks>
		public static string IconFor(ZoneTypeFilter density) =>
			Icons.TryGetValue(density, out var icon) ? icon : string.Empty;
```

Lift the `_styles` dictionary to a `private static readonly Dictionary<ZoneTypeFilter, string> Icons` initialised inline, and have the instance constructor assign `_styles = Icons`.

In `FindIt/Domain/BuildingCatalogLabels.cs`, add the tier words — the same
strings `DENSITY_TIERS` uses in Task 4, which is the C#/TS mirror for this
feature:

```csharp
		/// <summary>The tier's heading. Mirrored in buildingGroups.ts.</summary>
		public static string DensityTier(ZoneTypeFilter density) => density switch
		{
			ZoneTypeFilter.Low => "Low Density",
			ZoneTypeFilter.Row => "Row Housing",
			ZoneTypeFilter.Medium => "Medium Density",
			ZoneTypeFilter.Mixed => "Mixed Housing",
			ZoneTypeFilter.LowRent => "Low Rent Housing",
			ZoneTypeFilter.High => "High Density",
			ZoneTypeFilter.Signature => "Signature",
			_ => string.Empty,
		};
```

- [ ] **Step 5: Swap the bindings**

In `FindItUISystem.Setup.cs` replace the two fields and their `CreateBinding` calls with one:

```csharp
		private ValueBindingHelper<MenuCategoryTabs[]> _BuildingLensExpandedCategories = null!;
```
```csharp
			_BuildingLensExpandedCategories = CreateBinding("BuildingLensExpandedCategories", Array.Empty<MenuCategoryTabs>());
```

And in `FindItUISystem.Methods.cs`:

```csharp
			_BuildingLensExpandedCategories.Value =
				_buildingCatalogAdapter.GetExpandedCategories(_buildingCatalogQuery).ToArray();
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `just test-backend-one findit-building-menu`
Expected: PASS, including the pre-existing dev-tree expansion tests — the dev tree must keep expanding exactly one category.

- [ ] **Step 7: Commit**

```bash
git add FindIt/Domain/MenuCategoryTabs.cs FindIt/Services/BuildingCatalogAdapter.cs FindIt/Systems/FindItUISystem.Methods.cs FindIt/Systems/FindItUISystem.Setup.cs FindItBuildingMenu.Tests/BuildingLensDimensionTests.cs
git commit -m "feat(findit): the strip can expand more than one category"
```

---

### Task 8: Draw the tier tabs

**Files:**
- Modify: `FindIt/UI/src/mods/MenuCategoryStrip/MenuCategoryStrip.tsx:47-50,87-88,208-254`
- Modify: `FindIt/UI/src/domain/menuProgression.ts`
- Test: `FindIt/UI/test/menuProgression.test.ts`

**Interfaces:**
- Consumes: the `BuildingLensExpandedCategories` binding from Task 7.
- Produces: `expandedTabsFor(categories, categoryId) -> MenuBranchCount[]`.

- [ ] **Step 1: Write the failing test**

Add to `FindIt/UI/test/menuProgression.test.ts`:

```ts
describe("expandedTabsFor", () => {
  const categories = [
    { categoryId: "ZonesResidential", tabs: [{ id: "Low Density", count: 22, icon: "a.svg" }] },
    { categoryId: "ZonesCommercial", tabs: [{ id: "Low Density", count: 7, icon: "a.svg" }] },
  ];

  it("finds a category's own tabs", () => {
    assert.equal(expandedTabsFor(categories, "ZonesCommercial")[0].count, 7);
  });

  it("returns nothing for a category that is not expanded", () => {
    assert.deepEqual(expandedTabsFor(categories, "ZonesIndustrial"), []);
  });

  it("survives a missing binding", () => {
    assert.deepEqual(expandedTabsFor(null, "ZonesResidential"), []);
    assert.deepEqual(expandedTabsFor(undefined, "ZonesResidential"), []);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `just test-frontend-one findit-building-menu`
Expected: FAIL — `expandedTabsFor` is not exported.

- [ ] **Step 3: Add the lookup**

In `FindIt/UI/src/domain/menuProgression.ts`:

```ts
export interface MenuCategoryTabs {
  categoryId: string;
  tabs: MenuBranchCount[];
}

/**
 * The sub-tabs that stand in for one category, or none.
 *
 * A lookup rather than an equality test against a single expanded id, which
 * is what this replaced: the dev tree only ever expanded one category, and
 * zone families need three at once.
 */
export function expandedTabsFor(
  categories: readonly MenuCategoryTabs[] | null | undefined,
  categoryId: string
): MenuBranchCount[] {
  return categories?.find((entry) => entry.categoryId === categoryId)?.tabs ?? [];
}
```

- [ ] **Step 4: Rewire the strip**

In `MenuCategoryStrip.tsx`, replace the two bindings with one:

```ts
const BuildingLensExpandedCategories$ = bindValue<MenuCategoryTabs[]>(
  mod.id,
  "BuildingLensExpandedCategories",
  []
);
```
```ts
  const expandedCategories = useValue(BuildingLensExpandedCategories$) ?? [];
```

Then change the branch condition at ~line 230 from `expandedTabs.length > 1 && category.id === expandedCategory` to a per-category lookup:

```tsx
          : expandedTabsFor(expandedCategories, category.id).length > 1
          ? expandedTabsFor(expandedCategories, category.id).map((branch) => (
```

The tab body below it is unchanged — it already renders `branch.icon || category.icon` with a count and no numeral, which is right here for the same reason it is right for dev-tree branches: each tier ships its own icon, so the tabs are told apart by what they are.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `just test-frontend-one findit-building-menu`
Expected: PASS, all pre-existing tests included.

- [ ] **Step 6: Commit**

```bash
git add FindIt/UI/src/domain/menuProgression.ts FindIt/UI/src/mods/MenuCategoryStrip/MenuCategoryStrip.tsx FindIt/UI/test/menuProgression.test.ts
git commit -m "feat(findit): zone families expand into their density tiers"
```

---

### Task 9: Verify the whole feature in game

**Files:** none.

- [ ] **Step 1: Build, deploy, launch, load a city**

Same sequence as Task 6, Steps 1-2. The game must be stopped before deploy.

- [ ] **Step 2: Check the Zones strip**

Expected, left to right: Residential's six tiers in order (Low Density 22, Row Housing 7, Medium Density 11, Mixed Housing 13, Low Rent Housing 5, High Density 9), Commercial's two (7, 3), Office's two (2, 4), then Industrial and Extractors as plain unexpanded categories.

Each tier tab draws its own icon, not the family's fallback. If any tab draws the family icon, its entry is missing from `ZoneTypeOption`'s dictionary.

- [ ] **Step 3: Check the counts sum**

Each family's tier counts must sum to what that family's single tab showed before. Residential 22+7+11+13+5+9 = 67.

- [ ] **Step 4: Check nothing else changed**

Open a service menu with a dev tree — Electricity or Police. Its strip must still expand exactly one category into branch tabs, unchanged. Open Signatures: five plain category tabs, no expansion.

- [ ] **Step 5: Screenshot the strip and the grid**

Clip to the strip element. Cohtml renders a frame late, so read the DOM after a `ResizeObserver` tick rather than one `requestAnimationFrame` if measuring.

- [ ] **Step 6: Close the bead**

```bash
bd close cm-2xvs.16 --reason "Zone density tiers land as navigable strip categories"
git add -A && git commit -m "chore(findit): close cm-2xvs.16"
```

---

## Self-Review

**Spec coverage.** Tier vocabulary → Task 1. Classification with the probe's measured rules → Task 2. Routing the tier onto catalog entries, including the indexing-order finding → Task 3. Rank and labels on both sides → Tasks 1 and 4. Icons and locale → Task 5. Strip navigation, including generalising the one-category producer → Tasks 7-8. Exact partition → asserted in Task 2's fixtures and checked in Task 6 Step 3 and Task 9 Step 3. "This replaces the nested heading" → no task touches `groupLevelsFor`'s `menuCategory` case or `SecondaryKey`, which is the intended outcome. Out-of-scope items (tile label truncation, building-side classification, the dead `zoneAsCatalogEntry`) have no tasks, correctly.

**Gaps found and closed.** The first draft put Task 7's tests in `BuildingLensDimensionTests`, which turned out to be about layout constants, and left the adapter fixture as a placeholder because `GetExpandedCategoryId` is an instance method needing a live projection. Both are fixed by the same change: the decision moved into a **static** `BuildExpandedCategories(entries, axis, uiMenu)`, mirroring `BuildingCatalogAdapter.BuildFacetState`, which is how every other adapter test in this repo avoids building an adapter. The tests now use the `Base with { … }` fixture from `BuildingLensFacetRelevanceTests` and the producer is quoted in full.

**Remaining judgement, not placeholders.** Task 5's two icons are drawing work — the brief fixes the weight, viewBox and silhouette, but the artwork itself is a decision. Task 7 Step 4a asks for `_styles` to be lifted to a static dictionary; that is a mechanical refactor whose shape depends on the file, so it is described rather than quoted.

**Verified against the codebase while writing:** `StripAxes` (has `Category`, `Development`, `AssetType` — `Density` is new), `BuildingCatalogLabels`, `NetworkMenuExtension.EffectiveCategory`, `TabIcon(IEnumerable<BuildingCatalogEntry>, bool)`, `MenuBranchCount(string Id, int Count, string Icon)`, and `BuildingCatalogEntry`'s `UiMenu`, `UiCategory` and `ZoneType` members all exist as used above.

**Type consistency.** `ZoneDensityFacts` is constructed with named arguments in Task 3 exactly matching the record declared in Task 2. `GetZoneDensity` is defined in Task 3 Step 3 and used in Steps 4 and 5. `MenuCategoryTabs` is `(string CategoryId, MenuBranchCount[] Tabs)` in C# (Task 7) and `{ categoryId, tabs }` in TS (Task 8) — the casing differs because the binding serialiser lowercases, which matches `MenuBranchCount`'s existing `{ id, count, icon }` against C#'s `(Id, Count, Icon)`. `DENSITY_TIERS` labels in Task 4 are the same strings Task 7 Step 4 requires for tab ids and Task 9 Step 2 expects on screen.

---

## As built — where this plan was wrong

Implemented 2026-08-23, all nine tasks. Three places the plan did not survive
contact, recorded because a plan that contradicts the code is worse than no
plan.

**Task 7's "replace the producer" was impossible.** The plan had
`GetExpandedCategories` call `GetStripAxis` — but `GetStripAxis` already calls
`GetExpandedCategoryId`, so replacing that method would have made the axis
depend on a method that depends on the axis. Built instead as: density is tried
first, and the development path calls the same two methods it always did,
untouched. Lower risk, and the dev-tree behaviour is unchanged by construction
rather than by test.

**Tier tabs needed a composite match key, which the plan missed entirely.**
Tab ids are matched by `StripMatches`, and a strip tab click deliberately
CLEARS the category ("a branch and a category are ALTERNATIVES",
`SetBuildingLensStripTab`). Development branch names are unique across a menu
so their id can be both the match key and the label; tier labels are not —
"Low Density" is a tab under Residential, Commercial and Office. A bare tier
would have narrowed to all three families at once under a tab whose count
promised one. Fixed with `StripAxes.DensityTab` (family + tier, unit-separated)
and a `Label` on `MenuBranchCount` so the composite never reaches the screen.
Verified in game: Residential Low → 15 results, Commercial Low → 5, each
matching its own tab's count.

**A partition is now required, not just preferred.** The plan said expand a
category when it has more than one tier. Built stricter: a category holding ANY
untiered entry is not expanded either, because those entries would belong under
no tab and the row would silently drop them — the exact failure this lens
exists to remove.

Two things the plan got right and that were worth the words: every guard was
confirmed to FAIL first (the density rank against the old key, the scale guard
by deletion, the C#/TS mirror by mismatching a label), and Task 6's checkpoint
caught nothing because Tasks 1-5 were correct — which is what a checkpoint
passing is supposed to feel like.

Also removed, unplanned: `ZoningSurfaceCatalog.ResolveDensity`, left with no
callers by Task 3. It was not merely dead — it disagreed with the new rule on
the five low-rent zones, and its own test asserted that disagreement as
correct.
