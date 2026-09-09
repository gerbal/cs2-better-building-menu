using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using BetterBuildingMenu;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The object picker went with the Find It separation: Find It ships the
	/// same tool, and two mods binding the same toolbar glyph, the same tool id
	/// and the same mouse Apply action is the conflict the separation was for.
	/// Nothing of it stays — not the tool, its options bank, its key or mouse
	/// bindings, its settings row, nor its locale rows.
	/// </summary>
	public class PickerRemovalTests
	{
		private static readonly Regex PickerRow = new Regex(
			"Picker(SubObjects|Buildings|Props|Networks|Surfaces|KeyBinding)|OpenPanelOnPicker|ApplyMimic",
			RegexOptions.Compiled);

		[Theory]
		[InlineData("PickerToolSystem")]
		[InlineData("PickerUISystem")]
		[InlineData("PickerTooltipSystem")]
		[InlineData("PickerFlags")]
		[InlineData("ObjectFilterOption")]
		public void ModAssemblyCarriesNoPickerType(string name)
		{
			var stale = typeof(BetterBuildingMenuSettings).Assembly.GetTypes()
				.Where(t => t.Name == name)
				.Select(t => t.FullName)
				.ToList();

			Assert.Empty(stale);
		}

		[Theory]
		[InlineData("PickerKeyBinding")]
		[InlineData("OpenPanelOnPicker")]
		[InlineData("ApplyMimic")]
		public void SettingsDeclareNoPickerRow(string property)
		{
			Assert.Null(typeof(BetterBuildingMenuSettings).GetProperty(property));
		}

		[Fact]
		public void LocaleCarriesNoPickerRows()
		{
			var stale = LoadLocale().Keys.Where(k => PickerRow.IsMatch(k)).ToList();

			Assert.Empty(stale);
		}

		private static Dictionary<string, string> LoadLocale()
		{
			using var stream = typeof(BetterBuildingMenuSettings).Assembly
				.GetManifestResourceStream("BetterBuildingMenu.Locale.json");

			Assert.NotNull(stream);

			using var reader = new StreamReader(stream!);

			return JsonSerializer.Deserialize<Dictionary<string, string>>(reader.ReadToEnd())
				?? new Dictionary<string, string>();
		}
	}
}
