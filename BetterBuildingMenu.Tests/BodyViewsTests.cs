using BetterBuildingMenu.Domain;

using Game.Settings;
using Game.UI.Widgets;

using System.Reflection;
using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The bodies a menu draws as the settings store them: Default view, At large text, and 0.2.5's remembered view mapped.</summary>
	public sealed class BodyViewsTests
	{
		[Theory]
		[InlineData("cards", "cards")]
		[InlineData("grid", "tiles")]
		[InlineData("list", "list")]
		[InlineData("table", "list")]
		public void ARememberedViewBecomesTheBodyItMapsTo(string remembered, string body)
		{
			Assert.Equal(body, BodyViews.FromRemembered(remembered));
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("tiles")]
		[InlineData("Grid")]
		public void NothingRememberedMapsToNoBody(string? remembered)
		{
			Assert.Null(BodyViews.FromRemembered(remembered));
		}

		[Theory]
		[InlineData("auto")]
		[InlineData("list")]
		[InlineData("icons")]
		[InlineData("tiles")]
		[InlineData("cards")]
		public void TheDefaultViewRowKeepsItsValues(string value)
		{
			Assert.Equal(value, BodyViews.SanitizeDefault(value));
		}

		// The icons with names are a developer's pick for one menu, never every menu's view.
		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("iconsNamed")]
		[InlineData("grid")]
		[InlineData("List")]
		public void AnyOtherDefaultViewReadsAsAuto(string? value)
		{
			Assert.Equal(BodyViews.Auto, BodyViews.SanitizeDefault(value));
		}

		[Theory]
		[InlineData("list", "list")]
		[InlineData("tiles", "tiles")]
		[InlineData("cards", "cards")]
		[InlineData("icons", "icons")]
		[InlineData("iconsNamed", "")]
		[InlineData("auto", "")]
		[InlineData("grid", "")]
		[InlineData(null, "")]
		public void AMenusOwnPickIsOneOfTheKindsOrNone(string? value, string pick)
		{
			Assert.Equal(pick, BodyViews.SanitizePick(value));
		}

		[Fact]
		public void TheUiReadsOnlyThePicksABodyDraws()
		{
			Assert.Equal(
				new[] { new MenuPick("Roads", "list"), new MenuPick("Landscaping", "icons"), new MenuPick("Parks & Recreation", "cards") },
				BodyViews.PicksOf("Roads=list\nLandscaping=icons\nZones=grid\nParks & Recreation=cards\nSignatures=iconsNamed"));
		}

		[Fact]
		public void TheIconsWithNamesAreAPickOnlyInDeveloperMode()
		{
			Assert.Equal("iconsNamed", BodyViews.SanitizePick("iconsNamed", developerMode: true));
			Assert.Equal("", BodyViews.SanitizePick("iconsNamed", developerMode: false));
			Assert.Equal(
				new[] { new MenuPick("Landscaping", "iconsNamed") },
				BodyViews.PicksOf("Landscaping=iconsNamed\nZones=grid", developerMode: true));
		}

		[Fact]
		public void TheUiKindsAreTheKindsCSharpStores()
		{
			var source = ModSource.Text("UI/src/domain/bodyChoice.ts");
			var kinds = Regex.Match(source, @"export const BODY_KINDS = \[([^\]]+)\]").Groups[1].Value;
			var whatCounts = Regex.Matches(source, "whatCounts === \"(\\w+)\"").Select(match => match.Groups[1].Value).ToList();
			var largeText = Regex.Matches(source, "forced === \"(\\w+)\"").Select(match => match.Groups[1].Value).ToList();

			Assert.Equal(BodyViews.Kinds, Regex.Matches(kinds, "\"(\\w+)\"").Select(match => match.Groups[1].Value));
			Assert.NotEmpty(whatCounts);
			Assert.All(whatCounts, value => Assert.Contains(value, Tuning.WhatCountsValues));
			Assert.NotEmpty(largeText);
			Assert.All(largeText, value => Assert.Contains(value, Tuning.AutoLargeTextValues));
		}

		[Fact]
		public void TheSlotsReadAtLargeTextByTheValuesCSharpStores()
		{
			var geometry = ModSource.Text("UI/src/domain/bodyGeometry.ts");
			var read = Regex.Matches(geometry, "atLargeText === \"(\\w+)\"").Select(match => match.Groups[1].Value).ToList();

			Assert.NotEmpty(read);
			Assert.All(read, value => Assert.Contains(value, LargeText.Values));
		}

		[Theory]
		[InlineData("moreBuildings", "moreBuildings")]
		[InlineData("wholeNames", "wholeNames")]
		[InlineData(null, "moreBuildings")]
		[InlineData("WholeNames", "moreBuildings")]
		public void AtLargeTextKeepsItsTwoValuesAndReadsAnythingElseAsMoreBuildings(string? value, string read)
		{
			Assert.Equal(read, LargeText.Sanitize(value));
		}

		public static IEnumerable<object[]> Dropdowns() => new[]
		{
			new object[] { nameof(BetterBuildingMenuSettings.DefaultView), BodyViews.DefaultViews, OptionRows.DefaultViewLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.AtLargeText), LargeText.Values, OptionRows.AtLargeTextLabelIds },
		};

		[Theory]
		[MemberData(nameof(Dropdowns))]
		public void EachRowIsADropdownOfItsValuesUnderUiUxThatWaitsForReplace(string name, IReadOnlyList<string> values, IReadOnlyList<string> labels)
		{
			var row = typeof(BetterBuildingMenuSettings).GetProperty(name)!;
			var dropdown = row.GetCustomAttribute<SettingsUIDropdownAttribute>();

			Assert.Equal(typeof(string), row.PropertyType);
			Assert.False(row.IsDefined(typeof(SettingsUIHiddenAttribute)), name + " is hidden");
			Assert.Equal(BetterBuildingMenuSettings.UIUX, row.GetCustomAttribute<SettingsUISectionAttribute>()?.simpleGroup);
			Assert.NotNull(row.GetCustomAttribute<SettingsUIDisableByConditionAttribute>());
			Assert.True(dropdown is not null, name + " is not a dropdown");

			// Static, so the test calls it without building the settings class.
			var getter = typeof(BetterBuildingMenuSettings).GetMethod(dropdown!.itemsGetterMethod, BindingFlags.Static | BindingFlags.NonPublic);
			Assert.True(getter is not null && getter.GetParameters().Length == 0, dropdown.itemsGetterMethod);
			var items = Assert.IsType<DropdownItem<string>[]>(getter!.Invoke(null, null));

			Assert.Equal(values, items.Select(item => item.value));
			Assert.Equal(labels, items.Select(item => item.displayName.id));
			Assert.All(labels, id => Assert.InRange(ModSource.English(id).Length, 1, 24));
		}

		[Fact]
		public void DefaultViewSitsAfterWidthAndAtLargeTextAfterTileSize()
		{
			var order = typeof(BetterBuildingMenuSettings)
				.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
				.Where(property => property.GetCustomAttribute<SettingsUISectionAttribute>()?.simpleGroup == BetterBuildingMenuSettings.UIUX)
				.Select(property => property.Name)
				.ToList();

			Assert.Equal(
				new[]
				{
					nameof(BetterBuildingMenuSettings.AssetMenuWidthStep),
					nameof(BetterBuildingMenuSettings.DefaultView),
					nameof(BetterBuildingMenuSettings.AssetMenuTileSize),
					nameof(BetterBuildingMenuSettings.AtLargeText),
					nameof(BetterBuildingMenuSettings.ControlPaneShown),
					nameof(BetterBuildingMenuSettings.ResetBuildMenu),
				},
				order);
		}

		[Fact]
		public void TheUiDrawsTheShippedTileSizeAndAtLargeTextUntilCSharpAnswers()
		{
			var bindings = ModSource.Text("UI/src/mods/bindings.ts");

			Assert.Contains($"bindValue<number>(mod.id, \"AssetMenuTileSize\", {SettingsDefaults.TileSize})", bindings);
			Assert.Contains($"bindValue<string>(mod.id, \"AssetMenuAtLargeText\", \"{SettingsDefaults.AtLargeText}\")", bindings);
		}

		[Fact]
		public void TheRowsSayWhatTheyDoInOnScreenWords()
		{
			Assert.Equal("Default view", ModSource.English("Options.OPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.DefaultView]"));
			Assert.Equal("At large text", ModSource.English("Options.OPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.AtLargeText]"));
			Assert.Equal(
				"Sizes the Tiles view. 64 shows 2 rows of 10, 68 shows 2 rows of 9; above 68 the menu shows one row unless you drag it taller.",
				ModSource.English("Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.AssetMenuTileSize]"));
		}
	}

	/// <summary>The system keeps each menu's own VIEW and hands the UI what picks its body.</summary>
	public sealed class MenuViewWiringTests
	{
		[Fact]
		public void AViewPickIsTheOpenMenusOwnSavedOnlyWhenItChanges()
		{
			var pick = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.AssetMenuSize.cs"), "private void SetAssetMenuView(");

			Assert.Contains("MenuPicks.With(Mod.Settings.MenuViews, _assetMenu.Menu, BodyViews.SanitizePick(kind, Knobs.DeveloperMode))", pick);
			Assert.Contains("if (_assetMenu.Menu.Length == 0 || string.Equals(kept, Mod.Settings.MenuViews, StringComparison.Ordinal)) { return; }", pick);
			Assert.Contains("Mod.Settings.ApplyAndSave();", pick);
		}

		[Theory]
		[InlineData("_AssetMenuViews.Value = BodyViews.PicksOf(Mod.Settings.MenuViews, Knobs.DeveloperMode);")]
		[InlineData("_AssetMenuDefaultView.Value = BodyViews.SanitizeDefault(Mod.Settings.DefaultView);")]
		public void WhatPicksTheBodyFollowsOptionsAtOnce(string push)
		{
			Assert.Contains(push, ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied("));
		}

		[Fact]
		public void TheMenuViewsSettingIsHidden()
		{
			var property = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.MenuViews))!;

			Assert.True(property.IsDefined(typeof(SettingsUIHiddenAttribute), inherit: false));
			Assert.Equal(typeof(string), property.PropertyType);
		}
	}
}
