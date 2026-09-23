using BetterBuildingMenu.Domain;

using System.IO;
using System.Text.RegularExpressions;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The lens's control-pane width, and the stylesheet that draws the pane.
	/// </summary>
	/// <remarks>
	/// The heights and the panel width reach the UI through the generated contracts
	/// (SharedContractsTests). The pane's width is the stylesheet's, which C# cannot
	/// generate into, so it is written twice and this test keeps the two together.
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
