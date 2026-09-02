using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Ported from buildingSearchRank.test.ts's "Match scoring" cases.</summary>
	public sealed class BuildingCatalogRelevanceTests
	{
		private static BuildingCatalogEntry E(int id, string name, string category = "", string sub = "") =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name.Replace(" ", string.Empty), Name: name, Category: category, SubCategory: sub,
				Thumbnail: "", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsUniqueMesh: false, IsVanilla: true, PdxModsId: "");

		[Fact]
		public void RanksAnExactNameAboveAPrefixAboveAWordStartAboveASubstring()
		{
			var q = "clinic";
			var exact = BuildingCatalogRelevance.Score(E(1, "Clinic"), q);
			var prefix = BuildingCatalogRelevance.Score(E(2, "Clinic Center"), q);
			var word = BuildingCatalogRelevance.Score(E(3, "Medical Clinic"), q);
			var substring = BuildingCatalogRelevance.Score(E(4, "Policlinical Wing"), q);

			Assert.True(exact > prefix, "exact beats prefix");
			Assert.True(prefix > word, "prefix beats word start");
			Assert.True(word > substring, "word start beats mid-word substring");
			Assert.True(substring > 0);
		}

		[Fact]
		public void MatchesASubsequenceSoAbbreviationsWork()
		{
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Disease Control Center"), "dcc") > 0);
			Assert.True(BuildingCatalogRelevance.Score(E(2, "Elementary School"), "esc") > 0);
		}

		[Fact]
		public void ScoresASubsequenceBelowAnyRealSubstringMatch()
		{
			var sub = BuildingCatalogRelevance.Score(E(1, "Disease Control Center"), "dcc");
			var real = BuildingCatalogRelevance.Score(E(2, "DCC Depot"), "dcc");

			Assert.True(real > sub);
		}

		[Fact]
		public void IgnoresCaseAndSurroundingSpace()
		{
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Elementary School"), "  ELEMENTARY ") > 0);
		}

		[Fact]
		public void ReturnsZeroWhenNothingMatches()
		{
			Assert.Equal(0, BuildingCatalogRelevance.Score(E(1, "Elementary School"), "hospital"));
			Assert.Equal(0, BuildingCatalogRelevance.Score(E(1, "Elementary School"), "zzz"));
			Assert.Equal(0, BuildingCatalogRelevance.Score(E(1, "Elementary School"), ""));
		}

		[Fact]
		public void MatchesThePrefabNameSoInternalIdsRemainSearchable()
		{
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Fire Station"), "FireStation") > 0);
		}

		[Fact]
		public void MatchesThePdxModsIdWhichTheBackendAlreadySearchesBy()
		{
			// The UI's copy did not, which is how an id search listed in the
			// table and vanished from the grid.
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Some Building") with { PdxModsId = "12345" }, "12345") > 0);
		}

		[Fact]
		public void FindsABuildingByItsCategory()
		{
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Some Building", "ServiceBuildings", "Health"), "health") > 0);
		}
	}
}
