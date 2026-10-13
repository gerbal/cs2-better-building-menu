using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>A typed search as one list over the whole menu: relevance before any group, then the game's own order.</summary>
	public sealed class SearchOrderTests
	{
		private static BuildingCatalogEntry Row(int id, string name, int tab, int order = 0) =>
			new(
				Id: id, PrefabName: "Prefab" + id, Name: name, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 0, LotDepth: 0, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "",
				UiMenu: "Roads", UiCategory: "Tab" + tab, UiCategoryTab: tab, UIOrder: order);

		private static readonly BuildingCatalogEntry[] Roads =
		{
			Row(1, "Two-Lane Road", tab: 0, order: 1),
			Row(2, "Wide Fourway Plaza", tab: 0, order: 2),
			Row(3, "Gravelfour Road", tab: 1, order: 1),
			Row(4, "Four-Lane Road", tab: 2, order: 1),
		};

		private static int[] Order(BuildingCatalogQuery query) =>
			BuildingCatalogQueryEngine.Query(Roads, query).Items.Select(entry => entry.Id).ToArray();

		[Fact]
		public void TypingRanksAPrefixMatchInALaterTabAboveWordStartsInEarlierOnes()
		{
			var grouping = BuildingCatalogGrouping.WhileSearching(BuildingCatalogGrouping.MenuCategory, "four");

			Assert.Equal(new[] { 4, 2, 3 }, Order(new BuildingCatalogQuery(SearchText: "four", SortColumn: BuildingCatalogQuery.MatchSort, GroupBy: grouping)));
		}

		[Fact]
		public void UnderMatchEqualMatchesKeepTheGamesTabOrderThenItsOrderInTheTab()
		{
			// "lane" is a word start in each name, all as long as each other: the game's order decides.
			var rows = new[] { Row(5, "Six-Lane Road", tab: 2, order: 1), Row(6, "Two-Lane Road", tab: 0, order: 2), Row(7, "One-Lane Road", tab: 0, order: 1) };
			var query = new BuildingCatalogQuery(SearchText: "lane", SortColumn: BuildingCatalogQuery.MatchSort, GroupBy: BuildingCatalogGrouping.None);

			Assert.Equal(new[] { 7, 6, 5 }, BuildingCatalogQueryEngine.Query(rows, query).Items.Select(entry => entry.Id));
		}

		[Fact]
		public void GroupsWaitWhileAQueryIsTypedAndComeBackAfter()
		{
			Assert.Equal(BuildingCatalogGrouping.None, BuildingCatalogGrouping.WhileSearching(BuildingCatalogGrouping.MenuCategory, "four"));
			Assert.Equal(BuildingCatalogGrouping.MenuCategory, BuildingCatalogGrouping.WhileSearching(BuildingCatalogGrouping.MenuCategory, "  "));
			Assert.Equal(BuildingCatalogGrouping.Theme, BuildingCatalogGrouping.WhileSearching(BuildingCatalogGrouping.Theme, null));
		}

		[Fact]
		public void MatchIsOfferedSecondAfterTheGamesOwnOrder()
		{
			Assert.Equal(new[] { BuildingCatalogQuery.DefaultSort, BuildingCatalogQuery.MatchSort }, BuildingCatalogQuery.OfferedSortColumns.Take(2));
		}
	}

	/// <summary>The system wires each menu's own GROUP and SORT, and the search over the whole menu.</summary>
	public sealed class MenuMemoryWiringTests
	{
		[Fact]
		public void TheRefreshSuspendsGroupsWhileAQueryIsTypedAndNotesTheMenusDefault()
		{
			var refresh = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private void RefreshBuildingCatalog(");

			Assert.Contains("built.GroupFor(_assetMenu.Query.GroupBy, _assetMenu.Query.SearchText)", refresh);
			Assert.Contains("_menuDefaultGroup = view.DefaultGroupBy;", refresh);
		}

		[Fact]
		public void AGroupPickIsKeptAsTheMenusOwnAndSavedOnce()
		{
			var pick = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Query.cs"), "private void SetBuildingCatalogGroupBy(");

			Assert.Contains("MenuPicks.WithGroup(Mod.Settings.MenuGroups, _assetMenu.Menu, BuildingCatalogGrouping.IsDimension(groupBy) ? groupBy.Trim() : MenuPicks.None, _menuDefaultGroup)", pick);
			Assert.Contains("Mod.Settings.ApplyAndSave();", pick);
		}

		[Fact]
		public void AGroupPickWaitsOutATypedQueryAsTheGroupsDo()
		{
			var pick = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Query.cs"), "private void SetBuildingCatalogGroupBy(");

			// The binding takes the pick before its handler runs, and no refresh follows to put the page's None back.
			Assert.Contains("if (!string.IsNullOrWhiteSpace(_assetMenu.Query.SearchText)) { _BuildingCatalogGroupBy.Value = BuildingCatalogGrouping.None; return; }", pick);
		}

		[Fact]
		public void ATypedSearchRepublishesTheTabAndLevelItClearsOrBringsBack()
		{
			var search = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Query.cs"), "private void SearchChanged(");

			Assert.Contains("_assetMenu = next; PublishScope();", search);
		}

		[Fact]
		public void TheGroupPicksArePushedOnlyWhenTheirTextChanges()
		{
			var applied = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied(");

			Assert.Contains("if (!string.Equals(_publishedMenuGroups, Mod.Settings.MenuGroups, StringComparison.Ordinal))", applied);
		}

		[Fact]
		public void EverySortPickIsKeptForTheSessionAndTheSearchClearsAtTheArmedBuilding()
		{
			var query = ModSource.Text("Systems/BuildingMenuUISystem.Query.cs");

			Assert.Contains("Apply(_assetMenu.SetSortColumn(column)); _sessionSorts.Keep(_assetMenu);", ModSource.Member(query, "private void SetBuildingCatalogSortColumn("));
			Assert.Contains("Apply(_assetMenu.SetDescending(descending)); _sessionSorts.Keep(_assetMenu);", ModSource.Member(query, "private void SetBuildingCatalogSortDescending("));
			Assert.Contains("_assetMenu.Search(text, ArmedEntryId())", ModSource.Member(query, "private void SearchChanged("));
		}

		[Fact]
		public void TheGroupPicksReachTheUiAndFollowOptions()
		{
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");

			Assert.Contains("CreateBinding(\"AssetMenuGroups\", MenuPicks.Parse(Mod.Settings.MenuGroups).ToArray())", system);
			Assert.Contains("_AssetMenuGroups.Value = MenuPicks.Parse(Mod.Settings.MenuGroups).ToArray();", ModSource.Member(system, "private void OnSettingsApplied("));
		}

		[Fact]
		public void TheMenuGroupsSettingIsHidden()
		{
			var property = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.MenuGroups))!;

			Assert.True(property.IsDefined(typeof(Game.Settings.SettingsUIHiddenAttribute), inherit: false));
			Assert.Equal(typeof(string), property.PropertyType);
		}
	}
}
