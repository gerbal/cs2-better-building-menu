using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Each menu's own picks as a setting stores them, one "Menu=value" line each.</summary>
	public sealed class MenuPicksTests
	{
		[Fact]
		public void ALineSplitsOnItsLastEqualsSoMenuNamesKeepTheirOwn()
		{
			var picks = MenuPicks.Parse("Parks & Recreation=list\nRoads=tiles\nOdd = name=cards");

			Assert.Equal(
				new[] { new MenuPick("Parks & Recreation", "list"), new MenuPick("Roads", "tiles"), new MenuPick("Odd = name", "cards") },
				picks);
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("Roads")]
		[InlineData("=list")]
		[InlineData("Roads=")]
		public void ALineWithoutAMenuAValueOrAnEqualsIsSkipped(string? stored)
		{
			Assert.Empty(MenuPicks.Parse(stored));
		}

		[Fact]
		public void ALineAHandEditEndedWithACarriageReturnReadsAsItsValue()
		{
			Assert.Equal(new[] { new MenuPick("Roads", "theme"), new MenuPick("Zones", "cost") }, MenuPicks.Parse("Roads=theme\r\nZones=cost\r\n"));
		}

		[Fact]
		public void AMenusPickIsReadByItsTrimmedName()
		{
			Assert.Equal("theme", MenuPicks.Get("Roads=theme", " Roads "));
		}

		[Fact]
		public void AMenuNamedTwiceKeepsItsLastPick()
		{
			Assert.Equal(new[] { new MenuPick("Roads", "cards") }, MenuPicks.Parse("Roads=list\nRoads=cards"));
		}

		[Fact]
		public void AMenusPickIsReadByItsExactName()
		{
			const string Stored = "Roads=tiles\nParks & Recreation=list";

			Assert.Equal("list", MenuPicks.Get(Stored, "Parks & Recreation"));
			Assert.Equal(MenuPicks.None, MenuPicks.Get(Stored, "roads"));
			Assert.Equal(MenuPicks.None, MenuPicks.Get(null, "Roads"));
		}

		[Fact]
		public void APickReplacesTheMenusOwnAndKeepsTheOthersInOrder()
		{
			Assert.Equal("Parks & Recreation=list\nRoads=cards", MenuPicks.With("Roads=tiles\nParks & Recreation=list", "Roads", "cards"));
			Assert.Equal("Roads=tiles\nZones=list", MenuPicks.With("Roads=tiles", "Zones", "list"));
		}

		[Fact]
		public void NoPickTakesTheMenusOwnAway()
		{
			Assert.Equal("Roads=tiles", MenuPicks.With("Roads=tiles\nZones=list", "Zones", MenuPicks.None));
			Assert.Equal(MenuPicks.None, MenuPicks.With(null, "Zones", MenuPicks.None));
		}

		[Theory]
		[InlineData("", "list")]
		[InlineData("Roads", "")]
		[InlineData("Ro\nads", "list")]
		[InlineData("Roads", "li\nst")]
		[InlineData("Roads", "li=st")]
		public void APickThatCannotBeALineIsNotStored(string menu, string value)
		{
			Assert.Equal("Zones=list", MenuPicks.With("Zones=list", menu, value));
		}

		[Fact]
		public void AGroupPickOfTheMenusOwnDefaultTakesItsPickAway()
		{
			Assert.Equal(MenuPicks.None, MenuPicks.WithGroup("Roads=cost", "Roads", "menuCategory", "menuCategory"));
			Assert.Equal("Roads=theme", MenuPicks.WithGroup("Roads=cost", "Roads", "theme", "menuCategory"));
		}

		[Fact]
		public void AMenusPickReachesTheUiAsMenuAndValue()
		{
			var writer = new RecordingJsonWriter();

			new MenuPick("Roads", "tiles").Write(writer);

			Assert.Equal(new[] { "menu", "value" }, writer.PropertyNames);
		}
	}
}
