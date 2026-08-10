using FindItBuildingMenu.Domain;

using System.IO;
using System.Text.RegularExpressions;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The lens's width and height constants, and the UI copies of them.
	/// </summary>
	/// <remarks>
	/// This was BuildingLensWidthMigrationTests, and most of it tested a
	/// one-time migration of a saved panel width. Both are gone: the width is
	/// no longer a saved value, so there is nothing to migrate and nothing to
	/// migrate it from. See GridUtil.GetCurrentPanelWidth.
	///
	/// What survives is the part that guards a boundary rather than a
	/// behaviour. Each of these numbers is written twice, once in C# and once
	/// in TypeScript, with no shared source between them — so a test is the
	/// only thing standing between them and a silent drift.
	/// </remarks>
	public class BuildingLensDimensionTests
	{
		[Fact]
		public void PaneWidth_AgreesWithTheUiConstantItIsCopiedFrom()
		{
			// If this fails, the panel reserves a different width than the pane
			// actually occupies, and they overlap or leave a gap.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "UI", "src", "mods", "LensControlPane", "LensControlPane.tsx"));

			var match = Regex.Match(source, @"LENS_CONTROL_PANE_TOTAL\s*=\s*(\d+)");

			Assert.True(match.Success, "LENS_CONTROL_PANE_TOTAL not found in LensControlPane.tsx");
			Assert.Equal(BuildingLensWidth.ControlPane, float.Parse(match.Groups[1].Value));
		}

		[Fact]
		public void MaxWidth_AgreesWithTheBandTheUiDerivesItFrom()
		{
			// The width is fixed at Max now, and the UI sizes the table's columns
			// against its own copy of the same band. They read 1235 and 1232 once,
			// three rem apart, which is exactly the kind of gap nothing notices.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "UI", "src", "domain", "buildingLensLayout.ts"));

			var band = Regex.Match(source, @"BUILDING_LENS_BAND_WIDTH\s*=\s*(\d+)");
			var chrome = Regex.Match(source, @"BUILDING_LENS_PANEL_CHROME_WIDTH\s*=\s*(\d+)");

			Assert.True(band.Success, "BUILDING_LENS_BAND_WIDTH not found in buildingLensLayout.ts");
			Assert.True(chrome.Success, "BUILDING_LENS_PANEL_CHROME_WIDTH not found in buildingLensLayout.ts");
			Assert.Equal(
				BuildingLensWidth.Max,
				float.Parse(band.Groups[1].Value) - float.Parse(chrome.Groups[1].Value));
		}

		[Fact]
		public void Height_AgreesWithTheDragRangeTheUiClampsTo()
		{
			// The drag clamps with the TS numbers and the setting is stored
			// through these, so a gap is a height the player can reach and not
			// keep.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "UI", "src", "domain", "buildingLensLayout.ts"));

			var min = Regex.Match(source, @"BUILDING_LENS_MIN_HEIGHT\s*=\s*(\d+)");
			var max = Regex.Match(source, @"BUILDING_LENS_MAX_HEIGHT\s*=\s*(\d+)");
			var def = Regex.Match(source, @"BUILDING_LENS_DEFAULT_HEIGHT\s*=\s*(\d+)");

			Assert.True(min.Success && max.Success && def.Success, "height constants not found in buildingLensLayout.ts");
			Assert.Equal(BuildingLensHeight.Min, float.Parse(min.Groups[1].Value));
			Assert.Equal(BuildingLensHeight.Max, float.Parse(max.Groups[1].Value));
			Assert.Equal(BuildingLensHeight.Default, float.Parse(def.Groups[1].Value));
		}

		private static string RepoRoot()
		{
			var dir = new DirectoryInfo(Directory.GetCurrentDirectory());

			while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "FindIt")))
			{
				dir = dir.Parent;
			}

			Assert.NotNull(dir);

			return dir!.FullName;
		}
	}
}
