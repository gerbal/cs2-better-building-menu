using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Which sort fields the picker offers. A field that ties across the set makes
	/// the summary flip while the list stays put, which is a dead control, so it
	/// is dropped — the argument groupDimensionsFor makes for grouping.
	/// </summary>
	public sealed class ReorderableSortColumnsTests
	{
		private static readonly string[] Candidates =
			{ "Name", "ConstructionCost", "Upkeep", "Workers", "HasParking" };

		private static readonly BuildingCatalogEntry Base = new(
			Id: 0,
			PrefabName: "Base",
			Name: "Base",
			Category: "ServiceBuildings",
			SubCategory: "Any",
			Thumbnail: "",
			LotWidth: 1,
			LotDepth: 1,
			BuildingLevel: 1,
			ZoneType: ZoneTypeFilter.Any,
			HasParking: false,
			IsUniqueMesh: false,
			IsVanilla: true,
			PdxModsId: "");

		private static BuildingCatalogEntry Entry(
			int id, string name, double? cost = null, double? upkeep = null,
			double? workers = null, int parking = 0, string uiCategory = "Cat") =>
			Base with
			{
				Id = id,
				PrefabName = $"P{id}",
				Name = name,
				UiCategory = uiCategory,
				ConstructionCost = cost,
				Upkeep = upkeep,
				Workers = workers,
				ParkingSlots = parking,
			};

		private static BuildingCatalogQuery Query(string groupBy = "none") => new() { GroupBy = groupBy };

		[Fact]
		public void DropsAFieldThatTiesAcrossTheWholeSet()
		{
			// A field every entry agrees on cannot act.
			var entries = new[]
			{
				Entry(1, "Waveform Tower", cost: 0, upkeep: 10),
				Entry(2, "Halo Heights", cost: 0, upkeep: 20),
			};

			var usable = BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query(), Candidates);

			Assert.DoesNotContain("ConstructionCost", usable);
			Assert.Contains("Upkeep", usable);
			Assert.Contains("Name", usable);
		}

		[Fact]
		public void DropsEveryFieldTheSetCannotDistinguish()
		{
			// One entry distinguishes nothing at all — not even its own name.
			var usable = BuildingCatalogQueryEngine.ReorderableSortColumns(
				new[] { Entry(1, "Only", cost: 5) }, Query(), Candidates);

			Assert.Empty(usable);
		}

		[Fact]
		public void AsksPerGroup_BecauseGroupingIsThePrimarySortKey()
		{
			// Two groups, two distinct costs overall, constant inside each. The
			// sort cannot move a row, so Cost has to go even though a whole-set
			// distinct count would keep it.
			var entries = new[]
			{
				Entry(1, "A", cost: 1000, uiCategory: "Small Roads"),
				Entry(2, "B", cost: 1000, uiCategory: "Small Roads"),
				Entry(3, "C", cost: 5000, uiCategory: "Highways"),
				Entry(4, "D", cost: 5000, uiCategory: "Highways"),
			};

			Assert.DoesNotContain(
				"ConstructionCost",
				BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query("menuCategory"), Candidates));

			// Ungrouped, the same entries reorder fine.
			Assert.Contains(
				"ConstructionCost",
				BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query(), Candidates));
		}

		[Fact]
		public void KeepsAFieldThatOnlySomeGroupsDistinguish()
		{
			// One group is enough: clicking the control moves rows SOMEWHERE, so
			// it is not a dead control.
			var entries = new[]
			{
				Entry(1, "A", cost: 1000, uiCategory: "Flat"),
				Entry(2, "B", cost: 1000, uiCategory: "Flat"),
				Entry(3, "C", cost: 1000, uiCategory: "Varied"),
				Entry(4, "D", cost: 9000, uiCategory: "Varied"),
			};

			Assert.Contains(
				"ConstructionCost",
				BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query("menuCategory"), Candidates));
		}

		[Fact]
		public void CountsAMissingValueAsDistinctFromAPresentOne()
		{
			// The engine orders present-before-absent, so this genuinely moves.
			var entries = new[] { Entry(1, "Priced", cost: 1000), Entry(2, "Unpriced") };

			Assert.Contains(
				"ConstructionCost",
				BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query(), Candidates));
		}

		[Fact]
		public void ReadsParkingAsACountRatherThanAFlag()
		{
			// Bay counts distinguish where a boolean ties across a whole menu.
			var entries = new[] { Entry(1, "A", parking: 0), Entry(2, "B", parking: 12) };

			Assert.Contains(
				"HasParking",
				BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query(), Candidates));
		}

		[Fact]
		public void SurvivesAnEmptySetAndAnEmptyCandidateList()
		{
			Assert.Empty(BuildingCatalogQueryEngine.ReorderableSortColumns(
				Array.Empty<BuildingCatalogEntry>(), Query(), Candidates));
			Assert.Empty(BuildingCatalogQueryEngine.ReorderableSortColumns(
				new[] { Entry(1, "A") }, Query(), Array.Empty<string>()));
		}

		[Fact]
		public void MakesOnePassRegardlessOfHowManyColumnsAreAsked()
		{
			// Guards the shape rather than the answer: the set is scanned once, not
			// once per candidate column.
			var scanned = 0;
			var entries = Enumerable.Range(1, 500).Select(i =>
			{
				scanned++;
				return Entry(i, $"E{i}", cost: i);
			});

			BuildingCatalogQueryEngine.ReorderableSortColumns(entries, Query(), Candidates);

			Assert.Equal(500, scanned);
		}
		[Fact]
		public void ReproducesTheWaterMenuShape()
		{
			// The Water & Sewage shape — one category, several dev branches, costs
			// that differ within a group — is a menu the feature has to handle.
			var entries = new[]
			{
				Entry(1, "Combined Pipe", cost: 2000, uiCategory: "Water & Sewage") with { DevTreeBranch = "Water & Sewage" },
				Entry(2, "EE Water Tower", cost: 18000, uiCategory: "Water & Sewage") with { DevTreeBranch = "Water & Sewage" },
				Entry(3, "FR Water Tower", cost: 60000, uiCategory: "Water & Sewage") with { DevTreeBranch = "Water & Sewage" },
				Entry(4, "JP Treatment", cost: 400000, uiCategory: "Water & Sewage") with { DevTreeBranch = "Water Treatment Plant" },
			};

			var usable = BuildingCatalogQueryEngine.ReorderableSortColumns(
				entries, Query("menuCategory"), BuildingCatalogQuery.OfferedSortColumns);

			Assert.Contains("ConstructionCost", usable);
			Assert.Contains("Name", usable);
		}
	}
}
