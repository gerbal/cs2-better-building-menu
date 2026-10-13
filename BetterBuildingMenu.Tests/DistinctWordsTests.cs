using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The word that tells a row apart from its nearest look-alike, over the whole view.</summary>
	public sealed class DistinctWordsTests
	{
		private static BuildingCatalogEntry Row(int id, string name) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Prefab" + id, Name: name, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 0, LotDepth: 0, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
			with { UiMenu = "Roads", UiCategory = "RoadsMediumRoads", UIOrder = id };

		private static string WordOf(IReadOnlyList<BuildingCatalogEntry> rows, int id) =>
			DistinctWords.Of(rows).TryGetValue(id, out var word) ? word : "";

		[Fact]
		public void EachLookAlikeIsToldApartByTheWordAfterTheWordsItShares()
		{
			var rows = new[] { Row(1, "Covered Pedestrian Bridge"), Row(2, "Covered Bicycle Bridge") };

			Assert.Equal("Pedestrian", WordOf(rows, 1));
			Assert.Equal("Bicycle", WordOf(rows, 2));
		}

		[Fact]
		public void TheNearestLookAlikeIsTheNeighbourSharingTheMostLeadingWords()
		{
			// Four-Lane Road 2 shares three words with Four-Lane Road 1, and one with Four-Lane Drawbridge.
			var rows = new[] { Row(1, "Four-Lane Road 1"), Row(2, "Four-Lane Road 2"), Row(3, "Four-Lane Drawbridge"), Row(4, "Four-Lane Divided Road") };

			Assert.Equal("2", WordOf(rows, 2));
			Assert.Equal("1", WordOf(rows, 1));
			Assert.Equal("Drawbridge", WordOf(rows, 3));
			Assert.Equal("Divided", WordOf(rows, 4));
		}

		[Fact]
		public void ARowWithNoLookAlikeOrWhollyItsLookAlikesHeadHasNone()
		{
			var rows = new[] { Row(1, "Harbour Arch"), Row(2, "Alley"), Row(3, "Harbour Arch Viaduct") };

			// Harbour Arch is all of what it shares; Alley shares no first word.
			Assert.Equal("", WordOf(rows, 1));
			Assert.Equal("", WordOf(rows, 2));
			Assert.Equal("Viaduct", WordOf(rows, 3));
		}

		[Fact]
		public void FirstWordsMatchWhateverTheirCase()
		{
			var rows = new[] { Row(1, "Plain Four-lane Divided Road"), Row(2, "plain Four-Lane Road") };

			Assert.Equal("Divided", WordOf(rows, 1));
			Assert.Equal("Road", WordOf(rows, 2));
		}

		[Fact]
		public void APagesRowsCarryTheWordAgainstLookAlikesTheWindowHasNotReached()
		{
			var rows = new[] { Row(1, "Wide Quay With Four-Lane Road 1"), Row(2, "Alley"), Row(3, "Wide Quay With Four-Lane Road 2") };

			var page = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Roads", Limit: 1));

			Assert.Equal("1", Assert.Single(page.Items).DistinctWord);
		}

		[Fact]
		public void AnEntryWritesItsWordForTheUi()
		{
			var writer = new RecordingJsonWriter();

			(Row(1, "Four-Lane Road 2") with { DistinctWord = "2" }).Write(writer);

			Assert.Contains("distinctWord", writer.PropertyNames);
			Assert.Contains("Write:String:2", writer.Tokens);
		}

		[Fact]
		public void WordsMatchHoweverManySpacesPartThem()
		{
			var rows = new[] { Row(1, "Stadt  Sign 1"), Row(2, "Stadt Bench"), Row(3, "Stadt Sign 2") };

			Assert.Equal("1", WordOf(rows, 1));
			Assert.Equal("Bench", WordOf(rows, 2));
			Assert.Equal("2", WordOf(rows, 3));
		}

		[Fact]
		public void ARowWithNoNameHasNoWordAndLeavesItsLookAlikesTheirs()
		{
			var rows = new[] { Row(1, "Covered Pedestrian Bridge"), Row(2, null!), Row(3, "Covered Bicycle Bridge") };

			Assert.Equal("", WordOf(rows, 2));
			Assert.Equal("Pedestrian", WordOf(rows, 1));
			Assert.Equal("Bicycle", WordOf(rows, 3));
		}
	}
}
