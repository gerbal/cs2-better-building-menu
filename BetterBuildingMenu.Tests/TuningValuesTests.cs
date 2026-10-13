using BetterBuildingMenu.Domain;

using Game.Settings;
using Game.UI.Widgets;

using System.Reflection;

namespace BetterBuildingMenu.Tests
{
	/// <summary>What the UI reads of the developer knobs, and that a knob moved in Options reaches it.</summary>
	public sealed class TuningValuesTests
	{
		[Fact]
		public void TheUiReadsDeveloperModeAndEachKnobItUses()
		{
			var writer = new RecordingJsonWriter();

			new TuningValues(DeveloperMode: true, InterfaceStyles: false, TabNames: true).Write(writer);

			Assert.Equal(
				new[] { "developerMode", "interfaceStyles", "tabNames", "listShare", "whatCounts", "autoLargeText", "cardsFrom", "listPlateHeight", "nameLines", "tileNameLine", "blockLabels", "cardHeight", "smallMenusGrow", "searchFlow", "dimTypedWord", "iconsAbove", "iconSize", "hoverDelay" },
				writer.PropertyNames);
			Assert.Equal(
				new[]
				{
					"Write:Boolean:True", "Write:Boolean:False", "Write:Boolean:True", "Write:Int32:50", "Write:String:costOrCapacity",
					"Write:String:lookOwn", "Write:Int32:0", "Write:Single:27.25", "Write:Int32:0", "Write:Boolean:True",
					"Write:String:inline", "Write:Int32:46", "Write:Boolean:True", "Write:String:nearField", "Write:Boolean:False",
					"Write:Int32:200", "Write:Int32:44", "Write:Int32:150",
				},
				writer.Tokens.Where(token => token.StartsWith("Write:", StringComparison.Ordinal)));
		}

