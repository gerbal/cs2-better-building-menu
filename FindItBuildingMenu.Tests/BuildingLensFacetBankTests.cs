using System.IO;
using System.Text.RegularExpressions;

using FindItBuildingMenu.Domain;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	public class BuildingLensFacetBankTests
	{
		[Theory]
		[InlineData(1, true)]
		[InlineData(BuildingLensFacetBank.BankThreshold, true)]
		[InlineData(BuildingLensFacetBank.BankThreshold + 1, false)]
		public void BelongsInBank_TakesDimensionsUpToTheThreshold(int optionCount, bool expected)
		{
			Assert.Equal(expected, BuildingLensFacetBank.BelongsInBank(optionCount));
		}

		[Fact]
		public void BelongsInBank_RejectsAnEmptyDimension()
		{
			// Not "short enough to draw" — nothing to draw. An empty icon row is
			// a heading over blank space.
			Assert.False(BuildingLensFacetBank.BelongsInBank(0));
			Assert.False(BuildingLensFacetBank.BelongsInBank(-1));
		}

		[Fact]
		public void BankThreshold_AgreesWithTheUiConstantItIsCopiedFrom()
		{
			// The bank and the rail split one range between them: the bank draws
			// a dimension of BankThreshold options or fewer, and railHomeFor
			// returns "bank" over exactly the same range so the rail declines it.
			// Nothing but this test stops the two numbers drifting, and drift
			// does not fail a build — it draws Availability, Provenance or
			// Placement twice in two different idioms, or leaves it nowhere at
			// all. Same arrangement as PaneWidth_AgreesWithTheUiConstantItIsCopiedFrom.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "UI", "src", "domain", "filterRail.ts"));

			var match = Regex.Match(source, @"RAIL_BANK_THRESHOLD\s*=\s*(\d+)");

			Assert.True(match.Success, "RAIL_BANK_THRESHOLD not found in filterRail.ts");
			Assert.Equal(BuildingLensFacetBank.BankThreshold, int.Parse(match.Groups[1].Value));
		}

		[Fact]
		public void RailHomeFor_UsesTheSameComparisonThisSideDoes()
		{
			// The constant matching is not enough on its own: the two sides also
			// have to compare against it the same way. `<=` here and `<` there
			// would put a dimension of exactly BankThreshold options in both
			// places while both constants still read 8.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "UI", "src", "domain", "filterRail.ts"));

			Assert.Matches(@"optionCount\s*<=\s*RAIL_BANK_THRESHOLD\)\s*return\s*""bank""", source);
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
