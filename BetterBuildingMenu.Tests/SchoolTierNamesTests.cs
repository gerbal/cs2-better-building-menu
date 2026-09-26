using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using Colossal.PSI.Common;

using System.Collections.Generic;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// A school level is called what the game calls its base-game school, in the game's
	/// language, rather than the mod's own English (#67).
	/// </summary>
	public sealed class SchoolTierNamesTests
	{
		private static DlcId Dlc(int id)
		{
			// Set, not constructed: DlcId's statics throw under CI's mock assemblies, and the
			// field is all the index reads.
			var dlc = default(DlcId);
			dlc.id = id;
			return dlc;
		}

		private static PrefabIndex School(int id, string prefabName, int level, string name, int order = 0, int dlc = GameDlcIds.BaseGame, bool vanilla = true)
		{
			var entry = TestPrefabs.Named(id, prefabName, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_EducationResearch, name);
			entry.EducationLevel = level;
			entry.UIOrder = order;
			entry.DlcId = Dlc(dlc);
			entry.IsVanilla = vanilla;
			return entry;
		}

		private static PrefabIndex[] German() => new[]
		{
			School(1, "ElementarySchool01", 1, "Grundschule"),
			School(2, "HighSchool01", 2, "Gymnasium"),
			School(3, "College01", 3, "Hochschule"),
			School(4, "University01", 4, "Universität"),
		};

		private static (int, string)[] Pairs(IReadOnlyDictionary<int, string> names) =>
			names.OrderBy(pair => pair.Key).Select(pair => (pair.Key, pair.Value)).ToArray();

		[Fact]
		public void EachLevelIsNamedAfterItsSchool()
		{
			Assert.Equal(
				new[] { (1, "Grundschule"), (2, "Gymnasium"), (3, "Hochschule"), (4, "Universität") },
				Pairs(TestPrefabs.ReadyIndex(German()).SchoolTierNames()));
		}

		[Fact]
		public void ASchoolBesideItDoesNotNameTheLevelWhereverItSits()
		{
			// The small school first in the menu, the specialisations unique and ahead by id: none
			// of them is the school the level is named after.
			var index = TestPrefabs.ReadyIndex(German().Concat(new[]
			{
				School(5, "ElementarySchool02", 1, "Kleine Grundschule", order: -10),
				School(6, "MedicalUniversity01", 4, "Medizinische Universität", order: -10),
			}).ToArray());

			var names = index.SchoolTierNames();

			Assert.Equal("Grundschule", names[1]);
			Assert.Equal("Universität", names[4]);
		}

		[Fact]
		public void OnlyTheGamesOwnSchoolOfThatLevelAnswers()
		{
			// A mod's asset under the same prefab name, and the game's under it at another level.
			var index = TestPrefabs.ReadyIndex(
				School(1, "ElementarySchool01", 1, "Modschule", dlc: GameDlcIds.Invalid, vanilla: false),
				School(2, "HighSchool01", 3, "Gymnasium"));

			Assert.Empty(index.SchoolTierNames());
		}

		[Fact]
		public void ALevelWhoseSchoolIsMissingIsLeftOut()
		{
			var index = TestPrefabs.ReadyIndex(German().Where(school => school.PrefabName != "HighSchool01").ToArray());

			Assert.Equal(new[] { 1, 3, 4 }, index.SchoolTierNames().Keys.OrderBy(level => level));
		}

		[Fact]
		public void ALevelNamedLikeAnEarlierOneIsLeftOut()
		{
			// The page merges consecutive headings by their text, so two levels under one name
			// would draw as one heading; the later one keeps its English word.
			var schools = German();
			schools[2].AssetName = schools[1].AssetName;

			var names = TestPrefabs.ReadyIndex(schools).SchoolTierNames();

			Assert.Equal("Gymnasium", names[2]);
			Assert.False(names.ContainsKey(3));
		}

		[Fact]
		public void TheNameIsTheUnnumberedOne()
		{
			// Two assets with one name are numbered for the list; the level takes the name itself.
			var schools = German();
			schools[0].Name = "Grundschule 2";

			Assert.Equal("Grundschule", TestPrefabs.ReadyIndex(schools).SchoolTierNames()[1]);
		}

		[Fact]
		public void AFilterThatHidesTheSchoolKeepsItsLevelsName()
		{
			// Through the adapter: the names come from the whole index, so a DLC filter that leaves
			// only a DLC's school at level 1 still names the level after the base game's.
			const string education = "Education & Research";
			var schools = German().Concat(new[] { School(5, "WaldorfSchool01", 1, "Waldorfschule", dlc: 7) }).ToArray();

			foreach (var school in schools)
			{
				school.UiMenuName = education;
				school.UiCategoryName = "Education";
			}
			var menus = new VanillaMenuIndex(
				schools.ToDictionary(school => school.Id, school => new VanillaMenuPlacement(default, education, "Education", CategoryPriority: 0)),
				new Dictionary<int, string>(),
				new Dictionary<string, Unity.Entities.Entity>(),
				System.Array.Empty<VanillaMenuCategory>(),
				new Dictionary<string, List<VanillaMenuCategory>>());
			var index = TestPrefabs.ReadyIndex(new CatalogIndex(menus), schools);

			var tiers = new BuildingCatalogAdapter()
				.Build(
					new CatalogSource(index, new PlacedUniques(), 1),
					new BuildingCatalogQuery(UiMenu: education, DlcIds: new[] { "7" }),
					VanillaToolbarSelection.None)
				.SchoolTierCounts;

			Assert.Equal(new[] { ("1", 1, "Grundschule") }, tiers.Select(tab => (tab.Id, tab.Count, tab.DisplayLabel)));
		}

		private static BuildingCatalogEntry Row(int id, int? level) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "School" + id, Name: "School " + id, Category: "ServiceBuildings", SubCategory: "ServiceBuildings_EducationResearch",
				Thumbnail: "", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Education & Research", UiCategory = "Education", EducationLevel = level };

		private static readonly BuildingCatalogEntry[] Rows = { Row(1, 1), Row(2, 2), Row(3, 3) };

		private static readonly Dictionary<int, string> GermanNames = new() { [1] = "Grundschule", [2] = "Gymnasium" };

		[Fact]
		public void TheTierTabsSayTheGamesNamesAndEnglishForALevelWithoutOne()
		{
			var view = new CatalogView(Rows, new BuildingCatalogQuery(UiMenu: "Education & Research"), educationMenu: true, schoolTierNames: GermanNames);

			Assert.Equal(
				new[] { ("1", "Grundschule"), ("2", "Gymnasium"), ("3", "College") },
				view.SchoolTierCounts.Select(tab => (tab.Id, tab.DisplayLabel)));
		}

		[Fact]
		public void GroupedBySchoolTierTheHeadingsSayTheGamesNames()
		{
			var view = new CatalogView(
				Rows,
				new BuildingCatalogQuery(UiMenu: "Education & Research", GroupBy: BuildingCatalogGrouping.SchoolTier),
				educationMenu: true,
				schoolTierNames: GermanNames);

			Assert.Equal(
				new[] { "Grundschule", "Gymnasium", "College" },
				view.Page.Items.Select(item => Assert.Single(item.GroupPath ?? new string[0])));
		}
	}
}
