using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Holds a release's log to what the owner asked for: extremely minimal. Info reaches every
	/// player's log, so a new Info line is a line in thousands of files; diagnostics go to Debug,
	/// which a development build turns on.
	/// </summary>
	public sealed class ReleaseLoggingTests
	{
		// The only Info lines a release writes: one at load, and one summary per full index pass.
		private static readonly string[] Allowed =
		{
			"Mod.cs: Log.Info(nameof(OnLoad));",
			"Systems/PrefabIndexingSystem.cs: Mod.Log.Info(summary);",
		};

		private static string ModSourceRoot([CallerFilePath] string testFile = "") =>
			Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", "BetterBuildingMenu"));

		[Fact]
		public void LogsAtInfoOnlyAtLoadAndOncePerFullPass()
		{
			var root = ModSourceRoot();
			var calls = Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)
				.Where(path => !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
					&& !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
				.SelectMany(path => File.ReadLines(path)
					.Where(line => Regex.IsMatch(line, @"\bLog\.Info(Format)?\s*\("))
					.Select(line => $"{Path.GetRelativePath(root, path).Replace('\\', '/')}: {line.Trim()}"))
				.OrderBy(call => call)
				.ToArray();

			Assert.Equal(Allowed.OrderBy(call => call), calls);
		}
	}
}
