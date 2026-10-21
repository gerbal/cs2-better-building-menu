namespace BetterBuildingMenu.Tests
{
	/// <summary>Where the repository's sources are, for tests that read them.</summary>
	internal static class TestPaths
	{
		/// <summary>The checkout's root: the nearest folder above the test run that holds the mod's project.</summary>
		public static string RepoRoot()
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
