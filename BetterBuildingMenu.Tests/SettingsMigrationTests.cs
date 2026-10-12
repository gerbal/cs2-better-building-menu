using BetterBuildingMenu.Domain;

using Game.Settings;

using System.IO;
using System.Runtime.CompilerServices;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The settings migration's step to version 2 over the files earlier releases left: who is an
	/// upgrader, the height, and the width as a Width step. Every file is loaded twice, as two
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

		private static string ModFile(string name, [CallerFilePath] string testFile = "") =>
			Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", "BetterBuildingMenu", name));

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

		[Fact]
		public void AFreshInstallIsANewPlayerAtTheGamesOwnSize()
		{
			var (first, after, _, _) = TwoLoads(null, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.None, string.Empty), first.Decision);
			Assert.Equal(new FakeSettings { SettingsVersion = 2 }, after);
			Assert.Equal(new[] { "SettingsVersion 0 -> 2" }, first.Changes);
		}

		[Fact]
		public void TheStampAloneMakesAnUpgraderAtTheStepNearestThe1091TheyHad()
		{
			var (first, after, _, _) = TwoLoads(null, StampOnly);

			Assert.Equal(UpgraderSignal.Stamp, first.Decision!.Value.Signal);
			Assert.Equal(new FakeSettings { SettingsVersion = 2, Upgrader = true, AssetMenuWidthStep = 3 }, after);
		}

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

		[Fact]
		public void ADraggedNarrowestWidthOpensAtTheFirstStepAndTheDefaultHeightMoves()
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Width735Height420, PriorInstall.Nothing);

			Assert.Equal(UpgraderSignal.SettingsKey, first.Decision!.Value.Signal);
			Assert.Equal(
				new FakeSettings { SettingsVersion = 2, Upgrader = true, AssetMenuHeight = 149, AssetMenuCatalogWidth = 735, AssetMenuWidthStep = 1 },
				after);
			Assert.Equal(new[] { "Upgrader False -> True", "AssetMenuHeight 420 -> 149", "SettingsVersion 0 -> 2" }, first.Changes);
		}

		[Fact]
		public void TheSameFileAfterTheInterimIsAnUpgraderByItsVersion()
		{
			var (first, after, _, _) = TwoLoads(SettingsFixtures.Width735Height420Version1, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsVersion, "1"), first.Decision);
			Assert.Equal(1, after.AssetMenuWidthStep);
			Assert.Equal(149, after.AssetMenuHeight);
			Assert.Equal("SettingsVersion 1 -> 2", first.Changes.Last());
		}

		public static IEnumerable<object[]> InterimFiles() => new[]
		{
			new object[] { SettingsFixtures.Version1Only },
			new object[] { SettingsFixtures.Version1ViewList },
		};

		[Theory]
		[MemberData(nameof(InterimFiles))]
		public void TheInterimWithNothingMovedIsAnUpgraderAtTheStepNearest1091(string file)
		{
			var (first, after, _, _) = TwoLoads(file, PriorInstall.Nothing);

			Assert.Equal(UpgraderSignal.SettingsVersion, first.Decision!.Value.Signal);
			Assert.Equal(new FakeSettings { SettingsVersion = 2, Upgrader = true, AssetMenuWidthStep = 3 }, after);
		}

		[Fact]
		public void TheMarkerAloneIsAnUpgrader()
		{
			// Back on 0.2.4 after 0.2.5: its next save dropped the version and the view.
			var (first, after, _, _) = TwoLoads(SettingsFixtures.ReplaceOn, MarkerFirstWrittenBy("0.2.5", stampBefore: false, stamp: false));

			Assert.Equal(new UpgraderDecision(UpgraderSignal.Marker, "0.2.5"), first.Decision);
			Assert.Equal(3, after.AssetMenuWidthStep);
		}

		[Fact]
		public void TheRedesignsOwnFirstLaunchWhoseSaveNeverLandedStaysNew()
		{
			var (first, after, _, _) = TwoLoads(null, MarkerFirstWrittenBy(UpgraderTest.FirstRedesignRelease, stampBefore: false, stamp: true));

			Assert.Equal(UpgraderSignal.None, first.Decision!.Value.Signal);
			Assert.Equal(new FakeSettings { SettingsVersion = 2 }, after);
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

		[Theory]
		[MemberData(nameof(OneKeyFiles))]
		public void AnyKeyAnEarlierReleaseDeclaredMakesAnUpgraderAtTheStepNearest1091(string file)
		{
			var (first, after, _, _) = TwoLoads(file, PriorInstall.Nothing);

			Assert.Equal(UpgraderSignal.SettingsKey, first.Decision!.Value.Signal);
			Assert.Equal(3, after.AssetMenuWidthStep);
			Assert.True(after.Upgrader);
		}

		[Fact]
		public void TheDevelopmentBuildsFileIsAnUpgraderOnItsKeysAndCountsTheFourNoPropertyReads()
		{
			var (first, after, loaded, _) = TwoLoads(SettingsFixtures.DevelopmentBuild, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsKey, "ReplaceVanillaBuildMenu"), first.Decision);
			Assert.Equal(4, loaded.UnknownKeys);
			Assert.Equal(new FakeSettings { SettingsVersion = 2, Upgrader = true, AssetMenuWidthStep = 3 }, after);
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

		[Theory]
		[InlineData(420.05f, 149f)]
		[InlineData(155.09f, 149f)]
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

		[Fact]
		public void TheVersionReachesTheFileAndNothingElseOfANewPlayers()
		{
			var (_, _, _, saved) = TwoLoads(null, PriorInstall.Nothing);

			Assert.Contains("\"SettingsVersion\": 2", saved);
			Assert.DoesNotContain("AssetMenuWidthStep", saved);
			Assert.DoesNotContain("AssetMenuHeight", saved);
			Assert.DoesNotContain("Upgrader", saved);
		}

		[Fact]
		public void AnUpgradersStepAndFlagReachTheFile()
		{
			var (_, _, _, saved) = TwoLoads(null, StampOnly);

			Assert.Contains("\"AssetMenuWidthStep\": 3", saved);
			Assert.Contains("\"Upgrader\": true", saved);
		}

		[Fact]
		public void TheLogLineNamesWhatTheLoadFoundTheSignAndEveryChange()
		{
			var loaded = SettingsFile.Read(SettingsFixtures.Height155Width0PaneShown);
			var result = SettingsMigration.Migrate(loaded.Values, loaded.Keys, PriorInstall.Nothing, SixteenNine);

			Assert.Equal(
				"version 0 -> 2; keys AssetMenuCatalogWidth,AssetMenuHeight,ControlPaneShown,ReplaceVanillaBuildMenu; marker none; stamp False; "
				+ "upgrader SettingsKey(AssetMenuHeight); changed Upgrader False -> True; AssetMenuHeight 155 -> 149; AssetMenuWidthStep 1 -> 3; SettingsVersion 0 -> 2",
				SettingsMigration.Describe(loaded.Keys, PriorInstall.Nothing, result));
		}

		[Fact]
		public void TheLogLineSaysWhenNothingWasAsked()
		{
			var prior = MarkerFirstWrittenBy("0.3.0", stampBefore: false, stamp: true);
			var result = SettingsMigration.Migrate(new FakeSettings { SettingsVersion = 2 }, Array.Empty<string>(), prior, SixteenNine);

			Assert.Equal(
				"version 2 -> 2; keys none; marker first=0.3.0 stampBefore=False; stamp True; upgrader not asked; changed nothing",
				SettingsMigration.Describe(Array.Empty<string>(), prior, result));
		}

		[Fact]
		public void AStepOutsideTheRangeBecomesTheFirstEvenAtThisVersion()
		{
			var values = new FakeSettings { SettingsVersion = 2, AssetMenuWidthStep = 9 };
			var result = SettingsMigration.Migrate(values, Array.Empty<string>(), StampOnly, SixteenNine);

			Assert.True(result.Changed);
			Assert.Equal(1, values.AssetMenuWidthStep);
			Assert.Equal(new[] { "AssetMenuWidthStep 9 -> 1" }, result.Changes);
			Assert.Null(result.Decision);
		}

		[Fact]
		public void AnUnreadableFileGivesNoKeysAndTheMigrationStillRuns()
		{
			static IReadOnlyCollection<string> Throws() => throw new IOException("locked");

			var keys = SettingsFileKeys.FirstFound(Throws, Throws);
			var values = new FakeSettings();
			var result = SettingsMigration.Migrate(values, keys, PriorInstall.Nothing, SixteenNine);

			Assert.Empty(keys);
			Assert.True(result.Changed);
			Assert.Equal(SettingsMigration.Current, values.SettingsVersion);
		}

		[Fact]
		public void ALaterReadAnswersWhenAnEarlierOneThrows()
		{
			var keys = SettingsFileKeys.FirstFound(() => throw new IOException("locked"), () => new[] { "ReplaceVanillaBuildMenu" });

			Assert.Equal(new[] { "ReplaceVanillaBuildMenu" }, keys);
		}

		[Fact]
		public void TheTestSettingsStartWhereTheSettingsClassDoes()
		{
			var source = File.ReadAllText(ModFile("Setting.cs"));

			Assert.Contains("public float AssetMenuHeight { get; set; } = Domain.AssetMenuHeight.Default;", source);
			Assert.Contains("public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;", source);
			Assert.Contains("public int AssetMenuWidthStep { get; set; } = Domain.WidthSteps.DefaultStep;", source);
			Assert.Matches(@"public bool Upgrader \{ get; set; \}\r?\n", source);
			Assert.Matches(@"public int SettingsVersion \{ get; set; \}\r?\n", source);
		}

		[Fact]
		public void SetDefaultsPutsTheNewValuesBackButNeverTheLegacyWidth()
		{
			var source = File.ReadAllText(ModFile("Setting.cs"));
			var setDefaults = source.Substring(source.IndexOf("public override void SetDefaults()", StringComparison.Ordinal));

			Assert.Contains("AssetMenuHeight = Domain.AssetMenuHeight.Default;", setDefaults);
			Assert.Contains("AssetMenuWidthStep = Domain.WidthSteps.DefaultStep;", setDefaults);
			Assert.Contains("Upgrader = false;", setDefaults);
			Assert.DoesNotContain("AssetMenuCatalogWidth", setDefaults);
		}

		[Theory]
		[InlineData(nameof(BetterBuildingMenuSettings.AssetMenuWidthStep))]
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

		[Fact]
		public void TheDefaultHeightMakesTheMenuTheGamesOwnHeight()
		{
			// The box is the top strip, the header and the catalog.
			Assert.Equal(208f - 14f - 45f, AssetMenuHeight.Default);
		}

		[Fact]
		public void WhatEarlierReleasesLeftIsReadBeforeTheMarkerIsWritten()
		{
			var source = File.ReadAllText(ModFile("Mod.cs"));
			var prior = source.IndexOf("ReadPriorInstall();", StringComparison.Ordinal);
			var marker = source.IndexOf("WriteReleaseMarker();", StringComparison.Ordinal);

			Assert.True(prior >= 0, "Mod.cs no longer calls ReadPriorInstall();");
			Assert.True(prior < marker, "what earlier releases left must be read before this release writes its marker");
		}

		[Fact]
		public void TheMigrationRunsAfterTheSettingsLoadAndBeforeTheSystems()
		{
			var source = File.ReadAllText(ModFile("Mod.cs"));
			var load = source.IndexOf("AssetDatabase.global.LoadSettings(", StringComparison.Ordinal);
			var migrate = source.IndexOf("MigrateSettings(prior);", StringComparison.Ordinal);
			var systems = source.IndexOf("updateSystem.UpdateAt<", StringComparison.Ordinal);

			Assert.True(load >= 0 && migrate > load, "the migration must run after the settings load");
			Assert.True(systems > migrate, "the migration must run before the systems are created");
		}
	}
}
