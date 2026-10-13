using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Education's levels inside the tab that holds its schools: which tab, what each level counts, and how a pick reaches C#.</summary>
	public sealed class TierBracketTests
	{
		private const string Education = "Education & Research";
		private const string Locked = BuildingCatalogFacetSelection.Availability.Locked;

		private static BuildingCatalogEntry School(int id, string tab, int? level, bool locked = false) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "School" + id, Name: "School " + id, Category: "ServiceBuildings", SubCategory: "ServiceBuildings_EducationResearch",
				Thumbnail: "", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = Education, UiCategory = tab, EducationLevel = level, IsLocked = locked };

		/// <summary>The game's schools under its tab, one a mod files under another, and research with no level.</summary>
		private static readonly BuildingCatalogEntry[] Schools =
		{
			School(1, "Education", 1),
			School(2, "Education", 2, locked: true),
			School(3, "Education", 2),
			School(4, "Education", 4, locked: true),
			School(5, "ModSchools", 1),
			School(6, "Research", null),
		};

		private static TierBracket Bracket(BuildingCatalogQuery query) =>
			new CatalogView(Schools, query, educationMenu: true).TierBracket;

		[Fact]
		public void TheLevelsSitInTheTabHoldingTheMostSchoolsAndAddUpToIt()
		{
			var bracket = Bracket(new BuildingCatalogQuery(UiMenu: Education));

			Assert.Equal("Education", bracket.ParentCategory);
			Assert.Equal(4, bracket.ParentCount);
			// The mod's elementary school sits under its own tab, so this tab's levels leave it out.
			Assert.Equal(new[] { ("1", 1), ("2", 2), ("4", 1) }, bracket.Tiers.Select(tier => (tier.Id, tier.Count)));
		}

		[Fact]
		public void ALevelTheFiltersEmptyStaysAtZero()
		{
			var bracket = Bracket(new BuildingCatalogQuery(UiMenu: Education, Availability: new[] { Locked }));

			Assert.Equal(2, bracket.ParentCount);
			Assert.Equal(new[] { ("1", 0), ("2", 1), ("4", 1) }, bracket.Tiers.Select(tier => (tier.Id, tier.Count)));
		}

		[Fact]
		public void ALevelsCountIsWhatAClickOnItLists()
		{
			// A strip tab, a filter and a search on. The levels count past the strip tab, as every
			// tab does, so a level's pick must clear it, as a tab's own pick does.
			var schools = new[]
			{
				School(1, "Education", 1) with { Name = "Small Elementary", DevTreeBranch = "Primary" },
				School(2, "Education", 1, locked: true) with { Name = "Elementary", DevTreeBranch = "Primary" },
				School(3, "Education", 2, locked: true) with { Name = "High School", DevTreeBranch = "Secondary" },
				School(4, "Education", 2, locked: true) with { Name = "Elite High", DevTreeBranch = "Secondary" },
				School(5, "Education", 4, locked: true) with { Name = "University", DevTreeBranch = "Higher" },
			};
			var state = AssetMenuState.Initial
				.SelectMenu(Education)
				.SelectStripTab("Primary")
				.ToggleFacet(FacetIds.Availability, Locked)
				.Search("e");
			var bracket = new CatalogView(schools, state.Query, educationMenu: true).TierBracket;

			Assert.Equal(new[] { ("1", 1), ("2", 1), ("4", 1) }, bracket.Tiers.Select(tier => (tier.Id, tier.Count)));
			foreach (var tier in bracket.Tiers)
			{
				var picked = state.SelectSchoolTier(int.Parse(tier.Id, System.Globalization.CultureInfo.InvariantCulture), bracket.ParentCategory);

				Assert.Equal(tier.Count, new CatalogView(schools, picked.Query, educationMenu: true).Page.TotalCount);
			}
		}

		[Fact]
		public void AMenuWithNoSchoolsHasNoLevels()
		{
			// Outside Education, and in an Education holding no school with a level.
			Assert.Equal(string.Empty, new CatalogView(Schools, new BuildingCatalogQuery(UiMenu: Education)).TierBracket.ParentCategory);
			Assert.Empty(new CatalogView(new[] { School(6, "Research", null) }, new BuildingCatalogQuery(UiMenu: Education), educationMenu: true).TierBracket.Tiers);
		}

		[Fact]
		public void TheBracketWritesItsTabItsCountAndItsLevels()
		{
			var writer = new RecordingJsonWriter();

			Bracket(new BuildingCatalogQuery(UiMenu: Education)).Write(writer);

			Assert.Equal(
				new[] { "parentCategory", "parentCount", "tiers", "id", "count", "icon", "label", "id", "count", "icon", "label", "id", "count", "icon", "label" },
				writer.PropertyNames);
			Assert.Contains("Write:String:Education", writer.Tokens);
			Assert.Contains("ArrayBegin:3", writer.Tokens);
		}

		[Fact]
		public void ALevelsPickCarriesTheTabTheLastRefreshFound()
		{
			// The trigger keeps its one argument: C# knows the tab from the bracket it published.
			Assert.Contains(
				"SetAssetMenuSchoolTier(int tier) => ApplyTabPick(_assetMenu.SelectSchoolTier(tier, _tierParent, ArmedEntryId()));",
				ModSource.Text("Systems/BuildingMenuUISystem.Query.cs"));
			Assert.Contains("_tierParent = view.TierBracket.ParentCategory;", ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"));
		}
	}
}
