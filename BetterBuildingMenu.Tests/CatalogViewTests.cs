using System.Collections;
using System.Collections.Generic;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The view answers, from one pass, what the static helpers answer over the same
	/// scope: equivalence against them, not a re-specification.
	/// </summary>
	public sealed class CatalogViewTests
	{
		private static BuildingCatalogEntry Entry(int id, string name, string category, string menu, string uiCategory) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: category, SubCategory: category + "_Any",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = menu, UiCategory = uiCategory };

		private static readonly BuildingCatalogEntry[] Fixture =
		{
			Entry(1, "Small Road", "Networks", "Roads", "RoadsSmallRoads") with { DevTreeBranch = "Basic", DevTreeBranchDepth = 0 },
			Entry(2, "Highway", "Networks", "Roads", "RoadsHighways") with { DevTreeBranch = "Highways", DevTreeBranchDepth = 1 },
			Entry(3, "Wind Turbine", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Electricity", DevTreeBranchDepth = 0, Capacity = 10 },
			Entry(4, "Coal Plant", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Electricity", DevTreeBranchDepth = 0, Capacity = 20 },
			Entry(5, "Gas Plant", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Gas Power Plant", DevTreeBranchDepth = 1, Capacity = 30 },
			Entry(6, "High School", "ServiceBuildings", "Education & Research", "Education") with { EducationLevel = 2 },
		};

		private const string Locked = BuildingCatalogFacetSelection.Availability.Locked;

		/// <summary>The Roads menu's tabs in the game's order; nothing in the menu answers to RoadsParking.</summary>
		private static readonly string[] RoadTabs = { "RoadsSmallRoads", "RoadsMediumRoads", "RoadsHighways", "RoadsParking" };

		private static BuildingCatalogEntry Road(int id, string tab, bool locked = false) =>
			Entry(id, "Road " + id, "Networks", "Roads", tab) with { IsLocked = locked };

		private static readonly BuildingCatalogEntry[] Roads =
		{
			Road(21, "RoadsSmallRoads"),
			Road(22, "RoadsSmallRoads", locked: true),
			Road(23, "RoadsMediumRoads", locked: true),
			Road(24, "RoadsHighways"),
			Road(25, "RoadsHighways"),
		};

		/// <summary>One category, so the strip draws the development tree: Wind, then Gas. Gas's branch icon is a content hash.</summary>
		private static readonly BuildingCatalogEntry[] Power =
		{
			Entry(31, "Wind Turbine", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Wind", IsLocked = true },
			Entry(32, "Small Wind Farm", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Wind" },
			Entry(33, "Gas Plant", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Gas", DevTreeBranchDepth = 1, DevTreeBranchIcon = "assetdb://global/9f2c" },
		};

		/// <summary>Two categories, the first split into two branches the row draws in its place.</summary>
		private static readonly BuildingCatalogEntry[] Health =
		{
			Entry(41, "Clinic", "ServiceBuildings", "Health", "HealthcareHealthcare") with { DevTreeBranch = "Basic", IsLocked = true },
			Entry(42, "Hospital", "ServiceBuildings", "Health", "HealthcareHealthcare") with { DevTreeBranch = "Hospitals", DevTreeBranchDepth = 1 },
			Entry(43, "Cemetery", "ServiceBuildings", "Health", "HealthcareDeathcare") with { DevTreeBranch = "Deathcare" },
		};

		/// <summary>Several menus, unscoped: zones in two densities, a service in two branches, and a road.</summary>
		private static readonly BuildingCatalogEntry[] Everything =
		{
			Entry(51, "Starter Home", "Buildings", "Zones", "ZonesResidential") with { ZoneType = ZoneTypeFilter.Low },
			Entry(52, "Tower Block", "Buildings", "Zones", "ZonesResidential") with { ZoneType = ZoneTypeFilter.High },
			Entry(53, "Wind Turbine", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Wind" },
			Entry(54, "Wind Farm", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Wind" },
			Entry(55, "Gas Plant", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Gas", DevTreeBranchDepth = 1 },
			Entry(56, "Small Road", "Networks", "Roads", "RoadsSmallRoads"),
		};

		/// <summary>The whole catalog as the adapter builds it: no menu, so no tabs, and the system's default grouping.</summary>
		private static CatalogView Unscoped(BuildingCatalogQuery query, System.Func<IReadOnlyList<BuildingCatalogEntry>>? packScope = null) =>
			new(
				Everything,
				query,
				packScope,
				built => BuildingCatalogGrouping.Effective(query.GroupBy, false, built.StripAxis, false, built.GroupDimensions),
				menuCategories: System.Array.Empty<string>());

		private static BuildingCatalogQuery LockedIn(string menu) => new(UiMenu: menu, Availability: new[] { Locked });

		[Fact]
		public void ATabCountsWhatItListsWithTheFiltersOn()
		{
			var view = new CatalogView(Roads, LockedIn("Roads"), menuCategories: RoadTabs);

			// The menu's own order, and Highways at 0 rather than gone: the filter emptied it, the
			// menu did not. Parking has no count, because the menu holds nothing for it.
			Assert.Equal(
				new[] { ("RoadsSmallRoads", 1), ("RoadsMediumRoads", 1), ("RoadsHighways", 0) },
				view.MenuCategoryCounts.Select(count => (count.Id, count.Count)));

			foreach (var count in view.MenuCategoryCounts)
			{
				Assert.Equal(count.Count, new CatalogView(Roads, LockedIn("Roads") with { UiCategory = count.Id }).Page.TotalCount);
			}
		}

		[Fact]
		public void AllCountsEveryRowTheFiltersLeaveInTheMenu()
		{
			Assert.Equal(2, new CatalogView(Roads, LockedIn("Roads"), menuCategories: RoadTabs).AllCount);
			Assert.Equal(5, new CatalogView(Roads, new BuildingCatalogQuery(UiMenu: "Roads"), menuCategories: RoadTabs).AllCount);
		}

		[Fact]
		public void ATypedSearchCountsMatchesAndKeepsATabWithNoneInPlace()
		{
			var view = new CatalogView(Roads, new BuildingCatalogQuery(UiMenu: "Roads", SearchText: "Road 24"), menuCategories: RoadTabs);

			Assert.Equal(
				new[] { ("RoadsSmallRoads", 0), ("RoadsMediumRoads", 0), ("RoadsHighways", 1) },
				view.MenuCategoryCounts.Select(count => (count.Id, count.Count)));
		}

		[Fact]
		public void AStripTabKeepsItsPlaceAndCountsZeroWhenTheFiltersEmptyIt()
		{
			var locked = new CatalogView(Power, LockedIn("Electricity"));
			var typed = new CatalogView(Power, new BuildingCatalogQuery(UiMenu: "Electricity", SearchText: "Gas"));

			Assert.Equal(new[] { ("Wind", 1), ("Gas", 0) }, locked.StripTabs.Select(tab => (tab.Id, tab.Count)));
			// The search must not take the strip away under the player: the axis comes from the
			// menu, and only the counts follow what is typed.
			Assert.Equal(new[] { ("Wind", 0), ("Gas", 1) }, typed.StripTabs.Select(tab => (tab.Id, tab.Count)));
		}

		[Fact]
		public void ABranchInItsCategorysPlaceCountsWhatItListsWithTheFiltersOn()
		{
			var expanded = Assert.Single(new CatalogView(Health, LockedIn("Health")).ExpandedCategories);

			Assert.Equal("HealthcareHealthcare", expanded.CategoryId);
			Assert.Equal(new[] { ("Basic", 1), ("Hospitals", 0) }, expanded.Tabs.Select(tab => (tab.Id, tab.Count)));
		}

		[Fact]
		public void AStripTabWithNoPictureOfItsOwnDrawsTheMenusIconNeverAHashOrNothing()
		{
			// Wind has no art at all, and Gas's branch icon is a content hash: neither can be drawn.
			var view = new CatalogView(Power, new BuildingCatalogQuery(UiMenu: "Electricity"), menuIcon: "Media/Game/Icons/Electricity.svg");

			Assert.Equal(
				new[] { ("Wind", "Media/Game/Icons/Electricity.svg"), ("Gas", "Media/Game/Icons/Electricity.svg") },
				view.StripTabs.Select(tab => (tab.Id, tab.Icon)));
		}

		[Fact]
		public void ABranchInItsCategorysPlaceDrawsTheMenusIconWhenItHasNone()
		{
			var view = new CatalogView(Health, new BuildingCatalogQuery(UiMenu: "Health"), menuIcon: "Media/Game/Icons/Healthcare.svg");

			Assert.All(Assert.Single(view.ExpandedCategories).Tabs, tab => Assert.Equal("Media/Game/Icons/Healthcare.svg", tab.Icon));
		}

		[Fact]
		public void EveryTierInTheBracketCarriesAnIconTheRowCanDraw()
		{
			var education = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Education & Research"), educationMenu: true);

			Assert.NotEmpty(education.TierBracket.Tiers);
			Assert.All(education.TierBracket.Tiers, tier => Assert.True(CategoryIcon.IsResolvable(tier.Icon)));
		}

		[Fact]
		public void TheTabCountsAddUpToAllWhenEveryRowSitsInOneTab()
		{
			// Every Roads row answers to exactly one of the menu's tabs, so the tabs partition the menu.
			foreach (var query in new[] { new BuildingCatalogQuery(UiMenu: "Roads"), LockedIn("Roads"), new BuildingCatalogQuery(UiMenu: "Roads", SearchText: "Road 2") })
			{
				var view = new CatalogView(Roads, query, menuCategories: RoadTabs);

				Assert.Equal(view.AllCount, view.MenuCategoryCounts.Sum(count => count.Count));
			}
		}

		[Theory]
		[InlineData(false)]
		[InlineData(true)]
		public void TheContentFacetShowsTheGamesVanillaToggle(bool vanillaSelected)
		{
			// The adapter reads the toggle from the toolbar selection the asset menu holds and
			// hands it to the view; the view must pass it on to the facet it builds.
			var baseGame = Entry(1, "Clinic", "ServiceBuildings", "Health & Deathcare", "Healthcare")
				with { DlcId = GameDlcIds.BaseGame.ToString(System.Globalization.CultureInfo.InvariantCulture) };
			var sanFrancisco = Entry(2, "Cable Car", "ServiceBuildings", "Health & Deathcare", "Healthcare") with { DlcId = "1" };

			var view = new CatalogView(new[] { baseGame, sanFrancisco }, new BuildingCatalogQuery(), vanillaSelected: vanillaSelected);

			var content = view.FacetState.Groups.Single(group => group.Id == FacetIds.Content);
			Assert.Equal(vanillaSelected, content.Options.Single(option => option.Id == ContentOption.Vanilla).Selected);
		}

		[Fact]
		public void AStripTabKeepsItsIconWhenANarrowingRemovesTheAssetItCameFrom()
		{
			// A tab's icon comes from the whole menu, not from whichever asset
			// survives a narrowing. The fixture is a service menu with one category,
			// so the strip's axis is the development tree.
			var alpha = Entry(1, "Alpha Clinic", "ServiceBuildings", "Health & Deathcare", "Healthcare") with { DevTreeBranch = "Hospital", DevTreeBranchDepth = 0, Thumbnail = "alpha.png", UiCategoryPriority = 0 };
			var beta = Entry(2, "Beta Ward", "ServiceBuildings", "Health & Deathcare", "Healthcare") with { DevTreeBranch = "Hospital", DevTreeBranchDepth = 0, Thumbnail = "beta.png", UiCategoryPriority = 1 };
			var ferry = Entry(3, "Crematorium", "ServiceBuildings", "Health & Deathcare", "Healthcare") with { DevTreeBranch = "Deathcare", DevTreeBranchDepth = 1, Thumbnail = "crem.png" };
			var whole = new[] { alpha, beta, ferry };

			var open = new CatalogView(whole, new BuildingCatalogQuery(UiMenu: "Health & Deathcare"));
			var roadOpen = open.StripTabs.Single(tab => tab.Id == "Hospital");
			Assert.Equal(2, roadOpen.Count);
			Assert.Equal("alpha.png", roadOpen.Icon);

			// The toolbar's pack selection narrows the projection itself; the view
			// is then handed the pack-ignored projection for exactly this.
			var packed = new CatalogView(new[] { beta, ferry }, new BuildingCatalogQuery(UiMenu: "Health & Deathcare"), packScope: () => whole);
			var roadPacked = packed.StripTabs.Single(tab => tab.Id == "Hospital");
			Assert.Equal(1, roadPacked.Count);
			Assert.Equal("alpha.png", roadPacked.Icon);
		}

		[Fact]
		public void AnAuthoredTabWithNoBranchIconDrawsTheCategoryGlyphNotAPhotograph()
		{
			// A single-asset category still belongs in a row of flat glyphs, not a
			// building render.
			var lone = new[]
			{
				new BuildingCatalogEntry(
					Id: 9, PrefabName: "ParkingHall02", Name: "Parking Hall", Category: "ServiceBuildings", SubCategory: "ServiceBuildings_Transportation",
					Thumbnail: "ParkingHall02?width=128", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
					HasParking: true, IsVanilla: true, PdxModsId: "")
					with { FallbackThumbnail = "Media/Game/Icons/Parking.svg", DevTreeBranch = "Parking", DevTreeBranchIcon = null },
			};

			Assert.Equal("Media/Game/Icons/Parking.svg", BuildingCatalogAdapter.TabIcon(lone, authored: true));
			// The asset-type row keeps the representative picture: a water pipe is
			// a serviceable picture of "Networks".
			Assert.Equal("ParkingHall02?width=128", BuildingCatalogAdapter.TabIcon(lone, authored: false));
			// And an authored branch icon still wins over both — unless it holds the
			// asset's own render, which is a photograph rather than an icon.
			Assert.Equal("branch.svg", BuildingCatalogAdapter.TabIcon(new[] { lone[0] with { DevTreeBranchIcon = "branch.svg" } }, authored: true));
			Assert.Equal("Media/Game/Icons/Parking.svg", BuildingCatalogAdapter.TabIcon(new[] { lone[0] with { DevTreeBranchIcon = "thumbnail://ThumbnailCamera/BuildingPrefab/ParkingHall02?width=128" } }, authored: true));
		}

		[Fact]
		public void ATabsGlyphBreaksAPriorityTieByThePlaceInTheStrip()
		{
			// Two categories at one priority, as a tie in the game's strip: the glyph
			// comes from the one the strip draws first, not the first by name.
			var alpha = new BuildingCatalogEntry(
				Id: 1, PrefabName: "Alpha", Name: "Alpha", Category: "ServiceBuildings", SubCategory: "ServiceBuildings_Transportation",
				Thumbnail: "alpha.png", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiCategoryPriority = 70, UiCategoryTab = 5, FallbackThumbnail = "alpha.svg" };
			var beta = alpha with { Id = 2, PrefabName = "Beta", Name = "Beta", Thumbnail = "beta.png", UiCategoryTab = 2, FallbackThumbnail = "beta.svg" };

			Assert.Equal("beta.png", BuildingCatalogAdapter.TabIcon(new[] { alpha, beta }, authored: false));
			Assert.Equal("beta.svg", BuildingCatalogAdapter.TabIcon(new[] { alpha, beta }, authored: true));
		}

		/// <summary>Counts enumerations; the count is the fact under test.</summary>
		private sealed class CountingList : IReadOnlyList<BuildingCatalogEntry>
		{
			private readonly BuildingCatalogEntry[] _items;
			public int Walks { get; private set; }
			public CountingList(BuildingCatalogEntry[] items) => _items = items;
			public BuildingCatalogEntry this[int index] => _items[index];
			public int Count => _items.Length;
			public IEnumerator<BuildingCatalogEntry> GetEnumerator() { Walks++; return ((IEnumerable<BuildingCatalogEntry>)_items).GetEnumerator(); }
			IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
		}

		[Fact]
		public void TheSetsAreTheScopesTheAdapterUsedToRecompute()
		{
			var query = new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsHighways", StripTabs: new[] { "Highways" });
			var view = new CatalogView(Fixture, query);

			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query with { UiCategory = "", StripTabs = null, SchoolTier = -1 }).Select(e => e.Id),
				view.MenuSet.Select(e => e.Id));
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query).Select(e => e.Id),
				view.ViewSet.Select(e => e.Id));
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query with { StripTabs = null }).Select(e => e.Id),
				view.TabSet.Select(e => e.Id));
			Assert.Equal(new[] { 1, 2 }, view.MenuSet.Select(e => e.Id));
			Assert.Equal(new[] { 2 }, view.ViewSet.Select(e => e.Id));
		}

		[Fact]
		public void PageBoundsAndFacetsComeFromTheSameSetsTheAdapterUsed()
		{
			var query = new BuildingCatalogQuery(UiMenu: "Electricity", MinCapacity: 15);
			var view = new CatalogView(Fixture, query);

			Assert.Equal(
				BuildingCatalogQueryEngine.Query(Fixture, query).Items.Select(e => e.Id),
				view.Page.Items.Select(e => e.Id));
			Assert.Equal(new[] { 4, 5 }, view.Page.Items.Select(e => e.Id));
			Assert.Equal(
				BuildingCatalogAdapter.MetricBoundsOf(BuildingCatalogQueryEngine.InScope(Fixture, query)),
				view.MetricBounds);
			Assert.Equal(
				BuildingCatalogAdapter.BuildFacetState(BuildingCatalogQueryEngine.InScope(Fixture, query), query).Groups.Select(g => g.Id),
				view.FacetState.Groups.Select(g => g.Id));
		}

		[Fact]
		public void CountsStripAndTiersMatchTheOldDerivations()
		{
			var roads = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Roads"));
			Assert.Equal(new[] { ("RoadsHighways", 1), ("RoadsSmallRoads", 1) }, roads.MenuCategoryCounts.Select(c => (c.Id, c.Count)));
			// Two categories, neither with two branches: nothing expanded, no axis, no tabs.
			Assert.Equal(string.Empty, roads.ExpandedCategoryId);
			Assert.Equal(string.Empty, roads.StripAxis);
			Assert.Empty(roads.StripTabs);
			Assert.Empty(roads.ExpandedCategories);

			var electricity = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Electricity"));
			// One category, two branches: the development axis, tabs by depth then name.
			Assert.Equal(StripAxes.Development, electricity.StripAxis);
			Assert.Equal(new[] { ("Electricity", 2), ("Gas Power Plant", 1) }, electricity.StripTabs.Select(t => (t.Id, t.Count)));
			Assert.Empty(electricity.TierBracket.Tiers);

			var education = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Education & Research"), educationMenu: true);
			Assert.Equal(new[] { ("2", 1) }, education.TierBracket.Tiers.Select(t => (t.Id, t.Count)));
		}

		[Fact]
		public void TheWholeCatalogPublishesNoTabsAndKeepsItsDefaultGrouping()
		{
			// The row draws All alone with no menu, so a tab there is work nothing shows. The strip's
			// axis still answers, because the default grouping reads it.
			foreach (var query in new[] { new BuildingCatalogQuery(), new BuildingCatalogQuery(SearchText: "a") })
			{
				var view = Unscoped(query);

				Assert.Empty(view.StripTabs);
				Assert.Empty(view.ExpandedCategories);
				Assert.Equal(StripAxes.Development, view.StripAxis);
				Assert.Equal(BuildingCatalogGrouping.Development, view.EffectiveGroupBy);
			}
		}

		[Fact]
		public void TheStripsAxisIsChosenWithoutLookingUpATabsPicture()
		{
			// Only a tab's picture reads the whole menu, which the pack scope supplies when a pack is
			// picked: a count of its calls counts the picture lookups.
			var lookups = 0;
			IReadOnlyList<BuildingCatalogEntry> Whole() { lookups++; return Everything; }

			var unscoped = Unscoped(new BuildingCatalogQuery(SearchText: "Wind"), Whole);
			_ = unscoped.StripAxis; _ = unscoped.EffectiveGroupBy; _ = unscoped.StripTabs; _ = unscoped.ExpandedCategories;
			var power = new CatalogView(Power, new BuildingCatalogQuery(UiMenu: "Electricity"), packScope: Whole);
			_ = power.StripAxis;

			Assert.Equal(0, lookups);
			Assert.Equal(StripAxes.Development, power.StripAxis);

			// The tabs themselves look their pictures up, from the one whole menu.
			_ = power.StripTabs;
			Assert.Equal(1, lookups);
		}

		[Fact]
		public void EveryDrawnTabIsCountedInOneWalkAsAClickMatchesIt()
		{
			// Branches, asset types and densities in one row, some rows spelt in another case than
			// their tab, and one tab nothing matches.
			var rows = new[]
			{
				Entry(61, "Low A", "Buildings", "Zones", "ZonesResidential") with { ZoneType = ZoneTypeFilter.Low, DevTreeBranch = "Housing" },
				Entry(62, "Low B", "Buildings", "Zones", "zonesresidential") with { ZoneType = ZoneTypeFilter.Low },
				Entry(63, "High", "Buildings", "Zones", "ZonesResidential") with { ZoneType = ZoneTypeFilter.High },
				Entry(64, "Pipe", "Networks", "Water", "Water") with { DevTreeBranch = "housing" },
				Entry(65, "Pump", "ServiceBuildings", "Water", "Water"),
			};
			var tabs = new[]
			{
				"Housing",
				StripAxes.NetworkValue,
				StripAxes.BuildingValue,
				StripAxes.DensityTab.Format("ZonesResidential", BuildingCatalogLabels.DensityTier(ZoneTypeFilter.Low)),
				StripAxes.DensityTab.Format("ZonesResidential", BuildingCatalogLabels.DensityTier(ZoneTypeFilter.Medium)),
				"Nothing",
			};
			var counting = new CountingList(rows);

			var counts = BuildingCatalogQueryEngine.StripCounts(counting, tabs);

			Assert.Equal(tabs.Select(tab => rows.Count(row => BuildingCatalogQueryEngine.StripMatches(row, tab))), counts);
			Assert.Equal(new[] { 2, 1, 4, 2, 0, 0 }, counts);
			Assert.Equal(1, counting.Walks);
		}

		[Fact]
		public void EveryPropertyWalksTheSnapshotOnce()
		{
			// The point of the view: one pass over the snapshot per refresh, plus
			// cheap passes over the much smaller menu set.
			var counting = new CountingList(Fixture);
			var view = new CatalogView(counting, new BuildingCatalogQuery(UiMenu: "Electricity"));

			_ = view.Page; _ = view.MetricBounds; _ = view.FacetState; _ = view.MenuCategoryCounts;
			_ = view.StripAxis; _ = view.StripTabs; _ = view.ExpandedCategories; _ = view.TierBracket;
			_ = view.StripAxis; _ = view.MenuCategoryCounts; _ = view.Page;

			Assert.Equal(1, counting.Walks);
		}
	}
}
