using BetterBuildingMenu.Domain;

using Game.Settings;

using System.IO;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The settings migration over the files earlier releases left: who is an upgrader, the height
	/// and the width as a Width step (version 2), the body under the top row and the control pane
	/// (version 3), then Tile size and Default view (version 4). Every file is loaded twice, as two
	/// launches load it, and the second load changes nothing.
	/// </summary>
	public sealed class SettingsMigrationTests
	{
		private const double SixteenNine = 1920.0 / 1080.0;
		private const double TwentyOneNine = 2520.0 / 1080.0;
		private const double ThirtyTwoNine = 3840.0 / 1080.0;

		private static readonly PriorInstall StampOnly = new(null, StampExisted: true);

		private static PriorInstall MarkerFirstWrittenBy(string release, bool stampBefore, bool stamp) =>
			new(new ReleaseMarkerData(ReleaseMarker.Version, release, release, stampBefore), stamp);

		/// <summary>Two launches: the first migrates and saves by the game's rule, the second loads that save.</summary>
		private static (SettingsMigrationResult First, FakeSettings After, SettingsFile Loaded, string Saved) TwoLoads(
			string? file, PriorInstall prior, double aspect = SixteenNine)
		{
			var loaded = SettingsFile.Read(file);
			var values = loaded.Values with { };
			var first = SettingsMigration.Migrate(values, loaded.Keys, prior, aspect);
			var saved = GameSave.Write(loaded.Keys, values);

			var reloaded = SettingsFile.Read(saved);
			var second = SettingsMigration.Migrate(reloaded.Values, reloaded.Keys, prior, aspect);

			Assert.False(second.Changed, "the second load changed " + string.Join("; ", second.Changes));
			Assert.Equal(values, reloaded.Values);

			return (first, values, loaded, saved);
		}

		// A new player ends at this release's version with the pane off, in Auto.
		[Fact]
		public void AFreshInstallIsANewPlayerAtTheGamesOwnSizeWithThePaneOff()
		{
			var (first, after, _, _) = TwoLoads(null, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.None, string.Empty), first.Decision);
			Assert.Equal(new FakeSettings { SettingsVersion = 4, ControlPaneShown = false }, after);
			Assert.Equal(new[] { "ControlPaneShown True -> False", "SettingsVersion 0 -> 4" }, first.Changes);
		}

		// An upgrader's pane, shown with no key, stays, and with no view kept they open in Cards.
		[Fact]
		public void TheStampAloneMakesAnUpgraderAtTheStepNearestThe1091TheyHad()
		{
			var (first, after, _, _) = TwoLoads(null, StampOnly);

			Assert.Equal(UpgraderSignal.Stamp, first.Decision!.Value.Signal);
			Assert.Equal(new FakeSettings { SettingsVersion = 4, Upgrader = true, AssetMenuWidthStep = 3, DefaultView = BodyViews.Cards }, after);
		}

		// The height ends at the default, which the test reads.
		[Theory]
		[InlineData(SixteenNine, 3)]
		[InlineData(TwentyOneNine, 2)]
		[InlineData(ThirtyTwoNine, 2)]
		public void TheDefaultWidthOpensAtTheStepNearestTheRoomBesideThePane(double aspect, int step)
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Height155Width0PaneShown, PriorInstall.Nothing, aspect);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsKey, "AssetMenuHeight"), first.Decision);
			Assert.Equal(step, after.AssetMenuWidthStep);
			Assert.Equal(AssetMenuHeight.Default, after.AssetMenuHeight);
			Assert.True(after.Upgrader);
		}

		// 420 moves to version 2's 149, then to version 3's 144.25, and the log says both.
		[Fact]
		public void ADraggedNarrowestWidthOpensAtTheFirstStepAndTheDefaultHeightMovesTwice()
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Width735Height420, PriorInstall.Nothing);

			Assert.Equal(UpgraderSignal.SettingsKey, first.Decision!.Value.Signal);
			Assert.Equal(
				new FakeSettings { SettingsVersion = 4, Upgrader = true, AssetMenuHeight = 144.25f, AssetMenuCatalogWidth = 735, AssetMenuWidthStep = 1, DefaultView = BodyViews.Cards },
				after);
			Assert.Equal(
				new[] { "Upgrader False -> True", "AssetMenuHeight 420 -> 149", "AssetMenuHeight 149 -> 144.25", "DefaultView auto -> cards", "SettingsVersion 0 -> 4" },
				first.Changes);
		}

		// From this version, a later version moves nothing but the version.
		[Fact]
		public void AFileAtThisVersionMigratedToALaterOneOnlyMovesTheVersion()
		{
			var values = new FakeSettings { SettingsVersion = 4, Upgrader = true, AssetMenuHeight = 149, AssetMenuWidthStep = 4, AssetMenuTileSize = 120 };

			var result = SettingsMigration.Migrate(values, new[] { "SettingsVersion" }, PriorInstall.Nothing, SixteenNine, SettingsMigration.Current + 1);

			Assert.Null(result.Decision);
			Assert.Equal(149, values.AssetMenuHeight);
			Assert.Equal(4, values.AssetMenuWidthStep);
			Assert.Equal(120, values.AssetMenuTileSize);
			Assert.True(values.Upgrader);
			Assert.Equal(new[] { "SettingsVersion 4 -> 5" }, result.Changes);
		}

		// The file's version 1 moves to this release's with the height at the default.
		[Fact]
		public void TheSameFileAfterTheInterimIsAnUpgraderByItsVersion()
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Width735Height420Version1, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsVersion, "1"), first.Decision);
			Assert.Equal(1, after.AssetMenuWidthStep);
			Assert.Equal(144.25f, after.AssetMenuHeight);
			Assert.Equal("SettingsVersion 1 -> 4", first.Changes.Last());
		}

		public static IEnumerable<object[]> InterimFiles() => new[]
		{
			new object[] { SettingsFixtures.Version1Only, AssetMenuViewMode.None, BodyViews.Cards },
			new object[] { SettingsFixtures.Version1ViewList, "list", BodyViews.List },
		};

		[Theory]
		[MemberData(nameof(InterimFiles))]
		public void TheInterimWithNothingMovedIsAnUpgraderAtTheStepNearest1091(string file, string view, string defaultView)
		{
			var (first, after, _, _) = TwoLoads(file, PriorInstall.Nothing);

			// The view the interim kept stays in the file, and Default view carries it.
			Assert.Equal(UpgraderSignal.SettingsVersion, first.Decision!.Value.Signal);
			Assert.Equal(new FakeSettings { SettingsVersion = 4, Upgrader = true, AssetMenuWidthStep = 3, AssetMenuViewMode = view, DefaultView = defaultView }, after);
		}

		[Fact]
		public void TheMarkerAloneIsAnUpgrader()
		{
			// Back on 0.2.4 after 0.2.5: its next save dropped the version and the view.
			var (first, after, _, _) = TwoLoads(SettingsFixtures.ReplaceOn, MarkerFirstWrittenBy("0.2.5", stampBefore: false, stamp: false));

			Assert.Equal(new UpgraderDecision(UpgraderSignal.Marker, "0.2.5"), first.Decision);
			Assert.Equal(3, after.AssetMenuWidthStep);
		}

		// A new player, so the pane goes off.
		[Fact]
		public void TheRedesignsOwnFirstLaunchWhoseSaveNeverLandedStaysNew()
		{
			var (first, after, _, _) = TwoLoads(null, MarkerFirstWrittenBy(UpgraderTest.FirstRedesignRelease, stampBefore: false, stamp: true));

			Assert.Equal(UpgraderSignal.None, first.Decision!.Value.Signal);
			Assert.Equal(new FakeSettings { SettingsVersion = 4, ControlPaneShown = false }, after);
		}

		[Fact]
		public void TheRedesignsOwnMarkerWithAStampBeforeIsAnUpgrader()
		{
			var (first, after, _, _) = TwoLoads(null, MarkerFirstWrittenBy(UpgraderTest.FirstRedesignRelease, stampBefore: true, stamp: true));

			Assert.Equal(UpgraderSignal.Stamp, first.Decision!.Value.Signal);
			Assert.Equal(3, after.AssetMenuWidthStep);
		}

		public static IEnumerable<object[]> OneKeyFiles() => new[]
		{
			new object[] { SettingsFixtures.PaneHiddenWidth0 },
			new object[] { SettingsFixtures.TileSizeOnly },
			new object[] { SettingsFixtures.ReplaceOff },
			new object[] { SettingsFixtures.NegativeWidth },
		};

		// An upgrader's pane is as they left it, hidden only where they hid it.
		[Theory]
		[MemberData(nameof(OneKeyFiles))]
		public void AnyKeyAnEarlierReleaseDeclaredMakesAnUpgraderAtTheStepNearest1091(string file)
		{
			var (first, after, _, _) = TwoLoads(file, PriorInstall.Nothing);

			Assert.Equal(UpgraderSignal.SettingsKey, first.Decision!.Value.Signal);
			Assert.Equal(3, after.AssetMenuWidthStep);
			Assert.True(after.Upgrader);
			Assert.True(after.ControlPaneShown == (file != SettingsFixtures.PaneHiddenWidth0), "an upgrader keeps the pane as they left it");
		}

		[Fact]
		public void TheDevelopmentBuildsFileIsAnUpgraderOnItsKeysAndCountsTheFourNoPropertyReads()
		{
			var (first, after, loaded, _) = TwoLoads(SettingsFixtures.DevelopmentBuild, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsKey, "ReplaceVanillaBuildMenu"), first.Decision);
			Assert.Equal(4, loaded.UnknownKeys);
			Assert.Equal(new FakeSettings { SettingsVersion = 4, Upgrader = true, AssetMenuWidthStep = 3, DefaultView = BodyViews.Cards }, after);
		}

		[Theory]
		[InlineData(SixteenNine, 4)]
		[InlineData(TwentyOneNine, 2)]
		public void APlayersOwnHeightIsKeptAndTheirWidthBecomesTheNearestStep(double aspect, int step)
		{
			var (_, after, loaded, _) = TwoLoads(SettingsFixtures.PlayerChoices, PriorInstall.Nothing, aspect);

			Assert.Equal(300, after.AssetMenuHeight);
			Assert.Equal(step, after.AssetMenuWidthStep);
			Assert.Equal(1, loaded.UnknownKeys);
		}

		[Fact]
		public void AWidthDraggedToTheEndOfTheRoomOpensAtTheWidestStep()
		{
			Assert.Equal(5, TwoLoads(SettingsFixtures.FullWidthPaneHidden, PriorInstall.Nothing).After.AssetMenuWidthStep);
		}

		// An earlier release's default ends at the default through both steps.
		[Theory]
		[InlineData(420.05f, 144.25f)]
		[InlineData(155.09f, 144.25f)]
		[InlineData(419.8f, 419.8f)]
		[InlineData(200f, 200f)]
		public void OnlyAHeightAnEarlierReleaseShippedMoves(float stored, float expected)
		{
			Assert.Equal(expected, TwoLoads(SettingsFixtures.Height(stored), PriorInstall.Nothing).After.AssetMenuHeight);
		}

		public static IEnumerable<object[]> MigratedFiles() => new[]
		{
			new object[] { SettingsFixtures.MigratedHeight149, 149f },
			new object[] { SettingsFixtures.MigratedHeight420, 420f },
		};

		// At this version, a 149 chosen after the migration stays.
		[Theory]
		[MemberData(nameof(MigratedFiles))]
		public void AFileAtThisVersionIsLeftAlone(string file, float height)
		{
			var (first, after, _, _) = TwoLoads(file, StampOnly);

			Assert.False(first.Changed);
			Assert.Null(first.Decision);
			Assert.Equal(height, after.AssetMenuHeight);
			Assert.Equal(1, after.AssetMenuWidthStep);
		}

		[Fact]
		public void ALaterReleasesVersionIsLeftAlone()
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.LaterVersion, StampOnly);

			Assert.False(first.Changed);
			Assert.Equal(7, after.SettingsVersion);
			Assert.Equal(420, after.AssetMenuHeight);
		}

		// The pane's off, which differs from the initializer's on, reaches the file too.
		[Fact]
		public void TheVersionAndThePaneReachANewPlayersFileAndNothingElse()
		{
			var (_, _, _, saved) = TwoLoads(null, PriorInstall.Nothing);

			Assert.Contains("\"SettingsVersion\": 4", saved);
			Assert.Contains("\"ControlPaneShown\": false", saved);
			Assert.DoesNotContain("AssetMenuWidthStep", saved);
			Assert.DoesNotContain("AssetMenuHeight", saved);
			Assert.DoesNotContain("Upgrader", saved);
		}

		// An upgrader's pane, shown as the initializer has it, writes no key.
		[Fact]
		public void AnUpgradersStepAndFlagReachTheFileAndTheirPaneNeedsNoKey()
		{
			var (_, _, _, saved) = TwoLoads(null, StampOnly);

			Assert.Contains("\"AssetMenuWidthStep\": 3", saved);
			Assert.Contains("\"Upgrader\": true", saved);
			Assert.DoesNotContain("ControlPaneShown", saved);
		}

		// Both steps' moves, in order.
		[Fact]
		public void TheLogLineNamesWhatTheLoadFoundTheSignAndEveryChange()
		{
			var loaded = SettingsFile.Read(SettingsFixtures.Height155Width0PaneShown);
			var result = SettingsMigration.Migrate(loaded.Values, loaded.Keys, PriorInstall.Nothing, SixteenNine);

			Assert.Equal(
				"version 0 -> 4; keys AssetMenuCatalogWidth,AssetMenuHeight,ControlPaneShown,ReplaceVanillaBuildMenu; marker none; stamp False; "
				+ "upgrader SettingsKey(AssetMenuHeight); changed Upgrader False -> True; AssetMenuHeight 155 -> 149; AssetMenuWidthStep 1 -> 3; "
				+ "AssetMenuHeight 149 -> 144.25; DefaultView auto -> cards; SettingsVersion 0 -> 4",
				SettingsMigration.Describe(loaded.Keys, PriorInstall.Nothing, result));
		}

		[Fact]
		public void TheLogLineSaysWhenNothingWasAsked()
		{
			var prior = MarkerFirstWrittenBy("0.3.0", stampBefore: false, stamp: true);
			var result = SettingsMigration.Migrate(new FakeSettings { SettingsVersion = SettingsMigration.Current }, Array.Empty<string>(), prior, SixteenNine);

			Assert.Equal(
				"version 4 -> 4; keys none; marker first=0.3.0 stampBefore=False; stamp True; upgrader not asked; changed nothing",
				SettingsMigration.Describe(Array.Empty<string>(), prior, result));
		}

		[Fact]
		public void AStepOutsideTheRangeBecomesTheFirstEvenAtThisVersion()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current, AssetMenuWidthStep = 9 };
			var result = SettingsMigration.Migrate(values, Array.Empty<string>(), StampOnly, SixteenNine);

			Assert.True(result.Changed);
			Assert.Equal(1, values.AssetMenuWidthStep);
			Assert.Equal(new[] { "AssetMenuWidthStep 9 -> 1" }, result.Changes);
			Assert.Null(result.Decision);
		}

		[Fact]
		public void ALaterReleasesFileKeepsItsStepAndIsNotChanged()
		{
			var values = new FakeSettings { SettingsVersion = 7, AssetMenuWidthStep = 6 };
			var result = SettingsMigration.Migrate(values, Array.Empty<string>(), StampOnly, SixteenNine);

			Assert.False(result.Changed);
			Assert.Equal(6, values.AssetMenuWidthStep);
		}

		[Fact]
		public void AnUnreadableFileGivesNoKeysAndTheMigrationStillRuns()
		{
			static IReadOnlyCollection<string> Throws() => throw new IOException("locked");

			var failures = new List<Exception>();
			var keys = SettingsFileKeys.FirstFound(failures.Add, Throws, Throws);
			var values = new FakeSettings();
			var result = SettingsMigration.Migrate(values, keys, PriorInstall.Nothing, SixteenNine);

			Assert.Empty(keys);
			Assert.Equal(2, failures.Count);
			Assert.All(failures, failure => Assert.IsType<IOException>(failure));
			Assert.True(result.Changed);
			Assert.Equal(SettingsMigration.Current, values.SettingsVersion);
		}

		[Fact]
		public void ALaterReadAnswersWhenAnEarlierOneThrows()
		{
			var failures = new List<Exception>();
			var keys = SettingsFileKeys.FirstFound(failures.Add, () => throw new IOException("locked"), () => new[] { "ReplaceVanillaBuildMenu" });

			Assert.Equal(new[] { "ReplaceVanillaBuildMenu" }, keys);
			Assert.IsType<IOException>(Assert.Single(failures));
		}

		[Fact]
		public void ALaterReadAnswersWhenAnEarlierOneFindsNoKeys()
		{
			var failures = new List<Exception>();
			var keys = SettingsFileKeys.FirstFound(failures.Add, () => Array.Empty<string>(), () => new[] { "ReplaceVanillaBuildMenu" });

			Assert.Equal(new[] { "ReplaceVanillaBuildMenu" }, keys);
			Assert.Empty(failures);
		}

		[Theory]
		[InlineData(nameof(BetterBuildingMenuSettings.Upgrader))]
		[InlineData(nameof(BetterBuildingMenuSettings.AssetMenuCatalogWidth))]
		public void TheMigrationsSettingsAreHidden(string name)
		{
			var property = typeof(BetterBuildingMenuSettings).GetProperty(name);

			Assert.NotNull(property);
			Assert.True(property!.IsDefined(typeof(SettingsUIHiddenAttribute), inherit: false));
		}

		[Fact]
		public void TheSettingsClassIsWhatTheMigrationRunsOn()
		{
			Assert.True(typeof(ISettingsValues).IsAssignableFrom(typeof(BetterBuildingMenuSettings)));
		}

		// The box is the top row's band (2 + 28 + 4), the body and the tab row's band (1.5 + 26 + 2.25).
		[Fact]
		public void TheDefaultHeightMakesTheMenuTheGamesOwnHeight()
		{
			Assert.Equal(208f - 34f - 29.75f, AssetMenuHeight.Default);
		}

		// Version 2's height makes the menu the game's own under a 14 rem strip and a 45 rem header.
		[Fact]
		public void VersionTwosHeightIsTheGamesOwnUnderTheEarlierChrome()
		{
			Assert.Equal(208f - 14f - 45f, SettingsMigration.WidthStepsHeight);
		}

		// Version 3 moves version 2's 149 and only it; any other height is kept, at least 108.
		[Theory]
		[InlineData(149f, 144.25f)]
		[InlineData(149.05f, 144.25f)]
		[InlineData(148.95f, 144.25f)]
		[InlineData(300f, 300f)]
		[InlineData(100f, 108f)]
		public void TheSecondStepMovesOnlyTheHeightVersionTwoShipped(float stored, float expected)
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Version2(stored, upgrader: true), PriorInstall.Nothing);

			Assert.Null(first.Decision);
			Assert.Equal(expected, after.AssetMenuHeight);
			Assert.Equal(SettingsMigration.Current, after.SettingsVersion);
		}

		// An upgrader keeps the pane as loaded, which is shown when the key is missing; everyone else's goes off.
		[Theory]
		[InlineData(true, "", true)]
		[InlineData(true, "false", false)]
		[InlineData(false, "true", false)]
		[InlineData(false, "", false)]
		public void TheSecondStepKeepsAnUpgradersPaneAndTurnsEveryoneElsesOff(bool upgrader, string paneKey, bool shown)
		{
			var (_, after, _, _) = TwoLoads(SettingsFixtures.Version2(149f, upgrader, paneKey), PriorInstall.Nothing);

			Assert.Equal(shown, after.ControlPaneShown);
			Assert.Equal(SettingsMigration.Current, after.SettingsVersion);
		}

		// Each step runs alone up to its own version, the later one reading the flag the earlier one set.
		[Fact]
		public void EachStepRunsAloneAtItsOwnVersion()
		{
			var values = new FakeSettings();

			var widthSteps = SettingsMigration.Migrate(values, Array.Empty<string>(), PriorInstall.Nothing, SixteenNine, SettingsMigration.WidthStepsVersion);
			Assert.Equal(new[] { "SettingsVersion 0 -> 2" }, widthSteps.Changes);
			Assert.True(values.ControlPaneShown, "the pane is version 3's");

			var controlPane = SettingsMigration.Migrate(values, Array.Empty<string>(), PriorInstall.Nothing, SixteenNine, SettingsMigration.ControlPaneVersion);
			Assert.Null(controlPane.Decision);
			Assert.Equal(new[] { "ControlPaneShown True -> False", "SettingsVersion 2 -> 3" }, controlPane.Changes);

			values.AssetMenuTileSize = 100;
			var bodies = SettingsMigration.Migrate(values, Array.Empty<string>(), PriorInstall.Nothing, SixteenNine);
			Assert.Null(bodies.Decision);
			Assert.Equal(new[] { "AssetMenuTileSize 100 -> 64", "SettingsVersion 3 -> 4" }, bodies.Changes);
		}

		// Grid draws as Tiles, List and Table as List, Cards stays; no view kept gives an upgrader Cards.
		[Theory]
		[InlineData("cards", "cards")]
		[InlineData("grid", "tiles")]
		[InlineData("list", "list")]
		[InlineData("table", "list")]
		[InlineData("", "cards")]
		[InlineData("x", "cards")]
		public void TheThirdStepTurnsTheViewTheInterimKeptIntoDefaultView(string kept, string defaultView)
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Version1View(kept), PriorInstall.Nothing);

			Assert.Equal(UpgraderSignal.SettingsVersion, first.Decision!.Value.Signal);
			Assert.Equal(defaultView, after.DefaultView);
			Assert.Equal(kept, after.AssetMenuViewMode);
		}

		// A player who installed after the interim keeps the view they picked too; with none, a new player opens in Auto.
		[Theory]
		[InlineData(false, "grid", "tiles")]
		[InlineData(false, "", "auto")]
		[InlineData(false, "x", "auto")]
		[InlineData(true, "table", "list")]
		[InlineData(true, "", "cards")]
		public void AViewKeptByAnEarlierRedesignReleaseCarriesForEveryone(bool upgrader, string kept, string defaultView)
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Version3(upgrader, kept, 64), PriorInstall.Nothing);

			Assert.Null(first.Decision);
			Assert.Equal(defaultView, after.DefaultView);
			Assert.Equal(SettingsMigration.Current, after.SettingsVersion);
		}

		[Theory]
		[InlineData(100)]
		[InlineData(120)]
		[InlineData(144)]
		[InlineData(64)]
		public void TheThirdStepGivesEveryTileSizeTheNewDefault(int stored)
		{
			var (_, after, _, _) = TwoLoads(SettingsFixtures.Version3(upgrader: true, "cards", stored), PriorInstall.Nothing);

			Assert.Equal(SettingsDefaults.TileSize, after.AssetMenuTileSize);
		}

		[Fact]
		public void TheNewTileSizeIs64()
		{
			Assert.Equal(64, SettingsDefaults.TileSize);
		}

		[Fact]
		public void AnUnknownDefaultViewAtLargeTextOrHoverCardReadsAsShippedOnEveryLoad()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current, DefaultView = "grid", AtLargeText = "z", HoverCard = "y" };
			var result = SettingsMigration.Migrate(values, Array.Empty<string>(), StampOnly, SixteenNine);

			Assert.Equal(BodyViews.Auto, values.DefaultView);
			Assert.Equal(LargeText.MoreBuildings, values.AtLargeText);
			Assert.Equal(HoverCards.Pointer, values.HoverCard);
			Assert.Equal(new[] { "DefaultView grid -> auto", "AtLargeText z -> moreBuildings", "HoverCard y -> pointer" }, result.Changes);
		}

		[Fact]
		public void ALaterReleasesFileKeepsItsRows()
		{
			var values = new FakeSettings { SettingsVersion = 7, DefaultView = "glass", AtLargeText = "z" };
			var result = SettingsMigration.Migrate(values, Array.Empty<string>(), StampOnly, SixteenNine);

			Assert.False(result.Changed);
			Assert.Equal("glass", values.DefaultView);
			Assert.Equal("z", values.AtLargeText);
		}

		[Fact]
		public void WhatEarlierReleasesLeftIsReadBeforeTheMarkerIsWritten()
		{
			var source = ModSource.Text("Mod.cs");
			var prior = source.IndexOf("ReadPriorInstall();", StringComparison.Ordinal);
			var marker = source.IndexOf("WriteReleaseMarker();", StringComparison.Ordinal);

			Assert.True(prior >= 0, "Mod.cs no longer calls ReadPriorInstall();");
			Assert.True(prior < marker, "what earlier releases left must be read before this release writes its marker");
		}

		[Fact]
		public void TheMigrationRunsAfterTheSettingsLoadAndBeforeTheSystems()
		{
			var source = ModSource.Text("Mod.cs");
			var load = source.IndexOf("AssetDatabase.global.LoadSettings(", StringComparison.Ordinal);
			var migrate = source.IndexOf("MigrateSettings(prior);", StringComparison.Ordinal);
			var systems = source.IndexOf("updateSystem.UpdateAt<", StringComparison.Ordinal);

			Assert.True(load >= 0 && migrate > load, "the migration must run after the settings load");
			Assert.True(systems > migrate, "the migration must run before the systems are created");
		}
	}
}
