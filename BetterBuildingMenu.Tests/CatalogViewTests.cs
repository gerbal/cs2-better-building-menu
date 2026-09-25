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

		[Theory]
		[InlineData(false)]
		[InlineData(true)]
		public void TheContentFacetShowsTheGamesVanillaToggle(bool vanillaSelected)
		{
			// The adapter reads the toggle from the toolbar selection the panel holds and
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
			Assert.Empty(electricity.SchoolTierCounts);

			var education = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Education & Research"));
			Assert.Equal(new[] { ("2", 1) }, education.SchoolTierCounts.Select(t => (t.Id, t.Count)));
		}

		[Fact]
		public void EveryPropertyWalksTheSnapshotOnce()
		{
			// The point of the view: one pass over the snapshot per refresh, plus
			// cheap passes over the much smaller menu set.
			var counting = new CountingList(Fixture);
			var view = new CatalogView(counting, new BuildingCatalogQuery(UiMenu: "Electricity"));

			_ = view.Page; _ = view.MetricBounds; _ = view.FacetState; _ = view.MenuCategoryCounts;
			_ = view.StripAxis; _ = view.StripTabs; _ = view.ExpandedCategories; _ = view.SchoolTierCounts;
			_ = view.StripAxis; _ = view.MenuCategoryCounts; _ = view.Page;

			Assert.Equal(1, counting.Walks);
		}
	}
}
