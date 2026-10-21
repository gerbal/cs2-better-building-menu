using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>How a search term scores against an entry.</summary>
	public sealed class BuildingCatalogRelevanceTests
	{
		private static BuildingCatalogEntry E(int id, string name, string category = "", string sub = "") =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name.Replace(" ", string.Empty), Name: name, Category: category, SubCategory: sub,
				Thumbnail: "", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "");

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
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Some Building") with { PdxModsId = "12345" }, "12345") > 0);
		}

		[Fact]
		public void FindsABuildingByItsCategory()
		{
			Assert.True(BuildingCatalogRelevance.Score(E(1, "Some Building", "ServiceBuildings", "Health"), "health") > 0);
		}

		[Fact]
		public void RanksWordsInAnyOrderBelowThePhraseAndAboveAnotherField()
		{
			var phrase = BuildingCatalogRelevance.Score(E(1, "Police Station"), "police station");
			var reordered = BuildingCatalogRelevance.Score(E(1, "Police Station"), "station police");
			var spread = BuildingCatalogRelevance.Score(E(2, "Police Station") with { PdxModsId = "158589" }, "police 158589");

			Assert.Equal(BuildingCatalogRelevance.Exact, phrase);
			Assert.Equal(BuildingCatalogRelevance.AllWords, reordered);
			Assert.Equal(BuildingCatalogRelevance.Field, spread);
			Assert.True(BuildingCatalogRelevance.Substring > BuildingCatalogRelevance.AllWords);
			Assert.True(BuildingCatalogRelevance.AllWords > BuildingCatalogRelevance.Field);
		}

		[Fact]
		public void ScoresAnAccentedNameAsIfTypedWithItsAccents()
		{
			Assert.Equal(BuildingCatalogRelevance.Exact, BuildingCatalogRelevance.Score(E(1, "Café"), "cafe"));
			Assert.Equal(BuildingCatalogRelevance.Prefix, BuildingCatalogRelevance.Score(E(1, "Straße 1"), "strasse"));
		}

		[Fact]
		public void CollapsesTheSpacesInsideAQuery()
		{
			Assert.Equal(BuildingCatalogRelevance.Exact, BuildingCatalogRelevance.Score(E(1, "Big Park"), "big   park"));
		}
	}
}
