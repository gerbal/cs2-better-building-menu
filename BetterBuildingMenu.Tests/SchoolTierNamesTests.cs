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

		private static PrefabIndex School(int id, int level, string name, int order = 0, int dlc = GameDlcIds.BaseGame, bool vanilla = true)
		{
			var entry = TestPrefabs.Named(id, "School" + id, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_EducationResearch, name);
			entry.EducationLevel = level;
			entry.UIOrder = order;
			entry.DlcId = Dlc(dlc);
			entry.IsVanilla = vanilla;
			return entry;
		}

		[Fact]
		public void EachLevelIsNamedAfterItsBaseGameSchool()
		{
			var index = TestPrefabs.ReadyIndex(
				School(1, 1, "Grundschule"),
				School(2, 2, "Gymnasium"),
				School(3, 3, "Hochschule"),
				School(4, 4, "Universität"));

			Assert.Equal(
				new[] { (1, "Grundschule"), (2, "Gymnasium"), (3, "Hochschule"), (4, "Universität") },
				index.SchoolTierNames().OrderBy(pair => pair.Key).Select(pair => (pair.Key, pair.Value)));
		}

		[Fact]
		public void OnlyTheBaseGameNamesALevel()
		{
			// A DLC's school, a mod's and an upgrade each carry their own name, not the level's. The
			// mod's is one that declares base-game content, so only its not being the game's own rules it out.
			var upgrade = School(4, 1, "Erweiterungsflügel", order: -1);
			upgrade.IsServiceUpgrade = true;

			var index = TestPrefabs.ReadyIndex(
				School(1, 1, "Grundschule", order: 10),
				School(2, 1, "Waldorfschule", order: 0, dlc: 7),
				School(3, 1, "Modschule", order: 0, vanilla: false),
				upgrade,
				School(5, 2, "Kunstakademie", dlc: 7));

			var names = index.SchoolTierNames();

			Assert.Equal("Grundschule", names[1]);
			Assert.False(names.ContainsKey(2));
		}

		[Fact]
		public void TheFirstInVanillasMenuOrderAnswersThenTheLowerId()
		{
			var index = TestPrefabs.ReadyIndex(
				School(1, 1, "Später", order: 20),
				School(2, 1, "Zuerst", order: 10),
				School(4, 2, "Höhere Id", order: 5),
				School(3, 2, "Niedrigere Id", order: 5));

			var names = index.SchoolTierNames();

			Assert.Equal("Zuerst", names[1]);
			Assert.Equal("Niedrigere Id", names[2]);
		}

		[Fact]
		public void TheNameIsTheUnnumberedOne()
		{
			// Two assets with one name are numbered for the list; the level takes the name itself.
			var school = School(1, 1, "Grundschule");
			school.Name = "Grundschule 2";

			Assert.Equal("Grundschule", TestPrefabs.ReadyIndex(school).SchoolTierNames()[1]);
		}

		private static BuildingCatalogEntry Row(int id, int? level) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "School" + id, Name: "School " + id, Category: "ServiceBuildings", SubCategory: "ServiceBuildings_EducationResearch",
				Thumbnail: "", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Education & Research", UiCategory = "Education", EducationLevel = level };

		private static readonly BuildingCatalogEntry[] Rows = { Row(1, 1), Row(2, 2), Row(3, 3) };

		private static readonly Dictionary<int, string> German = new() { [1] = "Grundschule", [2] = "Gymnasium" };

		[Fact]
		public void TheTierTabsSayTheGamesNamesAndEnglishForALevelWithoutOne()
		{
			var view = new CatalogView(Rows, new BuildingCatalogQuery(UiMenu: "Education & Research"), educationMenu: true, schoolTierNames: German);

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
				schoolTierNames: German);

			Assert.Equal(
				new[] { "Grundschule", "Gymnasium", "College" },
				view.Page.Items.Select(item => Assert.Single(item.GroupPath ?? new string[0])));
		}
	}
}
