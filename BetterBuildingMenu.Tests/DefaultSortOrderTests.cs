using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The lens opens in the order the game itself draws.
	/// </summary>
	/// <remarks>
	/// Vanilla's sort is UIObject.m_Priority ascending and nothing else:
	/// UIObjectInfo.CompareTo compares that integer alone, and
	/// ToolbarUISystem.BindAssets filters the category's buffer and calls Sort().
	/// It is authored per asset, so no other column reproduces it — which is why
	/// the sort is called "Default" rather than named after a field.
	/// </remarks>
	public sealed class DefaultSortOrderTests
	{
		private static BuildingCatalogEntry Asset(int id, string name, int uiOrder) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsUniqueMesh: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Roads", UiCategory = "RoadsSmallRoads", UIOrder = uiOrder };

		[Fact]
		public void TheLensOpensInTheGamesOwnOrder()
		{
			// Deliberately alphabetical-hostile: sorted by name this is Alley,
			// Gravel, Highway, and by priority it is the reverse.
			var entries = new[]
			{
				Asset(1, "Highway", 10),
				Asset(2, "Gravel Road", 20),
				Asset(3, "Alley", 30),
			};

			var page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(UiMenu: "Roads"));

			Assert.Equal(
				new[] { "Highway", "Gravel Road", "Alley" },
				page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void AnExplicitSortStillWins()
		{
			// "Default" is a choice like any other, which is the whole reason it
			// is named and offered rather than applied underneath.
			var entries = new[]
			{
				Asset(1, "Highway", 10),
				Asset(2, "Gravel Road", 20),
				Asset(3, "Alley", 30),
			};

			var page = BuildingCatalogQueryEngine.Query(
				entries,
				new BuildingCatalogQuery(UiMenu: "Roads", SortColumn: "Name"));

			Assert.Equal(
				new[] { "Alley", "Gravel Road", "Highway" },
				page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void EqualPrioritiesFallBackToTheNameRatherThanToChance()
		{
			// Vanilla leaves these to an unstable sort, which is fine for a menu
			// drawn once and not for a list that re-renders under the cursor.
			var entries = new[]
			{
				Asset(1, "Beta", 5),
				Asset(2, "Alpha", 5),
			};

			var page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(UiMenu: "Roads"));

			Assert.Equal(new[] { "Alpha", "Beta" }, page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void DefaultIsOfferedFirst()
		{
			Assert.Equal("Default", BuildingCatalogQuery.OfferedSortColumns[0]);
			Assert.Equal("Default", new BuildingCatalogQuery().EffectiveSortColumn);
			Assert.Equal("Default", new BuildingCatalogQuery(SortColumn: "  ").EffectiveSortColumn);
		}
	}
}
