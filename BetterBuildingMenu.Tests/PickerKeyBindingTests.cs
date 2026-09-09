using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using BetterBuildingMenu;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The picker's toolbar entry went with the Find It separation; a key
	/// binding for a tool the player cannot otherwise reach is a dangling row
	/// in the Options menu, and Ctrl+P kept activating that tool from nowhere.
	/// </summary>
	public class PickerKeyBindingTests
	{
		[Fact]
		public void SettingsDeclareNoPickerKeyBinding()
		{
			Assert.Null(typeof(BetterBuildingMenuSettings).GetProperty("PickerKeyBinding"));
		}

		[Fact]
		public void LocaleCarriesNoPickerKeyBindingRows()
		{
			var stale = LoadLocale().Keys.Where(k => k.Contains("PickerKeyBinding")).ToList();

			Assert.Empty(stale);
		}

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
