using BetterBuildingMenu.Utilities;

using System.IO;

namespace BetterBuildingMenu.Tests
{
	/// <summary>picks.jsonl: one line per event, rolled at 5 MB, and never a reason for the game to stop.</summary>
	public sealed class PickLogFileTests : IDisposable
	{
		private readonly string _root = Path.Combine(Path.GetTempPath(), "bbm-picks-" + Guid.NewGuid().ToString("N"));
		private readonly List<string> _warnings = new();

		public PickLogFileTests()
		{
			Directory.CreateDirectory(Folder);
		}

		public void Dispose()
		{
			try { Directory.Delete(_root, recursive: true); } catch { /* temp */ }
		}

		private string Folder => Path.Combine(_root, "BetterBuildingMenu");

		private string LogPath => Path.Combine(Folder, PickLogFile.FileName);

		private string RolledPath => Path.Combine(Folder, PickLogFile.RolledName);

		private PickLogFile Log() => new(Folder, _warnings.Add);

		[Fact]
		public void AppendsOneLinePerEvent()
		{
			var log = Log();

			log.Append(new[] { "{\"a\":1}", "{\"b\":2}" });
			log.Append(new[] { "{\"c\":3}" });

			Assert.Equal("{\"a\":1}\n{\"b\":2}\n{\"c\":3}\n", File.ReadAllText(LogPath));
			Assert.Empty(_warnings);
		}

		[Fact]
		public void AtFiveMegabytesTheLogMovesToItsRolledNameReplacingTheOneBefore()
		{
			var full = new string('x', (int)PickLogFile.MaxBytes - 2);
			File.WriteAllText(LogPath, full);
			File.WriteAllText(RolledPath, "older");

			Log().Append(new[] { "abc" });

			Assert.Equal(full, File.ReadAllText(RolledPath));
			Assert.Equal("abc\n", File.ReadAllText(LogPath));
		}

		[Theory]
		[InlineData(0L, 10L, false)]
		[InlineData(PickLogFile.MaxBytes - 4, 4L, false)]
		[InlineData(PickLogFile.MaxBytes - 4, 5L, true)]
		[InlineData(PickLogFile.MaxBytes, 1L, true)]
		public void ALogRollsOnlyWhenTheLinesWouldCarryItPastTheLimit(long size, long adding, bool rolls)
		{
			Assert.Equal(rolls, PickLogFile.ShouldRoll(size, adding));
		}

		[Fact]
		public void AFolderThatIsAnOrdinaryFileThrowsNothingAndWarnsOnce()
		{
			Directory.Delete(Folder);
			File.WriteAllText(Folder, "not a folder");
			var log = Log();

			log.Append(new[] { "{}" });
			log.Append(new[] { "{}" });

			Assert.Single(_warnings);
		}

		[Fact]
		public void AWarnThatThrowsStillThrowsNothing()
		{
			Directory.Delete(Folder);
			File.WriteAllText(Folder, "not a folder");
			var log = new PickLogFile(Folder, _ => throw new InvalidOperationException("warn"));

			log.Append(new[] { "{}" });
		}

		[Fact]
		public void TheFileTakesBuiltLinesNotAQuery()
		{
			// A lazy query would be built inside the file's catch, and warn as a failed write.
			var lines = typeof(PickLogFile).GetMethod(nameof(PickLogFile.Append))!.GetParameters();

			Assert.Equal(typeof(IReadOnlyList<string>), Assert.Single(lines).ParameterType);
		}

		[Fact]
		public void NothingToAppendWritesNoFile()
		{
			Log().Append(Array.Empty<string>());

			Assert.False(File.Exists(LogPath));
		}

		[Fact]
		public void AFullLogRollsWhenNoRolledLogExistsYet()
		{
			var full = new string('x', (int)PickLogFile.MaxBytes - 2);
			File.WriteAllText(LogPath, full);

			Log().Append(new[] { "abc" });

			Assert.Equal(full, File.ReadAllText(RolledPath));
			Assert.Equal("abc\n", File.ReadAllText(LogPath));
		}

		[Fact]
		public void ARollThatFailsThrowsNothingAndWarnsOnce()
		{
			File.WriteAllText(LogPath, new string('x', (int)PickLogFile.MaxBytes - 2));
			Directory.CreateDirectory(RolledPath);
			var log = Log();

			log.Append(new[] { "abc" });
			log.Append(new[] { "abc" });

			Assert.Single(_warnings);
		}
	}
}
