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
			// This branch's dev profile: a saved 1042 wants 1427 and cannot have
			// it, because the band is 1232. Landing exactly on the band is the
			// right answer rather than a compromise — it is the widest the
			// assembly can be at 1280x720.
			Assert.Equal(
				BuildingLensWidth.Max,
				BuildingLensWidth.Migrate(1042f, alreadyIncludesPane: false));
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
