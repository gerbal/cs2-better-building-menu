using BetterBuildingMenu.Utilities;

using System.IO;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The write path release.json and history.json share. The mod runs on net48, where
	/// File.Move cannot overwrite, so both of its branches are run here.
	/// </summary>
	public sealed class AtomicFileTests : IDisposable
	{
		private readonly string _root = Path.Combine(Path.GetTempPath(), "bbm-atomic-" + Guid.NewGuid().ToString("N"));

		public AtomicFileTests()
		{
			Directory.CreateDirectory(_root);
		}

		public void Dispose()
		{
			try { Directory.Delete(_root, recursive: true); } catch { /* temp */ }
		}

		[Fact]
		public void CreatesAFileThatIsNotThere()
		{
			var path = Path.Combine(_root, "a.json");

			AtomicFile.WriteAllText(path, "one");

			Assert.Equal("one", File.ReadAllText(path));
			Assert.False(File.Exists(path + ".tmp"));
		}

		[Fact]
		public void ReplacesAFileThatIsThere()
		{
			var path = Path.Combine(_root, "a.json");
			File.WriteAllText(path, "old");

			AtomicFile.WriteAllText(path, "new");

			Assert.Equal("new", File.ReadAllText(path));
			Assert.False(File.Exists(path + ".tmp"));
		}

		[Fact]
		public void WritesOverATemporaryFileAKilledWriteLeftBehind()
		{
			var path = Path.Combine(_root, "a.json");
			File.WriteAllText(path, "old");
			File.WriteAllText(path + ".tmp", "half");

			AtomicFile.WriteAllText(path, "new");

			Assert.Equal("new", File.ReadAllText(path));
			Assert.False(File.Exists(path + ".tmp"));
		}

		[Fact]
		public void MovesOverAFileThatIsThere()
		{
			var source = Path.Combine(_root, "a.json");
			var destination = Path.Combine(_root, "a.json.bad");
			File.WriteAllText(source, "second");
			File.WriteAllText(destination, "first");

			AtomicFile.MoveOver(source, destination);

			Assert.False(File.Exists(source));
			Assert.Equal("second", File.ReadAllText(destination));
		}
	}
}
