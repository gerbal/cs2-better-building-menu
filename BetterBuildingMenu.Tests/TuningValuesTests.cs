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
				new[] { "developerMode", "interfaceStyles", "tabNames", "listShare", "whatCounts", "autoLargeText", "cardsFrom", "listPlateHeight", "nameLines", "tileNameLine" },
				writer.PropertyNames);
			Assert.Equal(
				new[]
				{
					"Write:Boolean:True", "Write:Boolean:False", "Write:Boolean:True", "Write:Int32:50", "Write:String:costOrCapacity",
					"Write:String:lookOwn", "Write:Int32:0", "Write:Single:27.25", "Write:Int32:0", "Write:Boolean:True",
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

		// Each body knob ships as the constant the UI falls back to, and is read through the one rule.
		[Theory]
		[InlineData("DevListShare", "Tuning.ListShare")]
		[InlineData("DevWhatCounts", "Tuning.WhatCounts")]
		[InlineData("DevAutoLargeText", "Tuning.AutoLargeText")]
		[InlineData("DevCardsFrom", "Tuning.CardsFrom")]
		[InlineData("DevListPlateHeight", "Tuning.ListPlateHeight")]
		[InlineData("DevNameLines", "Tuning.NameLines")]
		[InlineData("DevTileNameLine", "Tuning.TileNameLine")]
		public void EachBodyKnobIsReadThroughTheOneRule(string knob, string shipped)
		{
			Assert.Contains($"Knobs.Value(settings => settings.{knob}, {shipped})", ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private static TuningValues CurrentTuning()"));
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
		}

		public static IEnumerable<object[]> Dropdowns() => new[]
		{
			new object[] { nameof(BetterBuildingMenuSettings.DevWhatCounts), Tuning.WhatCountsValues.Cast<object>().ToArray(), OptionRows.WhatCountsLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevAutoLargeText), Tuning.AutoLargeTextValues.Cast<object>().ToArray(), OptionRows.AutoLargeTextLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevCardsFrom), Tuning.CardsFromValues.Cast<object>().ToArray(), OptionRows.CardsFromLabelIds },
			new object[] { nameof(BetterBuildingMenuSettings.DevNameLines), Tuning.NameLinesValues.Cast<object>().ToArray(), OptionRows.NameLinesLabelIds },
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
