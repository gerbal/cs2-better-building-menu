using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Which menus open on All: those whose view is Cards, and the small menus the UI names.</summary>
	public sealed class OpensOnAllTests
	{
		[Fact]
		public void TheUisSetSplitsOnLineBreaksAndSkipsBlankNames()
		{
			Assert.Equal(new[] { "Garbage Management", "Water & Sewage" }, OpensOnAll.Parse("Garbage Management\nWater & Sewage\n\n  \n").OrderBy(name => name, StringComparer.Ordinal));
			Assert.Empty(OpensOnAll.Parse(null));
			Assert.Empty(OpensOnAll.Parse(string.Empty));
		}

		[Fact]
		public void AMenuTheUiNamesOpensOnAllAndNoOther()
		{
			var small = OpensOnAll.Parse("Garbage Management");

			Assert.True(OpensOnAll.For("Garbage Management", small, MenuPicks.None, BodyViews.Auto));
			Assert.False(OpensOnAll.For("Roads", small, MenuPicks.None, BodyViews.Auto));
			Assert.False(OpensOnAll.For(string.Empty, small, MenuPicks.None, BodyViews.Cards));
		}

		[Fact]
		public void TheSystemNamesNoMenuUntilTheUiSendsItsSet()
		{
			// The UI names a menu only once C# has counted it, so the set is empty until then.
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");

			Assert.Contains("private IReadOnlyCollection<string> _menusOpeningOnAll = Array.Empty<string>();", system);
			Assert.False(OpensOnAll.For("Garbage Management", Array.Empty<string>(), MenuPicks.None, BodyViews.Auto));
		}

		[Theory]
		[InlineData("Roads=cards", "auto", true)]
		[InlineData("", "cards", true)]
		[InlineData("Roads=list", "cards", false)]
		[InlineData("Roads=icons", "cards", false)]
		[InlineData("Roads=grid", "cards", true)]
		[InlineData("Parks & Recreation=cards", "auto", false)]
		[InlineData("", "auto", false)]
		public void AMenuWhoseViewIsCardsOpensOnAll(string menuViews, string defaultView, bool onAll)
		{
			Assert.Equal(onAll, OpensOnAll.For("Roads", OpensOnAll.Parse(null), menuViews, defaultView));
		}

		[Fact]
		public void AnIconsWithNamesPickCountsAsAPickInDeveloperModeOnly()
		{
			// In developer mode the pick draws the icons, so Default view's Cards no longer opens the menu on All.
			Assert.False(OpensOnAll.For("Roads", OpensOnAll.Parse(null), "Roads=iconsNamed", BodyViews.Cards, developerMode: true));
			Assert.True(OpensOnAll.For("Roads", OpensOnAll.Parse(null), "Roads=iconsNamed", BodyViews.Cards));
		}

		[Fact]
		public void TheSystemKeepsTheUisSmallListsAndRedrawsTheOpenMenuWhenItsOwnChanges()
		{
			// The UI names a small menu's list once C# has counted the menu, which is while it is open.
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");
			var handler = ModSource.Member(system, "private void SetMenusDrawingNoGroups(");

			Assert.Contains("private IReadOnlyCollection<string> _menusDrawingNoGroups = Array.Empty<string>();", system);
			Assert.Contains("CreateTrigger<string>(\"SetMenusDrawingNoGroups\", SetMenusDrawingNoGroups);", system);
			Assert.Contains("OpensOnAll.Parse(joined)", handler);
			Assert.Contains("_menusDrawingNoGroups = named;", handler);
			Assert.Contains("RefreshBuildingCatalog();", handler);
		}

		[Fact]
		public void EveryOpenAsksTheRuleWithTheUisSetAndTheStoredViews()
		{
			var takeover = ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs");

			Assert.Contains("OpensOnAll.For(menuName, _menusOpeningOnAll, Mod.Settings.MenuViews, Mod.Settings.DefaultView, Knobs.DeveloperMode)", takeover);
			Assert.Contains(".Opening(armed, onAll)", takeover);
		}
	}
}
