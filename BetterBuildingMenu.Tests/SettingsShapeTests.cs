using BetterBuildingMenu.Domain;
using Game.Settings;
using Game.UI.Localization;

using System.Reflection;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The settings class's shape, read by reflection and as text, and what Reset the build menu…
	/// puts back, on the plain object the migration's tests load files into.
	/// </summary>
	public sealed class SettingsShapeTests
	{
		private const double SixteenNine = 1920.0 / 1080.0;

		private static readonly PriorInstall StampOnly = new(null, StampExisted: true);

		/// <summary>The settings the class stores: a public getter and setter, which the game's loader reads and writes.</summary>
		private static IEnumerable<PropertyInfo> StoredSettings() => typeof(BetterBuildingMenuSettings)
			.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
			.Where(property => property.GetMethod?.IsPublic == true && property.SetMethod?.IsPublic == true);

		/// <summary>The rows a player sees in Options: every property in the Behavior or UI / UX group.</summary>
		private static IEnumerable<PropertyInfo> PlayerRows() => typeof(BetterBuildingMenuSettings)
			.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
			.Where(property => property.GetCustomAttribute<SettingsUISectionAttribute>() is { } section
				&& (section.simpleGroup == BetterBuildingMenuSettings.BEHAVIOR || section.simpleGroup == BetterBuildingMenuSettings.UIUX));

		/// <summary>Every value the migration and Reset reach, each moved off how it ships.</summary>
		private static FakeSettings EveryValueMoved()
		{
			var values = new FakeSettings();

			foreach (var property in typeof(FakeSettings).GetProperties())
			{
				property.SetValue(values, Moved(property.GetValue(values)));
			}

			return values;
		}

		/// <summary>A value moved off its own, boxed as its own type, so an int stays an int.</summary>
		private static object Moved(object? value) => value switch
		{
			bool flag => (object)!flag,
			int number => (object)(number + 7),
			float number => (object)(number + 7f),
			string text => (object)(text + "x"),
			_ => throw new NotSupportedException("No setting is a " + value?.GetType().Name),
		};

		[Fact]
		public void EverySettingTheClassStoresIsOneTheDefaultsReach()
		{
			var stored = StoredSettings().Select(property => property.Name).OrderBy(name => name, StringComparer.Ordinal);
			var reached = typeof(ISettingsValues).GetProperties().Select(property => property.Name).OrderBy(name => name, StringComparer.Ordinal);

			Assert.Equal(reached, stored);
		}

		[Fact]
		public void TheDefaultsPutEveryValueBackButTheVersionAndTheLegacyWidth()
		{
			var values = EveryValueMoved();

			SettingsDefaults.Apply(values);

			Assert.Equal(new FakeSettings { SettingsVersion = 7, AssetMenuCatalogWidth = Domain.AssetMenuCatalogWidth.Default + 7f }, values);
		}

		[Fact]
		public void AResetStoresThisReleasesVersion()
		{
			var values = EveryValueMoved() with { SettingsVersion = 1 };

			SettingsDefaults.Reset(values);

			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current, AssetMenuCatalogWidth = Domain.AssetMenuCatalogWidth.Default + 7f }, values);
		}

		[Fact]
		public void AResetKeepsALaterReleasesVersion()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current + 5, AssetMenuTileSize = 120 };

			SettingsDefaults.Reset(values);

			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current + 5 }, values);
		}

		[Fact]
		public void ALoadAfterAResetMigratesNothingEvenWhenTheMigrationNeverRan()
		{
			// A 0.2.4 file whose migration fails this load: it is still at version 0 when the player resets.
			var loaded = SettingsFile.Read(SettingsFixtures.Height155Width0PaneShown);
			var values = loaded.Values with { };

			SettingsDefaults.Reset(values);

			var reloaded = SettingsFile.Read(GameSave.Write(loaded.Keys, values));
			var next = SettingsMigration.Migrate(reloaded.Values, reloaded.Keys, StampOnly, SixteenNine);

			Assert.False(next.Changed, "the next load changed " + string.Join("; ", next.Changes));
			Assert.Null(next.Decision);
			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current }, reloaded.Values);
		}

		[Fact]
		public void TheTestSettingsStartWhereTheSettingsClassDoes()
		{
			var source = ModSource.Text("Setting.cs");

			Assert.Contains("public float AssetMenuHeight { get; set; } = Domain.AssetMenuHeight.Default;", source);
			Assert.Contains("public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;", source);
			Assert.Contains("public int AssetMenuWidthStep { get; set; } = Domain.WidthSteps.DefaultStep;", source);
			Assert.Contains("public bool ControlPaneShown { get; set; } = Domain.SettingsDefaults.ControlPaneShown;", source);
			Assert.Contains("public string AssetMenuViewMode { get; set; } = Domain.AssetMenuViewMode.None;", source);
			Assert.Contains("public bool ReplaceVanillaBuildMenu { get; set; } = Domain.SettingsDefaults.ReplaceVanillaBuildMenu;", source);
			Assert.Contains("public int AssetMenuTileSize { get; set; } = Domain.SettingsDefaults.TileSize;", source);
			Assert.Contains("public int DevSlotMargin { get; set; } = Domain.Tuning.SlotMarginPercent;", source);

			// No initializer: false or 0, as FakeSettings has them.
			foreach (var bare in new[] { "int SettingsVersion", "bool Upgrader", "bool AutoWidenSearch" })
			{
				Assert.Matches("public " + bare + @" \{ get; set; \}\r?\n", source);
			}
		}

		[Fact]
		public void SetDefaultsIsTheShippedValues()
		{
			Assert.Equal(
				"public override void SetDefaults() { Domain.SettingsDefaults.Apply(this); }",
				ModSource.Member(ModSource.Text("Setting.cs"), "public override void SetDefaults()"));
		}

		[Fact]
		public void ResetTheBuildMenuIsAButtonThatAsksFirstAndIsNeverSaved()
		{
			var reset = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.ResetBuildMenu))!;

			Assert.Equal(typeof(bool), reset.PropertyType);
			// No getter: the game's settings diff skips what it cannot read, so the button is never saved.
			Assert.False(reset.CanRead);
			Assert.True(reset.CanWrite);
			Assert.True(reset.IsDefined(typeof(SettingsUIButtonAttribute)));
			Assert.True(reset.IsDefined(typeof(SettingsUIConfirmationAttribute)));
			Assert.Equal(BetterBuildingMenuSettings.UIUX, reset.GetCustomAttribute<SettingsUISectionAttribute>()!.simpleGroup);
		}

		[Fact]
		public void TheButtonResetsThenSavesOnce()
		{
			Assert.Equal(
				"public bool ResetBuildMenu { set { Domain.SettingsDefaults.Reset(this); ApplyAndSave(); } }",
				ModSource.Member(ModSource.Text("Setting.cs"), "public bool ResetBuildMenu"));
		}

		[Fact]
		public void EveryRowButReplaceWaitsForReplace()
		{
			var replace = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.ReplaceVanillaBuildMenu))!;
			var waiting = PlayerRows().Where(row => row.Name != replace.Name).ToList();

			Assert.Contains(waiting, row => row.Name == nameof(BetterBuildingMenuSettings.ResetBuildMenu));
			Assert.Null(replace.GetCustomAttribute<SettingsUIDisableByConditionAttribute>());
			Assert.All(waiting, row =>
			{
				var condition = row.GetCustomAttribute<SettingsUIDisableByConditionAttribute>();

				Assert.True(condition is not null, row.Name + " stays live while Replace is off");
				Assert.Equal(typeof(BetterBuildingMenuSettings), condition!.checkType);
				Assert.Equal(replace.Name, condition.checkMethod);
				Assert.True(condition.invert, row.Name + " is greyed out while Replace is on");
			});
		}

		[Fact]
		public void ARowWaitingForReplaceSaysWhyWhileItIsOff()
		{
			var waiting = PlayerRows().Where(row => row.IsDefined(typeof(SettingsUIDisableByConditionAttribute))).ToList();

			Assert.NotEmpty(waiting);
			Assert.All(waiting, row =>
			{
				var description = row.GetCustomAttribute<SettingsUIDescriptionAttribute>();

				Assert.True(description is not null, row.Name + " has no description getter");
				Assert.Equal(typeof(BetterBuildingMenuSettings), description!.getterType);
				Assert.Equal(row.Name + "Description", description.getterMethod);

				// The game finds the getter by name and calls it with no arguments, every frame.
				var getter = typeof(BetterBuildingMenuSettings).GetMethod(description.getterMethod, BindingFlags.Instance | BindingFlags.NonPublic);

				Assert.True(getter is not null && getter.ReturnType == typeof(LocalizedString) && getter.GetParameters().Length == 0, description.getterMethod);
			});
		}

		[Fact]
		public void ARowsDescriptionIsItsOwnWhileReplaceIsOnAndTheOffLineWhileItIsOff()
		{
			const string Own = "Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.AutoWidenSearch]";

			Assert.Equal(Own, OptionRows.DescriptionId(replaceOn: true, Own));
			Assert.Equal(OptionRows.OffWhileReplaceOffId, OptionRows.DescriptionId(replaceOn: false, Own));
		}

		[Fact]
		public void TheOffLineAndTheResetQuestionReadAsShipped()
		{
			Assert.Equal("Off while Replace the vanilla build menu is off.", ModSource.English(OptionRows.OffWhileReplaceOffId));
			Assert.Equal(
				"Put every Better Building Menu setting, the width, the view and the menu's size back to how they ship? The buildings you have placed are kept.",
				ModSource.English("Options.WARNING[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.ResetBuildMenu]"));
		}

		[Fact]
		public void AKnobCountsOnlyInDeveloperMode()
		{
			Assert.Equal(0, Tuning.Value(developerMode: true, stored: 0, shipped: Tuning.SlotMarginPercent));
			Assert.Equal(Tuning.SlotMarginPercent, Tuning.Value(developerMode: false, stored: 0, shipped: Tuning.SlotMarginPercent));
			Assert.Equal(Tuning.SlotMarginPercent, Tuning.Value(developerMode: false, stored: 50, shipped: Tuning.SlotMarginPercent));
		}

		[Fact]
		public void TheDeveloperKnobsShowOnlyInDeveloperModeUnderTuning()
		{
			var knobs = typeof(BetterBuildingMenuSettings)
				.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
				.Where(property => property.Name.StartsWith("Dev", StringComparison.Ordinal))
				.ToList();

			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevSlotMargin));
			Assert.All(knobs, knob =>
			{
				Assert.Equal(BetterBuildingMenuSettings.TUNING, knob.GetCustomAttribute<SettingsUISectionAttribute>()?.simpleGroup);
				Assert.True(knob.IsDefined(typeof(SettingsUIDeveloperAttribute)), knob.Name + " shows outside developer mode");
				Assert.True(knob.IsDefined(typeof(SettingsUISearchHiddenAttribute)), knob.Name + " shows in the options search");
				Assert.False(knob.IsDefined(typeof(SettingsUIDisableByConditionAttribute)), knob.Name + " waits for Replace");
			});
		}

		[Fact]
		public void TheTuningGroupComesLastAndIsNamed()
		{
			var groups = new[] { BetterBuildingMenuSettings.BEHAVIOR, BetterBuildingMenuSettings.UIUX, BetterBuildingMenuSettings.TUNING };

			Assert.Equal(groups, typeof(BetterBuildingMenuSettings).GetCustomAttribute<SettingsUIGroupOrderAttribute>()!.groups);
			Assert.Equal(groups, typeof(BetterBuildingMenuSettings).GetCustomAttribute<SettingsUIShowGroupNameAttribute>()!.groups);
		}
	}
}
