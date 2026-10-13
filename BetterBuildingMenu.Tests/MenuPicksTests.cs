using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

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

		[Theory]
		// Reset took the open menu's pick away while it drew it: the menu's own grouping again, now.
		[InlineData("", "cost", "category", "")]
		// Options wrote a pick the open menu does not draw.
		[InlineData("theme", "", "category", "theme")]
		[InlineData("theme", "cost", "category", "theme")]
		// A menu with no groups by default: no pick is none, whatever it drew.
		[InlineData("", "cost", "", "")]
		public void TheOpenMenuRegroupsWhereItsStoredPickDrawsAnotherGrouping(string stored, string drawn, string menuDefault, string regroup)
		{
			Assert.Equal(regroup, MenuPicks.Regroup(stored, drawn, menuDefault));
		}

		[Theory]
		// The pick just saved, already drawn: the menu's default stored as no pick draws the same.
		[InlineData("", "category", "category")]
		[InlineData("", "", "category")]
		[InlineData("cost", "cost", "category")]
		[InlineData("", "", "")]
		public void TheOpenMenuKeepsItsGroupingWhereItsStoredPickDrawsTheSame(string stored, string drawn, string menuDefault)
		{
			Assert.Null(MenuPicks.Regroup(stored, drawn, menuDefault));
		}

		[Fact]
		public void AResetOnASmallMenuOfOneTabRegroupsToNoneNotToItsAxis()
		{
			// The default is the one the refresh notes: the view's own GroupFor, with the menu drawn as a list
			// with no groups. A menu drawing a pick returns to none, not to the axis the whole menu groups by.
			var view = new CatalogView(new BuildingCatalogEntry[0], new BuildingCatalogQuery(UiMenu: "Mixed"));
			var menuDefault = view.GroupFor(string.Empty, null, drawsNoGroups: true);

			Assert.Equal(BuildingCatalogGrouping.None, menuDefault);
			Assert.NotEqual(BuildingCatalogGrouping.None, view.GroupFor(string.Empty, null));
			Assert.Equal(MenuPicks.None, MenuPicks.Regroup(MenuPicks.None, BuildingCatalogGrouping.Development, menuDefault));
			Assert.Null(MenuPicks.Regroup(MenuPicks.None, BuildingCatalogGrouping.None, menuDefault));
		}

		[Fact]
		public void AStoredGroupChangeRegroupsTheOpenMenuAndAPickIsDrawnBeforeItIsSaved()
		{
			// Reset clears every pick and saves: the open menu follows at once, not on its next open. A pick
			// of the player's is drawn before it is saved, so its own save regroups nothing a second time.
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");
			var applied = ModSource.Member(system, "private void OnSettingsApplied(");
			var pick = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Query.cs"), "private void SetBuildingCatalogGroupBy(");

			Assert.Contains("MenuPicks.Regroup(MenuPicks.Get(Mod.Settings.MenuGroups, _assetMenu.Menu), _assetMenu.Query.GroupBy, _menuDefaultGroup)", applied);
			Assert.True(
				pick.IndexOf("Apply(_assetMenu.SetGroupBy(groupBy));", StringComparison.Ordinal) < pick.IndexOf("Mod.Settings.ApplyAndSave();", StringComparison.Ordinal),
				"the pick is drawn before it is saved");
		}

		[Fact]
		public void AResetRefreshesTheOpenMenuOnceAndAClosedMenuNotAtAll()
		{
			// The regroup is one Apply, which refreshes once and not at all where nothing changed, and only
			// an open menu takes it: a closed menu reads its stored pick when it opens.
			var applied = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied(");
			var start = applied.IndexOf("if (_assetMenuOpen", StringComparison.Ordinal);
			var block = applied.Substring(start, applied.IndexOf("Apply(_assetMenu.SetGroupBy(regroup));", StringComparison.Ordinal) - start);

			Assert.Contains("MenuPicks.Regroup(", block);
			Assert.Equal(1, Count(applied, "Apply(_assetMenu.SetGroupBy("));
			Assert.DoesNotContain("Refresh", block);
		}

		[Fact]
		public void AResetThatMovesAGroupPickAndSaidOnceAtRedrawsTheOpenMenuOnce()
		{
			// The regroup's refresh reads the new share, so the share's own refresh is skipped where it ran.
			var applied = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied(");
			var regroup = applied.IndexOf("Apply(_assetMenu.SetGroupBy(regroup));", StringComparison.Ordinal);
			var share = applied.IndexOf("if (saidOnceAt != _appliedSaidOnceAt)", StringComparison.Ordinal);

			Assert.True(regroup >= 0 && share > regroup, "the regroup runs before the share's refresh");
			Assert.Contains("redrawn = !ReferenceEquals(before, _assetMenu);", applied);
			Assert.Contains("if (_assetMenuOpen && !redrawn)", applied.Substring(share));
			Assert.Equal(1, Count(applied.Substring(share), "RefreshBuildingCatalog();"));
		}

		private static int Count(string text, string needle)
		{
			var count = 0;

			for (var at = text.IndexOf(needle, StringComparison.Ordinal); at >= 0; at = text.IndexOf(needle, at + needle.Length, StringComparison.Ordinal))
			{
				count++;
			}

			return count;
		}
	}
}
