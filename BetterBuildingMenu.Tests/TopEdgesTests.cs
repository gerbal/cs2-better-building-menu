using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The Top edge row as the settings keep it: its two values, what any other reads as, and the binding the UI reads.</summary>
	public sealed class TopEdgesTests
	{
		private const double SixteenNine = 1920.0 / 1080.0;

		private static readonly PriorInstall StampOnly = new(null, StampExisted: true);

		[Theory]
		[InlineData("whole", "whole")]
		[InlineData("free", "free")]
		[InlineData(null, "whole")]
		[InlineData("", "whole")]
		[InlineData("Free", "whole")]
		[InlineData("lines", "whole")]
		public void TheTopEdgeKeepsItsTwoValuesAndReadsAnythingElseAsWholeLines(string? value, string read)
		{
			Assert.Equal(read, TopEdges.Sanitize(value));
		}

		[Fact]
		public void TheValuesAreWholeLinesThenFreeAndWholeLinesShips()
		{
			Assert.Equal(new[] { TopEdges.Whole, TopEdges.Free }, TopEdges.Values);
			Assert.Equal(TopEdges.Whole, SettingsDefaults.TopEdge);
		}

		[Fact]
		public void TheRowAndItsValuesSayWhatTheyDoInOnScreenWords()
		{
			Assert.Equal("Top edge", ModSource.English("Options.OPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.TopEdge]"));
			Assert.Equal("Whole lines", ModSource.English("Options.LABEL[BetterBuildingMenu.TopEdgeWhole]"));
			Assert.Equal("Free", ModSource.English("Options.LABEL[BetterBuildingMenu.TopEdgeFree]"));
			Assert.InRange(ModSource.English("Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.TopEdge]").Length, 1, 400);
		}

		[Fact]
		public void TheRowSaysWholeLinesCollapsesTheMenuAndWhatOpensIt()
		{
			var description = ModSource.English("Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.TopEdge]");

			foreach (var words in new[] { "Whole lines", "collapses", "a tab", "typing", "double-click", "Free" })
			{
				Assert.Contains(words, description, StringComparison.Ordinal);
			}
		}

		[Fact]
		public void TheBindingIsNamedOnBothSidesAndTheUiDrawsWholeLinesUntilCSharpAnswers()
		{
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");

			Assert.Contains("CreateBinding(\"AssetMenuTopEdge\", TopEdges.Sanitize(Mod.Settings.TopEdge))", system, StringComparison.Ordinal);
			Assert.Contains($"bindValue<string>(mod.id, \"AssetMenuTopEdge\", \"{SettingsDefaults.TopEdge}\")", ModSource.Text("UI/src/mods/bindings.ts"), StringComparison.Ordinal);
		}

		[Fact]
		public void TheTopEdgeFollowsOptionsAtOnce()
		{
			Assert.Contains(
				"_AssetMenuTopEdge.Value = TopEdges.Sanitize(Mod.Settings.TopEdge);",
				ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied("),
				StringComparison.Ordinal);
		}

		// An upgrader's drag stays where they let go, as it did; a new player's lands on whole lines.
		[Theory]
		[InlineData(true, "free")]
		[InlineData(false, "whole")]
		public void TheTopEdgeStepGivesAnUpgraderFreeAndEveryoneElseWholeLines(bool upgrader, string topEdge)
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.TopEdgeVersion - 1, Upgrader = upgrader };

			var result = SettingsMigration.Migrate(values, new[] { "SettingsVersion" }, StampOnly, SixteenNine, SettingsMigration.TopEdgeVersion);

			Assert.Null(result.Decision);
			Assert.Equal(topEdge, values.TopEdge);
			Assert.Equal(SettingsMigration.TopEdgeVersion, values.SettingsVersion);
		}

		[Fact]
		public void AnUpgradersFreeMovesOnlyOnceAndAPickAtThisVersionIsKept()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current, Upgrader = true, TopEdge = TopEdges.Whole };

			var result = SettingsMigration.Migrate(values, new[] { "SettingsVersion" }, StampOnly, SixteenNine);

			Assert.False(result.Changed);
			Assert.Equal(TopEdges.Whole, values.TopEdge);
		}

		[Fact]
		public void AnUnknownTopEdgeReadsAsWholeLinesOnEveryLoadAndALaterReleasesStaysInItsFile()
		{
			var current = new FakeSettings { SettingsVersion = SettingsMigration.Current, TopEdge = "snappy" };
			var later = new FakeSettings { SettingsVersion = SettingsMigration.Current + 1, TopEdge = "snappy" };

			var result = SettingsMigration.Migrate(current, Array.Empty<string>(), StampOnly, SixteenNine);
			var kept = SettingsMigration.Migrate(later, Array.Empty<string>(), StampOnly, SixteenNine);

			Assert.Equal(new[] { "TopEdge snappy -> whole" }, result.Changes);
			Assert.False(kept.Changed);
			Assert.Equal("snappy", later.TopEdge);
		}

		[Fact]
		public void ResetPutsWholeLinesBack()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current, Upgrader = true, TopEdge = TopEdges.Free };

			SettingsDefaults.Reset(values);

			Assert.Equal(TopEdges.Whole, values.TopEdge);
		}
	}
}
