using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Options.Picker;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The picker's filter row names itself out of Locale.json, and falls back to
	/// the English written beside each icon when the active locale has no entry.
	/// </summary>
	/// <remarks>
	/// That fallback used to be absent: GetTooltip took no fallback and Translate
	/// answers a miss with the id, so every locale but English drew the literal
	/// text "Tooltip.LABEL[BetterBuildingMenu.PickerBuildings]" across five chips.
	/// Each locale is registered as its own DictionarySource with no merge against
	/// the English one, so "the key is in Locale.json" is not enough on its own.
	///
	/// Both halves are asserted because both can rot independently: a key can be
	/// dropped from Locale.json, and a hand-written fallback can drift from the
	/// English it is meant to mirror. The second is not hypothetical — this table
	/// briefly read "Any" against a key that ships "All".
	/// </remarks>
	public sealed class PickerOptionTests
	{
		[Fact]
		public void EveryFilterShipsAnEnglishStringUnderItsOwnKey()
		{
			var locale = LoadLocale();
			var missing = new List<string>();

			foreach (var flag in ObjectFilterOption.Styles.Keys)
			{
				var key = $"Tooltip.LABEL[BetterBuildingMenu.{ObjectFilterOption.TooltipKeyFor(flag)}]";

				if (!locale.ContainsKey(key))
				{
					missing.Add(key);
				}
			}

			Assert.True(missing.Count == 0, $"Locale.json is missing: {string.Join(", ", missing)}");
		}

		[Fact]
		public void EveryFallbackSaysWhatLocaleJsonSays()
		{
			var locale = LoadLocale();

			foreach (var (flag, style) in ObjectFilterOption.Styles)
			{
				var key = $"Tooltip.LABEL[BetterBuildingMenu.{ObjectFilterOption.TooltipKeyFor(flag)}]";

				Assert.True(
					locale.TryGetValue(key, out var english),
					$"Locale.json is missing {key}");

				Assert.Equal(english, style.Label);
			}
		}

		[Fact]
		public void EveryFilterHasAnIcon()
		{
			foreach (var (flag, style) in ObjectFilterOption.Styles)
			{
				Assert.False(string.IsNullOrWhiteSpace(style.Icon), flag.ToString());
			}
		}

		/// <summary>
		/// The mod assembly's own embedded copy, as GameLocaleKeyTests does, so
		/// this cannot pass by finding a stale file beside the test binary.
		/// </summary>
		private static Dictionary<string, string> LoadLocale()
		{
			using var stream = typeof(PickerFlags).Assembly
				.GetManifestResourceStream("BetterBuildingMenu.Locale.json");

			Assert.NotNull(stream);

			using var reader = new StreamReader(stream!);

			return JsonSerializer.Deserialize<Dictionary<string, string>>(reader.ReadToEnd())
				?? new Dictionary<string, string>();
		}
	}
}