		[Fact]
		public void AKnobMovedInOptionsReachesTheUiAtOnce()
		{
			var applied = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied(");

			Assert.Contains("_AssetMenuTuning.Value = CurrentTuning();", applied);
		}

		[Fact]
		public void TheTabNamesKnobShipsOnAndIsReadThroughTheOneRule()
		{
			Assert.True(Tuning.TabNames);
			Assert.Contains(
				"Knobs.Value(settings => settings.DevTabNames, Tuning.TabNames)",
				ModSource.Text("Systems/BuildingMenuUISystem.cs"));
		}

		// Each body knob is read through the one rule and handed to its own field by name, so a swap of two of a type fails.
		[Theory]
		[InlineData("ListShare", "Tuning.ListShareOf(Knobs.Value(settings => settings.DevListShare, Tuning.ListShare))")]
		[InlineData("WhatCounts", "Tuning.OneOf(Tuning.WhatCountsValues, Knobs.Value(settings => settings.DevWhatCounts, Tuning.WhatCounts), Tuning.WhatCounts)")]
		[InlineData("AutoLargeText", "Tuning.OneOf(Tuning.AutoLargeTextValues, Knobs.Value(settings => settings.DevAutoLargeText, Tuning.AutoLargeText), Tuning.AutoLargeText)")]
		[InlineData("CardsFrom", "Tuning.OneOf(Tuning.CardsFromValues, Knobs.Value(settings => settings.DevCardsFrom, Tuning.CardsFrom), Tuning.CardsFrom)")]
		[InlineData("ListPlateHeight", "Tuning.ListPlateHeightOf(Knobs.Value(settings => settings.DevListPlateHeight, Tuning.ListPlateHeight))")]
		[InlineData("NameLines", "Tuning.OneOf(Tuning.NameLinesValues, Knobs.Value(settings => settings.DevNameLines, Tuning.NameLines), Tuning.NameLines)")]
		[InlineData("TileNameLine", "Knobs.Value(settings => settings.DevTileNameLine, Tuning.TileNameLine)")]
		[InlineData("BlockLabels", "Tuning.OneOf(Tuning.BlockLabelsValues, Knobs.Value(settings => settings.DevBlockLabels, Tuning.BlockLabels), Tuning.BlockLabels)")]
		[InlineData("CardHeight", "Tuning.OneOf(Tuning.CardHeightValues, Knobs.Value(settings => settings.DevCardHeight, Tuning.CardHeight), Tuning.CardHeight)")]
		[InlineData("SmallMenusGrow", "Knobs.Value(settings => settings.DevSmallMenusGrow, Tuning.SmallMenusGrow)")]
		[InlineData("SearchFlow", "Tuning.OneOf(Tuning.SearchFlowValues, Knobs.Value(settings => settings.DevSearchFlow, Tuning.SearchFlow), Tuning.SearchFlow)")]
		[InlineData("DimTypedWord", "Knobs.Value(settings => settings.DevDimTypedWord, Tuning.DimTypedWord)")]
		[InlineData("IconsAbove", "Tuning.Within(Knobs.Value(settings => settings.DevIconsAbove, Tuning.IconsAbove), Tuning.IconsAboveMin, Tuning.IconsAboveMax)")]
		[InlineData("IconSize", "Tuning.Within(Knobs.Value(settings => settings.DevIconSize, Tuning.IconSize), Tuning.IconSizeMin, Tuning.IconSizeMax)")]
		[InlineData("HoverDelay", "Tuning.Within(Knobs.Value(settings => settings.DevHoverDelay, Tuning.HoverDelay), Tuning.HoverDelayMin, Tuning.HoverDelayMax)")]
		public void EachBodyKnobIsReadThroughTheOneRuleIntoItsOwnField(string field, string read)
		{
			Assert.Contains($"{field}: {read}", ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private static TuningValues CurrentTuning()"));
		}

		[Fact]
		public void TheBodyKnobsShipAsTheSpecSetsThem()
		{
			Assert.Equal(50, Tuning.ListShare);
			Assert.Equal("costOrCapacity", Tuning.WhatCounts);
			Assert.Equal("lookOwn", Tuning.AutoLargeText);
			Assert.Equal(0, Tuning.CardsFrom);
			Assert.Equal(27.25f, Tuning.ListPlateHeight);
			Assert.Equal(0, Tuning.NameLines);
			Assert.True(Tuning.TileNameLine);
		}

		[Fact]
		public void TheLayoutKnobsShipAsTheSpecSetsThem()
		{
			// Labels inline in one slot; cards three rows tall in the game's own body; small menus grow;
			// search results nearest the field first.
			Assert.Equal("inline", Tuning.BlockLabels);
			Assert.Equal(46, Tuning.CardHeight);
			Assert.True(Tuning.SmallMenusGrow);
			Assert.Equal("nearField", Tuning.SearchFlow);
		}

		[Fact]
		public void TheNumberAndNameKnobsShipAsTheSpecSetsThem()
		{
			// A value two thirds of a view's unlocked rows share is said once; the typed word is not dimmed.
			Assert.Equal(67, Tuning.SaidOnceAt);
			Assert.Equal(new[] { 67, 0, 50, 60, 75, 80, 90 }, Tuning.SaidOnceAtValues);
			Assert.False(Tuning.DimTypedWord);
		}

		[Fact]
		public void TheIconAndHoverKnobsShipAsTheSpecSetsThem()
		{
			// Icons for a menu of more than 200 rows where few carry a cost or a capacity; 44 rem icons; a card after 150 ms.
			Assert.Equal((200, 100, 2000), (Tuning.IconsAbove, Tuning.IconsAboveMin, Tuning.IconsAboveMax));
			Assert.Equal((44, 36, 56), (Tuning.IconSize, Tuning.IconSizeMin, Tuning.IconSizeMax));
			Assert.Equal((150, 0, 500), (Tuning.HoverDelay, Tuning.HoverDelayMin, Tuning.HoverDelayMax));
		}

		[Theory]
		[InlineData(nameof(BetterBuildingMenuSettings.DevIconsAbove), Tuning.IconsAboveMin, Tuning.IconsAboveMax, 100, Tuning.IconsAbove)]
		[InlineData(nameof(BetterBuildingMenuSettings.DevIconSize), Tuning.IconSizeMin, Tuning.IconSizeMax, 2, Tuning.IconSize)]
		[InlineData(nameof(BetterBuildingMenuSettings.DevHoverDelay), Tuning.HoverDelayMin, Tuning.HoverDelayMax, 50, Tuning.HoverDelay)]
		public void EachSliderKnobRunsOverItsRangeByItsStepWithItsShippedValueOnAStep(string name, int min, int max, int step, int shipped)
		{
			var slider = typeof(BetterBuildingMenuSettings).GetProperty(name)!.GetCustomAttribute<SettingsUISliderAttribute>();

			Assert.True(slider is not null, name + " is not a slider");
			Assert.Equal((float)min, slider!.min);
			Assert.Equal((float)max, slider.max);
			Assert.Equal((float)step, slider.step);
			// A player who nudged the slider gets back to the shipped value.
			Assert.Equal(0f, (shipped - min) % slider.step);
		}

		[Theory]
		[InlineData(50, 100)]
		[InlineData(300, 300)]
		[InlineData(5000, 2000)]
		public void AValueOutsideASliderKnobsRangeReadsAsTheNearerEnd(int stored, int read)
		{
			Assert.Equal(read, Tuning.Within(stored, Tuning.IconsAboveMin, Tuning.IconsAboveMax));
		}

		[Fact]
		public void TheSaidOnceShareIsReadThroughTheOneRuleIntoTheQueryEveryRefreshRuns()
		{
			// C# reads it, as it counts the shared values over the whole view; the UI never sees the share.
			var refresh = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private void RefreshBuildingCatalog(");

			Assert.Contains("_assetMenu.Query with { SaidOnceAt = CurrentSaidOnceAt() }", refresh);
			Assert.Contains(
				"Tuning.OneOf(Tuning.SaidOnceAtValues, Knobs.Value(settings => settings.DevSaidOnceAt, Tuning.SaidOnceAt), Tuning.SaidOnceAt)",
				ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"));
		}

		[Fact]
		public void ASaidOnceShareMovedInOptionsRedrawsTheOpenMenuAtOnce()
		{
			// The share is counted in C#, so the UI cannot redraw for it: the open menu is refreshed when it moves.
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");
			var applied = ModSource.Member(system, "private void OnSettingsApplied(");

			Assert.Contains("_appliedSaidOnceAt = CurrentSaidOnceAt();", system);
			Assert.Contains("if (saidOnceAt != _appliedSaidOnceAt)", applied);
			// Unless a regroup in the same pass redrew it already, with the share it reads.
			Assert.Contains("if (_assetMenuOpen && !redrawn)", applied);
			Assert.Contains("RefreshBuildingCatalog();", applied);
		}

		[Fact]
		public void TheUisFallbackForEachBodyKnobIsWhatShips()
		{
			// The UI draws the shipped knobs until C# answers, so the two must agree.
			var shipped = ModSource.Text("UI/src/mods/bindings.ts");
			var fallback = shipped.Substring(shipped.IndexOf("export const SHIPPED_TUNING", StringComparison.Ordinal));

			Assert.Contains($"listShare: {Tuning.ListShare},", fallback);
			Assert.Contains($"whatCounts: \"{Tuning.WhatCounts}\",", fallback);
			Assert.Contains($"autoLargeText: \"{Tuning.AutoLargeText}\",", fallback);
			Assert.Contains($"cardsFrom: {Tuning.CardsFrom},", fallback);
			Assert.Contains("listPlateHeight: 27.25,", fallback);
			Assert.Contains($"nameLines: {Tuning.NameLines},", fallback);
			Assert.Contains("tileNameLine: true,", fallback);
			Assert.Contains($"blockLabels: \"{Tuning.BlockLabels}\",", fallback);
			Assert.Contains($"cardHeight: {Tuning.CardHeight},", fallback);
			Assert.Contains("smallMenusGrow: true,", fallback);
			Assert.Contains($"searchFlow: \"{Tuning.SearchFlow}\",", fallback);
			Assert.Contains("dimTypedWord: false,", fallback);
			Assert.Contains($"iconsAbove: {Tuning.IconsAbove},", fallback);
			Assert.Contains($"iconSize: {Tuning.IconSize},", fallback);
			Assert.Contains($"hoverDelay: {Tuning.HoverDelay},", fallback);
		}

		[Theory]
		[InlineData(10, 30)]
		[InlineData(30, 30)]
		[InlineData(65, 65)]
		[InlineData(120, 90)]
		public void AShareOutsideTheKnobsRangeReadsAsTheNearerEnd(int stored, int read)
		{
			Assert.Equal(read, Tuning.ListShareOf(stored));
		}

		[Theory]
		[InlineData(20f, 23f)]
		[InlineData(29.5f, 29.5f)]
		[InlineData(40f, 34f)]
		[InlineData(float.NaN, 27.25f)]
		[InlineData(float.PositiveInfinity, 27.25f)]
		public void APlateHeightOutsideTheKnobsRangeReadsAsTheNearerEnd(float stored, float read)
		{
			Assert.Equal(read, Tuning.ListPlateHeightOf(stored));
		}

		[Fact]
		public void AValueAKnobDoesNotOfferReadsAsShipped()
		{
			Assert.Equal("capacityOnly", Tuning.OneOf(Tuning.WhatCountsValues, "capacityOnly", Tuning.WhatCounts));
			Assert.Equal(Tuning.WhatCounts, Tuning.OneOf(Tuning.WhatCountsValues, "all", Tuning.WhatCounts));
			Assert.Equal(Tuning.CardsFrom, Tuning.OneOf(Tuning.CardsFromValues, 1, Tuning.CardsFrom));
			Assert.Equal(2, Tuning.OneOf(Tuning.NameLinesValues, 2, Tuning.NameLines));
			Assert.Equal(Tuning.CardHeight, Tuning.OneOf(Tuning.CardHeightValues, 48, Tuning.CardHeight));
			Assert.Equal(Tuning.BlockLabels, Tuning.OneOf(Tuning.BlockLabelsValues, "chips", Tuning.BlockLabels));
			Assert.Equal("rowOrder", Tuning.OneOf(Tuning.SearchFlowValues, "rowOrder", Tuning.SearchFlow));
			Assert.Equal(Tuning.SaidOnceAt, Tuning.OneOf(Tuning.SaidOnceAtValues, 66, Tuning.SaidOnceAt));
			Assert.Equal(0, Tuning.OneOf(Tuning.SaidOnceAtValues, 0, Tuning.SaidOnceAt));
		}

		public static IEnumerable<object[]> Dropdowns() => new[]
		{
			new object[] { nameof(BetterBuildingMenuSettings.DevWhatCounts), Tuning.WhatCountsValues.Cast<object>().ToArray(), OptionRows.WhatCountsLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevAutoLargeText), Tuning.AutoLargeTextValues.Cast<object>().ToArray(), OptionRows.AutoLargeTextLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevCardsFrom), Tuning.CardsFromValues.Cast<object>().ToArray(), OptionRows.CardsFromLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevNameLines), Tuning.NameLinesValues.Cast<object>().ToArray(), OptionRows.NameLinesLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevBlockLabels), Tuning.BlockLabelsValues.Cast<object>().ToArray(), OptionRows.BlockLabelsLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevCardHeight), Tuning.CardHeightValues.Cast<object>().ToArray(), OptionRows.CardHeightLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevSearchFlow), Tuning.SearchFlowValues.Cast<object>().ToArray(), OptionRows.SearchFlowLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevSaidOnceAt), Tuning.SaidOnceAtValues.Cast<object>().ToArray(), OptionRows.SaidOnceAtLabelIds },
		};

		[Theory]
		[MemberData(nameof(Dropdowns))]
		public void EachDropdownKnobListsItsValuesByTheirLabels(string name, object[] values, IReadOnlyList<string> labels)
		{
			var dropdown = typeof(BetterBuildingMenuSettings).GetProperty(name)!.GetCustomAttribute<SettingsUIDropdownAttribute>();

			Assert.True(dropdown is not null, name + " is not a dropdown");

			// Static, so the test calls it without building the settings class.
			var items = typeof(BetterBuildingMenuSettings).GetMethod(dropdown!.itemsGetterMethod, BindingFlags.Static | BindingFlags.NonPublic)!.Invoke(null, null);
			var read = items switch
			{
				DropdownItem<string>[] strings => strings.Select(item => ((object)item.value, item.displayName.id)).ToArray(),
				DropdownItem<int>[] ints => ints.Select(item => ((object)item.value, item.displayName.id)).ToArray(),
				_ => throw new InvalidOperationException(name + " lists neither strings nor numbers"),
			};

			Assert.Equal(values, read.Select(item => item.Item1));
			Assert.Equal(labels, read.Select(item => item.id));
			Assert.All(labels, id => Assert.InRange(ModSource.English(id).Length, 1, 24));
		}
	}
}
