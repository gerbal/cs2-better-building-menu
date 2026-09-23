using BetterBuildingMenu.Domain;

using System.IO;
using System.Text.RegularExpressions;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The lens's width and height constants, and the UI copies of them.
	/// </summary>
	/// <remarks>
	/// Each of these numbers is written twice, once in C# and once in the UI's
	/// TypeScript or stylesheets, with no shared source between them, so a test
	/// is the only thing standing between them and a silent drift.
	/// </remarks>
	public class BuildingLensDimensionTests
	{
		[Fact]
		public void PaneWidth_AgreesWithTheUiConstantItIsCopiedFrom()
		{
			// If this fails, the panel reserves a different width than the pane
			// occupies. The pane's width and the gap beside it are stated in
			// _lensGeometry.scss: its stylesheet draws them, and buildingLensLayout.ts
			// reads their sum to budget the table's name width.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "BetterBuildingMenu", "UI", "src", "_lensGeometry.scss"));

			var width = Regex.Match(source, @"^\$pane-width:\s*(\d+)rem;", RegexOptions.Multiline);
			var gap = Regex.Match(source, @"^\$pane-gap:\s*(\d+)rem;", RegexOptions.Multiline);

			Assert.True(width.Success, "$pane-width not found in _lensGeometry.scss");
			Assert.True(gap.Success, "$pane-gap not found in _lensGeometry.scss");
			Assert.Equal(
				BuildingLensWidth.ControlPane,
				float.Parse(width.Groups[1].Value) + float.Parse(gap.Groups[1].Value));
		}

		[Fact]
		public void MaxWidth_AgreesWithTheBandTheUiDerivesItFrom()
		{
			// The width is fixed at Max, and the UI sizes the table's columns against
			// its own copy of the same band, so the two must derive the same number.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "BetterBuildingMenu", "UI", "src", "domain", "buildingLensLayout.ts"));

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
				RepoRoot(), "BetterBuildingMenu", "UI", "src", "domain", "buildingLensLayout.ts"));

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

			while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "BetterBuildingMenu")))
			{
				dir = dir.Parent;
			}

			Assert.NotNull(dir);

			return dir!.FullName;
		}
	}
}
