using BetterBuildingMenu.Domain;

using Game.Settings;
using Game.UI.Widgets;

using System.Reflection;

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
		[InlineData("tiles")]
		[InlineData("cards")]
		public void TheDefaultViewRowKeepsItsValues(string value)
		{
			Assert.Equal(value, BodyViews.SanitizeDefault(value));
		}

		// Icons joins the row with its body; until then a stored Icons reads as Auto, which picks it.
		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("icons")]
		[InlineData("grid")]
		[InlineData("List")]
		public void AnyOtherDefaultViewReadsAsAuto(string? value)
		{
			Assert.Equal(BodyViews.Auto, BodyViews.SanitizeDefault(value));
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
		public void TheRowsSayWhatTheyDoInOnScreenWords()
		{
			Assert.Equal("Default view", ModSource.English("Options.OPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.DefaultView]"));
			Assert.Equal("At large text", ModSource.English("Options.OPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.AtLargeText]"));
			Assert.Equal(
				"Sizes the Tiles view. 64 shows 2 rows of 10, 68 shows 2 rows of 9; above 68 the menu shows one row unless you drag it taller.",
				ModSource.English("Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.AssetMenuTileSize]"));
		}
	}
}
