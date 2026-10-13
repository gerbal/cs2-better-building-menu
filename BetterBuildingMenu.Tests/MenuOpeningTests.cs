using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The open rule over a menu as it opens: the armed building's tab when the menu holds it, else
	/// Education's first level with rows, else the menu's first tab with rows.
	/// </summary>
	public sealed class MenuOpeningTests
	{
		private const string Education = "Education & Research";
		private const string Locked = BuildingCatalogFacetSelection.Availability.Locked;
		private const string Unlocked = BuildingCatalogFacetSelection.Availability.Unlocked;
		private static readonly string[] RoadTabs = { "RoadsSmallRoads", "RoadsMediumRoads", "RoadsHighways", "Tracks" };
		private static readonly string[] EducationTabs = { "Education", "Research" };

		private static BuildingCatalogEntry Entry(int id, string menu, string tab, string category = "ServiceBuildings", string subCategory = "ServiceBuildings_Any") =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Prefab" + id, Name: "Building " + id, Category: category, SubCategory: subCategory,
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = menu, UiCategory = tab };

		/// <summary>A locked Small Road, two Medium Roads, a Highway, and a tram track Roads gathers from Transportation.</summary>
		private static readonly BuildingCatalogEntry[] Roads =
		{
			Entry(1, "Roads", "RoadsSmallRoads", "Networks", "Networks_Roads") with { IsLocked = true },
			Entry(2, "Roads", "RoadsMediumRoads", "Networks", "Networks_Roads"),
			Entry(3, "Roads", "RoadsMediumRoads", "Networks", "Networks_Roads"),
			Entry(4, "Roads", "RoadsHighways", "Networks", "Networks_Roads"),
			Entry(5, "Transportation", "TransportationTram", "Networks", "Networks_Tracks"),
		};

		/// <summary>A locked elementary school and two high schools under Education, and research with no level.</summary>
		private static readonly BuildingCatalogEntry[] Schools =
		{
			Entry(11, Education, "Education") with { EducationLevel = 1, IsLocked = true },
			Entry(12, Education, "Education") with { EducationLevel = 2 },
			Entry(13, Education, "Education") with { EducationLevel = 2 },
			Entry(14, Education, "Research"),
		};

		private static MenuOpening Opening(BuildingCatalogEntry[] entries, BuildingCatalogQuery query, int armed, string[] tabs, bool education = false, bool onAll = false) =>
			new CatalogView(entries, query, educationMenu: education, menuCategories: tabs).Opening(armed, onAll);

		private static BuildingCatalogQuery In(string menu, params string[] availability) =>
			new(UiMenu: menu, Availability: availability.Length > 0 ? availability : null);

		[Fact]
		public void AnArmedBuildingOpensOnItsTabWithTheListAnchoredOnIt()
		{
			Assert.Equal(new MenuOpening("RoadsMediumRoads", -1, 3), Opening(Roads, In("Roads"), armed: 3, RoadTabs));
		}

		[Fact]
		public void AMenuThatOpensOnAllOpensThereAnchoredOnTheArmedBuildingItHolds()
		{
			Assert.Equal(new MenuOpening(string.Empty, -1, 3), Opening(Roads, In("Roads"), armed: 3, RoadTabs, onAll: true));
			Assert.Equal(MenuOpening.All, Opening(Roads, In("Roads"), armed: 99, RoadTabs, onAll: true));
			Assert.Equal(MenuOpening.All, Opening(Schools, In(Education), armed: 0, EducationTabs, education: true, onAll: true));
		}

		[Fact]
		public void ASmallMenuOpensOnItsTabUntilTheUiNamesItThenOnAll()
		{
			// The UI names a small menu once C# has counted it: the first open asks with the empty set,
			// the next with its name.
			var first = OpensOnAll.For("Roads", OpensOnAll.Parse(string.Empty), MenuPicks.None, BodyViews.Auto);
			var next = OpensOnAll.For("Roads", OpensOnAll.Parse("Roads"), MenuPicks.None, BodyViews.Auto);

			Assert.Equal(new MenuOpening("RoadsMediumRoads", -1, 3), Opening(Roads, In("Roads"), armed: 3, RoadTabs, onAll: first));
			Assert.Equal(new MenuOpening(string.Empty, -1, 3), Opening(Roads, In("Roads"), armed: 3, RoadTabs, onAll: next));
		}

		[Fact]
		public void AGatheredNetworkOpensOnTheTabRoadsGivesIt()
		{
			Assert.Equal(new MenuOpening("Tracks", -1, 5), Opening(Roads, In("Roads"), armed: 5, RoadTabs));
		}

		[Fact]
		public void WithNothingOfThisMenusArmedItOpensOnItsFirstTabWithRows()
		{
			// Nothing armed, or a building from another menu: the game's own menu opens on its first tab.
			var first = new MenuOpening("RoadsSmallRoads", -1, 0);

			Assert.Equal(first, Opening(Roads, In("Roads"), armed: 0, RoadTabs));
			Assert.Equal(first, Opening(Roads, In("Roads"), armed: 12, RoadTabs));
		}

		[Fact]
		public void AFirstTabTheFiltersEmptyGivesWayToTheNextWithRows()
		{
			// Only what can be built: the Small Road is locked, so its tab lists nothing.
			Assert.Equal(new MenuOpening("RoadsMediumRoads", -1, 0), Opening(Roads, In("Roads", Unlocked), armed: 0, RoadTabs));
		}

		[Fact]
		public void TheArmedBuildingOpensItsTabEvenWhenTheFiltersHideIt()
		{
			// Only what is locked: the armed Medium Road is not, so its tab opens with the list at its top.
			var lockedOnly = In("Roads", Locked);
			var opening = Opening(Roads, lockedOnly, armed: 3, RoadTabs);
			var page = new CatalogView(Roads, lockedOnly with { UiCategory = opening.Category, AnchorId = opening.Anchor }, menuCategories: RoadTabs).Page;

			Assert.Equal(new MenuOpening("RoadsMediumRoads", -1, 3), opening);
			Assert.Equal(-1, page.AnchorIndex);
		}

		[Fact]
		public void AnArmedSchoolOpensOnItsLevel()
		{
			Assert.Equal(new MenuOpening("Education", 2, 12), Opening(Schools, In(Education), armed: 12, EducationTabs, education: true));
		}

		[Fact]
		public void EducationWithNothingArmedOpensOnItsFirstLevelWithRows()
		{
			Assert.Equal(new MenuOpening("Education", 1, 0), Opening(Schools, In(Education), armed: 0, EducationTabs, education: true));
			// Only what can be built: the elementary school is locked, so the high schools' level opens.
			Assert.Equal(new MenuOpening("Education", 2, 0), Opening(Schools, In(Education, Unlocked), armed: 0, EducationTabs, education: true));
		}

		[Fact]
		public void ArmedResearchOpensOnItsTabWithNoLevel()
		{
			Assert.Equal(new MenuOpening("Research", -1, 14), Opening(Schools, In(Education), armed: 14, EducationTabs, education: true));
		}

		[Fact]
		public void ALoneLevelDrawsNoChipSoTheMenuOpensOnTheTab()
		{
			var oneLevel = new[] { Entry(12, Education, "Education") with { EducationLevel = 2 }, Entry(14, Education, "Research") };

			Assert.Equal(new MenuOpening("Education", -1, 12), Opening(oneLevel, In(Education), armed: 12, EducationTabs, education: true));
			Assert.Equal(new MenuOpening("Education", -1, 0), Opening(oneLevel, In(Education), armed: 0, EducationTabs, education: true));
		}

		[Fact]
		public void AnEducationMenuThatDrawsOneTabOpensOnAllWhateverItsLevels()
		{
			// The toolbar's row can leave Education one tab: its levels draw no chips, so no level opens.
			var schoolsOnly = Schools.Where(entry => entry.UiCategory == "Education").ToArray();

			Assert.Equal(MenuOpening.All, Opening(schoolsOnly, In(Education), armed: 0, EducationTabs, education: true));
			Assert.Equal(new MenuOpening(string.Empty, -1, 12), Opening(schoolsOnly, In(Education), armed: 12, EducationTabs, education: true));
		}

		[Fact]
		public void FiltersThatEmptyEveryTabOpenTheMenusFirstTab()
		{
			// Only what can be built, in a menu where nothing can: the first tab opens, its list empty.
			var allLocked = Roads.Select(entry => entry with { IsLocked = true }).ToArray();

			Assert.Equal(new MenuOpening("RoadsSmallRoads", -1, 0), Opening(allLocked, In("Roads", Unlocked), armed: 0, RoadTabs));
		}

		[Fact]
		public void AMenuThatDrawsFewerThanTwoTabsOpensOnAll()
		{
			// One tab draws no tab cells, so the menu opens on All, the armed row anchored.
			var power = new[] { Entry(31, "Electricity", "Electricity"), Entry(32, "Electricity", "Electricity") };

			Assert.Equal(new MenuOpening(string.Empty, -1, 32), Opening(power, In("Electricity"), armed: 32, new[] { "Electricity" }));
			Assert.Equal(MenuOpening.All, Opening(power, In("Electricity"), armed: 0, new[] { "Electricity" }));
		}

		[Fact]
		public void AnArmedBuildingInATabTheRowDoesNotDrawOpensOnAllAnchoredOnIt()
		{
			// A mod's asset can name a category its menu does not list: no cell draws it, so All opens, holding the row.
			const string Parks = "Parks & Recreation";
			var parks = new[] { Entry(41, Parks, "ParksParks"), Entry(42, Parks, "ParksPlazas"), Entry(43, Parks, "ParksStray") };
			var tabs = new[] { "ParksParks", "ParksPlazas" };

			var opening = Opening(parks, In(Parks), armed: 43, tabs);
			var page = new CatalogView(parks, In(Parks) with { UiCategory = opening.Category, AnchorId = opening.Anchor }, menuCategories: tabs).Page;

			Assert.Equal(new MenuOpening(string.Empty, -1, 43), opening);
			Assert.True(page.AnchorIndex >= 0);
		}

		[Fact]
		public void AMenuStillBeingIndexedOpensOnAllWithNoAnchor()
		{
			// During a load the index holds nothing yet: no tab has rows and the armed building is not found.
			Assert.Equal(MenuOpening.All, Opening(Array.Empty<BuildingCatalogEntry>(), In("Roads"), armed: 3, RoadTabs));
		}
	}

	/// <summary>The system opens a menu through the open rule and starts every tab pick at the armed building.</summary>
	public sealed class MenuOpeningWiringTests
	{
		[Fact]
		public void AMenuOpensThroughTheOpenRuleWithTheArmedBuildingAndItsOwnGroupAndSort()
		{
			var selected = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs"), "private void VanillaMenuSelected(int menuEntityIndex)");

			Assert.Contains(
				"var armed = ArmedEntryId(); var memory = _sessionSorts.For(menuName, MenuPicks.Get(Mod.Settings.MenuGroups, menuName)); var onAll = OpensOnAll.For(menuName, _menusOpeningOnAll, Mod.Settings.MenuViews, Mod.Settings.DefaultView); _assetMenu = _assetMenu.OpenMenu(menuName, opened => _buildingCatalogAdapter.Build(_indexer.Source, opened, _toolbarSelection).Opening(armed, onAll), memory);",
				selected);
			Assert.DoesNotContain("SelectMenu(", selected);
		}

		[Fact]
		public void EveryTabPickStartsAtTheArmedBuilding()
		{
			var query = ModSource.Text("Systems/BuildingMenuUISystem.Query.cs");

			Assert.Contains("ApplyTabPick(_assetMenu.SelectCategory(category, ArmedEntryId()))", query);
			Assert.Contains("ApplyTabPick(_assetMenu.SelectStripTab(tab, ArmedEntryId()))", query);
			Assert.Contains("ApplyTabPick(_assetMenu.SelectSchoolTier(tier, _tierParent, ArmedEntryId()))", query);
		}

		[Fact]
		public void ThePageCarriesTheStartAndTheStateKeepsTheWindowItServed()
		{
			var refresh = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private void RefreshBuildingCatalog(");
			var covered = refresh.IndexOf("_assetMenu = _assetMenu.CoverAnchor(page.AnchorIndex);", StringComparison.Ordinal);

			Assert.True(covered >= 0, "the refresh never keeps the window the page served");
			Assert.True(
				covered < refresh.IndexOf("_BuildingCatalogBinding.Value = page with", StringComparison.Ordinal),
				"the state must hold the window before the page goes out");
			Assert.Contains("ListStart = _assetMenu.ListStart,", refresh);
		}

		[Fact]
		public void TheOpenRuleDrawsTabsAndLevelsAsTheTabRowDoes()
		{
			// The rule opens on a tab or a level only where the row draws one: two tabs, two levels.
			var view = ModSource.Text("Services/CatalogView.cs");

			var opening = ModSource.Member(view, "public MenuOpening Opening(int armed, bool onAll = false)");
			var row = ModSource.Text("UI/src/domain/tabRow.ts");

			Assert.Contains("var tabs = DrawsTabs ? MenuCategoryCounts : Array.Empty<MenuCategoryCount>();", opening);
			Assert.Contains("if (DrawsLevels && TierBracket.Tiers.FirstOrDefault(", opening);
			Assert.Contains("private bool DrawsTabs => MenuCategoryCounts.Count > 1;", view);
			Assert.Contains("private bool DrawsLevels => DrawsTabs && TierBracket.Tiers.Length > 1;", view);
			Assert.Contains("DrawsLevels && string.Equals(tab, TierBracket.ParentCategory, StringComparison.Ordinal)", view);

			// The UI draws levels in categoryItems alone, and calls it only where the tab row draws its tabs.
			Assert.Contains("presentCategories(categories, counts).length >= 2", ModSource.Text("UI/src/domain/vanillaMenuCategories.ts"));
			Assert.Contains("category.id === input.bracket.parentCategory && tiers.length > 1", ModSource.Member(row, "function categoryItems("));
			Assert.Contains(
				"if (scoped && shouldShowCategoryStrip(input.categories, input.counts, input.menu)) { items.push(...presentCategories(input.categories, input.counts).flatMap((category) => categoryItems(input, category))); }",
				ModSource.Member(row, "export function tabRow("));
			Assert.Equal(2, System.Text.RegularExpressions.Regex.Matches(row, @"\bcategoryItems\(").Count);
		}
	}
}
