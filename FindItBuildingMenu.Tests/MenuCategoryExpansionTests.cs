using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;

using System;
using System.Linq;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// Which categories the strip draws sub-tabs for, instead of themselves.
	/// </summary>
	/// <remarks>
	/// The rule is the school levels', stated in MenuCategoryStrip: sub-tabs may
	/// stand in for a category only when they partition it exactly, because a
	/// row that hides part of its own category is worse than no row.
	/// </remarks>
	public class MenuCategoryExpansionTests
	{
		private static readonly BuildingCatalogEntry Base = new(
			Id: 0,
			PrefabName: "Base",
			Name: "Base",
			Category: "Zones",
			SubCategory: "Any",
			Thumbnail: "",
			LotWidth: 1,
			LotDepth: 1,
			BuildingLevel: 1,
			ZoneType: ZoneTypeFilter.Any,
			HasParking: false,
			IsUniqueMesh: false,
			IsVanilla: true,
			IsFavorited: false,
			PdxModsId: "");

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

			Assert.Equal(
				new[] { "ZonesCommercial", "ZonesResidential" },
				BuildingCatalogAdapter.BuildDensityTabs(entries, "Zones")
					.Select(group => group.CategoryId)
					.ToArray());
		}

		[Fact]
		public void LeavesAFamilyWithOneTierUnexpanded()
		{
			// Industrial is a single untiered zone. A lone sub-tab is a heading
			// that says nothing.
			var entries = new[]
			{
				Zone(1, "ZonesIndustrial", ZoneTypeFilter.Any),
				Zone(2, "ZonesResidential", ZoneTypeFilter.Low),
				Zone(3, "ZonesResidential", ZoneTypeFilter.High),
			};

			Assert.DoesNotContain(
				BuildingCatalogAdapter.BuildDensityTabs(entries, "Zones"),
				group => group.CategoryId == "ZonesIndustrial");
		}

		[Fact]
		public void LeavesAFamilyAloneWhenAnyOfItIsUntiered()
		{
			// A partition or nothing. If one zone in the family has no tier it
			// belongs under no tab, and the row would silently drop it — which
			// reads as the menu losing an asset, the exact failure this whole
			// lens exists to remove.
			var entries = new[]
			{
				Zone(1, "ZonesResidential", ZoneTypeFilter.Low),
				Zone(2, "ZonesResidential", ZoneTypeFilter.High),
				Zone(3, "ZonesResidential", ZoneTypeFilter.Any),
			};

			Assert.Empty(BuildingCatalogAdapter.BuildDensityTabs(entries, "Zones"));
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

			Assert.Equal(
				new[]
				{
					"Low Density",
					"Row Housing",
					"Medium Density",
					"Mixed Housing",
					"Low Rent Housing",
					"High Density",
				},
				BuildingCatalogAdapter.BuildDensityTabs(entries, "Zones")
					.Single()
					.Tabs
					.Select(tab => tab.DisplayLabel)
					.ToArray());
		}

		[Fact]
		public void MatchesOnFamilyAndTierTogether_NotOnTheTierAlone()
		{
			// "Low Density" is a tab under Residential, Commercial and Office,
			// and clicking a strip tab clears the category by design. Matching
			// the tier alone would show all three families under a tab whose
			// count promised one.
			var residentialLow = Zone(1, "ZonesResidential", ZoneTypeFilter.Low);
			var commercialLow = Zone(2, "ZonesCommercial", ZoneTypeFilter.Low);

			var tab = BuildingCatalogAdapter
				.BuildDensityTabs(
					new[] { residentialLow, Zone(3, "ZonesResidential", ZoneTypeFilter.High), commercialLow },
					"Zones")
				.Single(group => group.CategoryId == "ZonesResidential")
				.Tabs
				.Single(candidate => candidate.DisplayLabel == "Low Density")
				.Id;

			Assert.True(BuildingCatalogQueryEngine.StripMatches(residentialLow, tab));
			Assert.False(BuildingCatalogQueryEngine.StripMatches(commercialLow, tab));
		}

		[Fact]
		public void EachTabCarriesItsTiersOwnIcon()
		{
			// The strip falls back to the category's icon when a tab has none,
			// so a missing entry in ZoneTypeOption's table shows up as six tabs
			// wearing one icon rather than as an error.
			var entries = new[]
			{
				Zone(1, "ZonesResidential", ZoneTypeFilter.Mixed),
				Zone(2, "ZonesResidential", ZoneTypeFilter.LowRent),
			};

			var icons = BuildingCatalogAdapter.BuildDensityTabs(entries, "Zones")
				.Single()
				.Tabs
				.Select(tab => tab.Icon)
				.ToArray();

			Assert.All(icons, icon => Assert.False(string.IsNullOrEmpty(icon)));
			Assert.Equal(icons.Length, icons.Distinct(StringComparer.Ordinal).Count());
		}

		[Fact]
		public void DrawsNoTabsForAMenuWithNoZones()
		{
			// Service buildings carry no tier at all. The development tree
			// supplies this menu's sub-tabs, and density must stay out of its
			// way rather than expanding on a field every entry leaves at Any.
			var entries = new[]
			{
				Base with { Id = 1, UiMenu = "Healthcare", UiCategory = "Healthcare", DevTreeBranch = "Health" },
				Base with { Id = 2, UiMenu = "Healthcare", UiCategory = "Healthcare", DevTreeBranch = "Deathcare" },
			};

			Assert.Empty(BuildingCatalogAdapter.BuildDensityTabs(entries, "Healthcare"));
		}
	}
}
