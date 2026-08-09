using FindItBuildingMenu.Domain;

using System.IO;
using System.Text.RegularExpressions;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The one-time widening of a panel width saved before the control plane.
	/// </summary>
	public class BuildingLensWidthMigrationTests
	{
		[Fact]
		public void Migration_GivesBackWhatThePaneTakes()
		{
			// The setting used to mean the build menu alone. A player who had
			// 800 was looking at an 800-wide menu; after the pane it would draw
			// 800 - 385 unless the saved value grows by the same amount.
			Assert.Equal(
				800f + BuildingLensWidth.ControlPane,
				BuildingLensWidth.Migrate(800f, alreadyIncludesPane: false));
		}

		[Fact]
		public void Migration_StopsAtTheBandForAWidthAlreadyNearIt()
		{
			// Landing exactly on the band is the right answer rather than a
			// compromise — it is the widest the assembly can be at 1280x720.
			//
			// The value here had to move when the band widened. It used to be
			// this branch's dev profile, a saved 1042: that wanted 1427 and
			// could not have it against the old 1232 ceiling. Now that
			// left-aligning vanilla's column trio has taken the band to 1441,
			// 1427 fits, so it no longer demonstrates clamping at all — see
			// Migration_LeavesAWidthTheWiderBandCanNowHold. A saved value that
			// still overshoots is what this test needs.
			Assert.Equal(
				BuildingLensWidth.Max,
				BuildingLensWidth.Migrate(1200f, alreadyIncludesPane: false));
		}

		[Fact]
		public void Migration_LeavesAWidthTheWiderBandCanNowHold()
		{
			// The old dev-profile case, kept because its answer changed and the
			// change is the point: 1042 + 385 = 1427 was clamped to 1232 and now
			// passes through intact. Nothing had to migrate twice for that —
			// widening the ceiling does not alter what a saved width means.
			Assert.Equal(1427f, BuildingLensWidth.Migrate(1042f, alreadyIncludesPane: false));
		}

		[Fact]
		public void Migration_RunsOnceAndIsIdempotentThereafter()
		{
			// The marker is the whole point: without it this either never runs
			// or runs every boot, growing the panel by the pane each time.
			var once = BuildingLensWidth.Migrate(1042f, alreadyIncludesPane: false);

			Assert.Equal(once, BuildingLensWidth.Migrate(once, alreadyIncludesPane: true));
		}

		[Fact]
		public void Migration_ClampsAfterWideningRatherThanBefore()
		{
			// A player at the old maximum (1200) must land on the new one, not
			// overshoot the band. Widening first and clamping second is what
			// makes that true; the other order would return 1200 + 385.
			Assert.Equal(
				BuildingLensWidth.Max,
				BuildingLensWidth.Migrate(1200f, alreadyIncludesPane: false));
		}

		[Fact]
		public void Migration_NeverReturnsLessThanTheMinimum()
		{
			// The old floor was 700, below the new one, so the narrowest saved
			// values have to come up rather than through.
			Assert.True(
				BuildingLensWidth.Migrate(700f, alreadyIncludesPane: false)
					>= BuildingLensWidth.Min);
		}

		[Fact]
		public void PaneWidth_AgreesWithTheUiConstantItIsCopiedFrom()
		{
			// There is no shared source across the C#/TS boundary, so this is
			// the only thing stopping the two drifting apart — the same
			// arrangement the grouping band edges already rely on. If this
			// fails, the migration hands back a different width than the pane
			// actually takes.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "UI", "src", "mods", "LensControlPane", "LensControlPane.tsx"));

			var match = Regex.Match(source, @"LENS_CONTROL_PANE_TOTAL\s*=\s*(\d+)");

			Assert.True(match.Success, "LENS_CONTROL_PANE_TOTAL not found in LensControlPane.tsx");
			Assert.Equal(BuildingLensWidth.ControlPane, float.Parse(match.Groups[1].Value));
		}

		[Fact]
		public void MaxWidth_AgreesWithTheDragCeilingTheUiClampsTo()
		{
			// The resize handle clamps with the TS constant and the setting is
			// stored through this one, so a gap between them is a range the
			// player can drag into and never keep. They were 1235 and 1232 —
			// three rem of every drag quietly clamped away on commit — and the
			// gap would have been 206 once the band widened, which would have
			// locked the panel out of the space this change reclaims.
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
			// Same arrangement as the width twins above, and the same failure if it
			// drifts: the drag clamps with the TS numbers and the setting is stored
			// through these, so a gap is a height the player can reach and not keep.
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
