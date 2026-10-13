using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The families in a view: three rows or more whose names differ only in a trailing variant token.</summary>
	public sealed class FamiliesTests
	{
		private static BuildingCatalogEntry Row(int id, string name) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Prefab" + id, Name: name, Category: "Props", SubCategory: "Props_Nature",
				Thumbnail: "", LotWidth: 0, LotDepth: 0, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
			with { UiMenu = "Landscaping", UiCategory = "PropsNature", UIOrder = id };

		private static string Of(IReadOnlyList<BuildingCatalogEntry> rows, int id) =>
			Families.Of(rows).TryGetValue(id, out var member) ? $"{member.Key}|{member.Token}" : "";

		[Fact]
		public void BouldersOneToEightAreAFamilyOfEight()
		{
			var rows = Enumerable.Range(1, 8).Select(n => Row(n, $"Boulder 0{n}")).Append(Row(9, "Boulder Random")).ToArray();
			var families = Families.Of(rows);

			Assert.Equal(8, families.Count);
			Assert.All(Enumerable.Range(1, 8), n => Assert.Equal($"Boulder|0{n}", Of(rows, n)));
			// "Random" is no variant token: the row is a look-alike, not a member.
			Assert.Equal("", Of(rows, 9));
		}

		[Theory]
		[InlineData("Boardwalk 2x2", "Boardwalk", "2x2")]
		[InlineData("Boardwalk 2x", "Boardwalk", "2x")]
		[InlineData("Pier Section 2b", "Pier Section", "2b")]
		[InlineData("Flag B", "Flag", "B")]
		[InlineData("BeachRaft01", "BeachRaft", "01")]
		[InlineData("Beach Raft02b", "Beach Raft", "02b")]
		[InlineData("Mk-2", "Mk", "2")]
		[InlineData("Street-lamp-01", "Street-lamp", "01")]
		public void AVariantTokenIsANumberWithALetterALetterOrASize(string name, string stem, string token)
		{
			Assert.True(Families.TrySplit(name, out var split, out var word));
			Assert.Equal(stem, split);
			Assert.Equal(token, word);
		}

		[Theory]
		[InlineData("Boulder Random")]
		[InlineData("Stadium Light 70ft")]
		[InlineData("05")]
		[InlineData("GTZBench")]
		[InlineData("Boulder \u0661\u0662")]
		[InlineData("Raft\u0661\u0662")]
		[InlineData("")]
		[InlineData(null)]
		public void ANameEndingInNoTokenOrAllTokenSplitsNot(string? name)
		{
			Assert.False(Families.TrySplit(name, out _, out _));
		}

		[Fact]
		public void TwoRowsAreNoFamilyAndAStemMatchesWhateverItsCase()
		{
			var two = new[] { Row(1, "Four-Lane Road 1"), Row(2, "Four-Lane Road 2"), Row(3, "Alley") };
			var three = new[] { Row(1, "Garden Bench 01"), Row(2, "garden bench 02"), Row(3, "Garden  Bench 03") };

			Assert.Empty(Families.Of(two));
			// The key is the stem as the family's first row spells it, the same for every member.
			Assert.Equal(new[] { "Garden Bench|01", "Garden Bench|02", "Garden Bench|03" }, new[] { 1, 2, 3 }.Select(id => Of(three, id)));
		}

		[Fact]
		public void APagesRowsCarryTheirFamilyPastTheWindow()
		{
			var rows = new[] { Row(1, "Cairn 01"), Row(2, "Alley"), Row(3, "Cairn 02"), Row(4, "Cairn 03") };

			var page = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Landscaping", Limit: 1));
			var first = Assert.Single(page.Items);

			Assert.Equal("01", first.FamilyToken);
			Assert.Equal("Cairn", first.FamilyKey);
		}

		[Fact]
		public void RowsFoldedAwayAsLockedStillCountTowardAFamily()
		{
			// Two of the three Cairns, and the Alley, are locked: folded away, they leave the window but not the count.
			var rows = new[] { Row(1, "Cairn 01"), Row(2, "Cairn 02") with { IsLocked = true }, Row(3, "Cairn 03") with { IsLocked = true }, Row(4, "Alley") with { IsLocked = true } };

			var page = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Landscaping", UiCategory: "PropsNature", LockedCollapsed: true));
			var shown = Assert.Single(page.Items);

			Assert.Equal(1, shown.Id);
			Assert.Equal(("01", "Cairn"), (shown.FamilyToken, shown.FamilyKey));
		}

		[Fact]
		public void ANullRowAndANullListAreNoFamilyAndNoError()
		{
			var rows = new[] { Row(1, "Cairn 01"), null!, Row(2, "Cairn 02"), Row(3, "Cairn 03") };

			Assert.Equal(3, Families.Of(rows).Count);
			Assert.Empty(Families.Of(null!));
		}

		[Fact]
		public void APageOnlyCountedCarriesNoFamilies()
		{
			var rows = new[] { Row(1, "Cairn 01"), Row(2, "Cairn 02"), Row(3, "Cairn 03") };

			var page = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Landscaping", WithFacts: false));

			Assert.Equal(3, page.TotalCount);
			Assert.All(page.Items, item => Assert.Null(item.FamilyToken));
			Assert.All(page.Items, item => Assert.Null(item.FamilyKey));
		}

		[Fact]
		public void AnEntryWritesItsFamilyForTheUi()
		{
			var writer = new RecordingJsonWriter();

			(Row(1, "Cairn 02") with { FamilyToken = "02", FamilyKey = "Cairn" }).Write(writer);

			Assert.Contains("familyToken", writer.PropertyNames);
			Assert.Contains("familyKey", writer.PropertyNames);
			Assert.Contains("Write:String:02", writer.Tokens);
			Assert.Contains("Write:String:Cairn", writer.Tokens);
		}
	}
}
