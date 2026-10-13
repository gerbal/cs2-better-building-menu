using BetterBuildingMenu.Domain;
using Game.Settings;
using Game.UI.Localization;
using Game.UI.Widgets;

using System.Reflection;
using System.Text.RegularExpressions;

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

		/// <summary>The rows a player sees in Options: every property not hidden, outside the developer knobs' Tuning group.</summary>
		private static IEnumerable<PropertyInfo> PlayerRows() => typeof(BetterBuildingMenuSettings)
			.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
			.Where(property => !property.IsDefined(typeof(SettingsUIHiddenAttribute))
				&& property.GetCustomAttribute<SettingsUISectionAttribute>()?.simpleGroup != BetterBuildingMenuSettings.TUNING);

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
		public void TheDefaultsPutEveryValueBackButTheVersionAndTheLegacyWidthAndView()
		{
			var values = EveryValueMoved();

			SettingsDefaults.Apply(values);

			Assert.Equal(
				new FakeSettings
				{
					SettingsVersion = 7,
					AssetMenuCatalogWidth = Domain.AssetMenuCatalogWidth.Default + 7f,
					AssetMenuViewMode = Domain.AssetMenuViewMode.None + "x",
					ControlPaneShown = SettingsDefaults.ControlPaneShown,
				},
				values);
		}

		[Fact]
		public void AResetStoresThisReleasesVersion()
		{
			var values = EveryValueMoved() with { SettingsVersion = 1 };

			SettingsDefaults.Reset(values);

			Assert.Equal(
				new FakeSettings
				{
					SettingsVersion = SettingsMigration.Current,
					AssetMenuCatalogWidth = Domain.AssetMenuCatalogWidth.Default + 7f,
					AssetMenuViewMode = Domain.AssetMenuViewMode.None + "x",
					ControlPaneShown = SettingsDefaults.ControlPaneShown,
				},
				values);
		}

		[Fact]
		public void AResetKeepsALaterReleasesVersion()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current + 5, AssetMenuTileSize = 120 };

			SettingsDefaults.Reset(values);

			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current + 5, ControlPaneShown = SettingsDefaults.ControlPaneShown }, values);
		}

		[Fact]
		public void TheControlPaneIsTheOneSettingWhoseShippedValueIsNotItsInitializer()
		{
			// The initializer reads a file without the key as 0.2.4 read it, shown; a new player's
			// pane ships off. Every other setting starts where Reset puts it.
			var start = new FakeSettings();
			var shipped = new FakeSettings();

			SettingsDefaults.Apply(shipped);

			var differs = typeof(ISettingsValues).GetProperties()
				.Where(property => !Equals(property.GetValue(start), property.GetValue(shipped)))
				.Select(property => property.Name);

			Assert.Equal(new[] { nameof(ISettingsValues.ControlPaneShown) }, differs);
			Assert.True(start.ControlPaneShown);
			Assert.False(shipped.ControlPaneShown);
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
			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current, ControlPaneShown = SettingsDefaults.ControlPaneShown }, reloaded.Values);
		}

		[Fact]
		public void TheTestSettingsStartWhereTheSettingsClassDoes()
		{
			var source = ModSource.Text("Setting.cs");
			var start = new FakeSettings();

			Assert.All(StoredSettings(), setting =>
			{
				// A Domain constant, or no initializer: a start the plain object can be held to.
				var declared = Regex.Match(source, @"public \S+ " + setting.Name + @" \{ get; set; \}(?: = Domain\.(?<owner>\w+)\.(?<constant>\w+);)?\r?\n");

				Assert.True(declared.Success, setting.Name + " starts at something other than a Domain constant or the default");

				var shipped = declared.Groups["owner"].Success
					? DomainConstant(declared.Groups["owner"].Value, declared.Groups["constant"].Value)
					: setting.PropertyType.IsValueType ? Activator.CreateInstance(setting.PropertyType) : null;

				Assert.Equal(shipped, typeof(FakeSettings).GetProperty(setting.Name)!.GetValue(start));
			});
		}

		/// <summary>The value of a constant declared in a Domain type, failing the test for anything but a constant.</summary>
		private static object? DomainConstant(string owner, string name)
		{
			var field = typeof(SettingsDefaults).Assembly.GetType("BetterBuildingMenu.Domain." + owner)?.GetField(name, BindingFlags.Public | BindingFlags.Static);

			Assert.True(field is { IsLiteral: true }, $"Domain.{owner}.{name} is not a constant");

			return field!.GetRawConstantValue();
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
		public void TheWidthRowIsADropdownOfTheFiveStepsUnderUiUx()
		{
			var width = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.AssetMenuWidthStep))!;
			var dropdown = width.GetCustomAttribute<SettingsUIDropdownAttribute>();

			Assert.False(width.IsDefined(typeof(SettingsUIHiddenAttribute)), "the Width row is hidden");
			Assert.Equal(BetterBuildingMenuSettings.UIUX, width.GetCustomAttribute<SettingsUISectionAttribute>()?.simpleGroup);
			Assert.True(dropdown is not null, "the Width row is not a dropdown");
			Assert.Equal(typeof(BetterBuildingMenuSettings), dropdown!.itemsGetterType);

			// Static, so the test calls it without building the settings class.
			var getter = typeof(BetterBuildingMenuSettings).GetMethod(dropdown.itemsGetterMethod, BindingFlags.Static | BindingFlags.NonPublic);
			Assert.True(getter is not null && getter.GetParameters().Length == 0, dropdown.itemsGetterMethod);
			var items = Assert.IsType<DropdownItem<int>[]>(getter!.Invoke(null, null));

			Assert.Equal(Enumerable.Range(1, WidthSteps.Count), items.Select(item => item.value));
			Assert.Equal(OptionRows.WidthStepLabelIds, items.Select(item => item.displayName.id));
			Assert.All(OptionRows.WidthStepLabelIds, id => Assert.InRange(ModSource.English(id).Length, 1, 24));
		}

		[Fact]
		public void TheControlPaneRowIsAToggleUnderUiUx()
		{
			var pane = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.ControlPaneShown))!;

			Assert.Equal(typeof(bool), pane.PropertyType);
			Assert.False(pane.IsDefined(typeof(SettingsUIHiddenAttribute)), "the Control pane row is hidden");
			Assert.Equal(BetterBuildingMenuSettings.UIUX, pane.GetCustomAttribute<SettingsUISectionAttribute>()?.simpleGroup);
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
				"Put every Better Building Menu setting, the width, each menu's own view and group and the menu's size back to how they ship? The buildings you have placed are kept.",
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
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevPickLogger));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevInterfaceStyles));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevTabNames));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevListShare));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevWhatCounts));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevAutoLargeText));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevCardsFrom));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevListPlateHeight));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevNameLines));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevTileNameLine));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevBlockLabels));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevCardHeight));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevSmallMenusGrow));
			Assert.Contains(knobs, knob => knob.Name == nameof(BetterBuildingMenuSettings.DevSearchFlow));
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

		[Fact]
		public void MoreOptionsOpensTheModsOwnPageOnItsOneTab()
		{
			// The game names a mod's page after its IMod type, and each tab after the page.
			var page = typeof(Mod).Assembly.GetName().Name + "." + typeof(Mod).Namespace + "." + nameof(Mod);
			var tab = Assert.Single(typeof(BetterBuildingMenuSettings).GetCustomAttribute<SettingsUITabOrderAttribute>()!.tabs);

			var target = OptionRows.OptionsPage(page, tab);

			Assert.Equal(page, target.Page);
			Assert.Equal(page + "." + tab, target.Section);
		}

		[Fact]
		public void MoreOptionsAsksForThePageTheSettingsRegisterUnder()
		{
			// The settings register under their own id, with the game's prefix on each tab, so the
			// trigger names that id and the one tab, never a string of its own.
			Assert.Contains("Settings.RegisterInOptionsUI();", ModSource.Text("Mod.cs"));

			var open = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.AssetMenuSize.cs"), "private void OpenModOptions(");

			Assert.Contains("OptionRows.OptionsPage(Mod.Settings.id, BetterBuildingMenuSettings.SETTINGS)", open);
			Assert.Contains("OpenPage(target.Page, target.Section, isAdvanced: false)", open);
		}
	}
}
