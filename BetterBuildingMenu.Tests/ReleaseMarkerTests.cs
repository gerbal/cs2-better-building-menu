using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;

using Game.Settings;

using System.IO;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What a release leaves for a later one to read: release.json in ModsData, and the
	/// settings version.
	/// </summary>
	public sealed class ReleaseMarkerTests : IDisposable
	{
		private readonly string _root = Path.Combine(Path.GetTempPath(), "bbm-marker-" + Guid.NewGuid().ToString("N"));
		private readonly List<string> _warnings = new();

		public ReleaseMarkerTests()
		{
			Directory.CreateDirectory(_root);
		}

		public void Dispose()
		{
			try { Directory.Delete(_root, recursive: true); } catch { /* temp */ }
		}

		private string Folder => Path.Combine(_root, "BetterBuildingMenu");

		private string MarkerPath => Path.Combine(Folder, ReleaseMarker.FileName);

		private ReleaseMarkerData? Update(string release) => ReleaseMarkerFile.Update(Folder, release, _warnings.Add);

		private void WriteStamp()
		{
			var silhouettes = Path.Combine(Folder, SilhouetteIconCache.FolderName);
			Directory.CreateDirectory(silhouettes);
			File.WriteAllText(Path.Combine(silhouettes, SilhouetteIconCache.StampFileName), "tint=#191919");
		}

		private static string ModFile(string name, [CallerFilePath] string testFile = "") =>
			Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", "BetterBuildingMenu", name));

		[Fact]
		public void AnAbsentMarkerIsFirstWrittenByThisRelease()
		{
			var marker = ReleaseMarker.Merge(ReleaseMarker.Read(null), "0.2.5", stampExists: true);

			Assert.Equal(new ReleaseMarkerData(1, "0.2.5", "0.2.5", true), marker);
		}

		[Fact]
		public void APresentMarkerKeepsItsFirstReleaseAndStampReadingAndMovesLast()
		{
			var existing = ReleaseMarker.Read("{\"version\":1,\"first\":\"0.2.5\",\"last\":\"0.2.5\",\"stampBefore\":false}");

			Assert.Equal(new ReleaseMarkerData(1, "0.2.5", "0.2.6", false), ReleaseMarker.Merge(existing, "0.2.6", stampExists: true));
		}

		[Theory]
		[InlineData("")]
		[InlineData("not json")]
		[InlineData("{\"version\": 1, \"first\": ")]
		[InlineData("[1, 2]")]
		[InlineData("{\"first\":\"0.2.5\",\"last\":\"0.2.5\",\"stampBefore\":true}")]
		[InlineData("{\"version\":\"1\",\"first\":\"0.2.5\",\"last\":\"0.2.5\",\"stampBefore\":true}")]
		[InlineData("{\"version\":0,\"first\":\"0.2.5\",\"last\":\"0.2.5\",\"stampBefore\":true}")]
		[InlineData("{\"version\":1,\"first\":\" \",\"last\":\"0.2.5\",\"stampBefore\":true}")]
		[InlineData("{\"version\":1,\"first\":\"0.2.5\",\"last\":\"0.2.5\",\"stampBefore\":\"yes\"}")]
		public void ACorruptMarkerIsReplacedAsIfAbsent(string json)
		{
			var existing = ReleaseMarker.Read(json);

			Assert.Equal(ReleaseMarkerState.Corrupt, existing.State);
			Assert.Equal(new ReleaseMarkerData(1, "0.2.5", "0.2.5", false), ReleaseMarker.Merge(existing, "0.2.5", stampExists: false));
		}

		[Fact]
		public void AMarkerInANewerFormatIsLeftAsItIs()
		{
			var existing = ReleaseMarker.Read("{\"version\":2,\"first\":\"0.3.0\",\"seen\":[]}");

			Assert.Equal(ReleaseMarkerState.Newer, existing.State);
			Assert.Null(ReleaseMarker.Merge(existing, "0.2.5", stampExists: true));
		}

		[Fact]
		public void TheMarkerReadsBackWhatItWrites()
		{
			var marker = new ReleaseMarkerData(1, "0.2.5", "0.3.0", true);

			Assert.Equal(new ReleaseMarkerRead(ReleaseMarkerState.Read, marker), ReleaseMarker.Read(ReleaseMarker.Write(marker)));
		}

		[Fact]
		public void TheReleaseIsTheAssemblyVersionInThreeParts()
		{
			Assert.Equal("0.2.5", ReleaseMarker.ReleaseOf(new Version(0, 2, 5, 0)));
			Assert.Equal("1.0.0", ReleaseMarker.ReleaseOf(new Version(1, 0)));
			Assert.Equal("0.0.0", ReleaseMarker.ReleaseOf(null));
		}

		[Fact]
		public void TheMarkerNamesTheReleaseTheProjectDeclares()
		{
			var declared = Regex.Match(File.ReadAllText(ModFile("BetterBuildingMenu.csproj")), "<Version>([^<]+)</Version>").Groups[1].Value;

			Assert.Equal(declared, ReleaseMarker.ReleaseOf(typeof(Mod).Assembly.GetName().Version));
		}

		[Theory]
		[InlineData(0, 1)]
		[InlineData(-3, 1)]
		[InlineData(1, 1)]
		[InlineData(2, 2)]
		[InlineData(5, 5)]
		public void TheVersionStepRaisesOnlyAVersionBelowThisRelease(int stored, int expected)
		{
			Assert.Equal(expected, SettingsVersionStep.Next(stored));
		}

		[Fact]
		public void ASecondLoadHasNoVersionToSave()
		{
			// OnLoad saves only when the step changes the stored value.
			var first = SettingsVersionStep.Next(0);

			Assert.Equal(first, SettingsVersionStep.Next(first));
		}

		[Fact]
		public void TheVersionKeyIsHiddenStartsAtZeroAndIsLeftOutOfSetDefaults()
		{
			var property = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.SettingsVersion));

			Assert.NotNull(property);
			Assert.Equal(typeof(int), property!.PropertyType);
			Assert.True(property.IsDefined(typeof(SettingsUIHiddenAttribute), inherit: false));

			var source = File.ReadAllText(ModFile("Setting.cs"));

			// No initializer: the default object's 0 is what makes the game write a stepped 1.
			Assert.Matches(@"public int SettingsVersion \{ get; set; \}\r?\n", source);
			Assert.DoesNotContain("SettingsVersion", source.Substring(source.IndexOf("public override void SetDefaults()", StringComparison.Ordinal)));
		}

		[Fact]
		public void TheFirstLoadRecordsThisReleaseAndNoStamp()
		{
			var expected = new ReleaseMarkerData(1, "0.2.5", "0.2.5", false);

			Assert.Equal(expected, Update("0.2.5"));
			Assert.Equal(new ReleaseMarkerRead(ReleaseMarkerState.Read, expected), ReleaseMarker.Read(File.ReadAllText(MarkerPath)));
			Assert.False(File.Exists(MarkerPath + ".tmp"));
			Assert.Empty(_warnings);
		}

		[Fact]
		public void AStampAnEarlierReleaseWroteIsRecorded()
		{
			WriteStamp();

			Assert.True(Update("0.2.5")!.StampBefore);
		}

		[Fact]
		public void TheStampThisLoadsCacheWritesChangesNothingLater()
		{
			Update("0.2.5");

			// What Mod.OnLoad does next: the cache writes its stamp as it is built.
			_ = new SilhouetteIconCache(Array.Empty<string>(), Path.Combine(Folder, SilhouetteIconCache.FolderName));
			Assert.True(File.Exists(Path.Combine(Folder, SilhouetteIconCache.FolderName, SilhouetteIconCache.StampFileName)));

			Assert.Equal(new ReleaseMarkerData(1, "0.2.5", "0.2.6", false), Update("0.2.6"));
		}

		[Fact]
		public void TheMarkerIsWrittenBeforeTheSilhouetteCacheIsBuilt()
		{
			// The cache writes the stamp as it is built, and the marker records whether one was there before.
			var source = File.ReadAllText(ModFile("Mod.cs"));
			var marker = source.IndexOf("WriteReleaseMarker();", StringComparison.Ordinal);
			var cache = source.IndexOf("new SilhouetteIconCache(", StringComparison.Ordinal);

			Assert.True(marker >= 0, "Mod.cs no longer calls WriteReleaseMarker();");
			Assert.True(cache >= 0, "Mod.cs no longer builds the SilhouetteIconCache");
			Assert.True(marker < cache, "the release marker must be written before the silhouette cache is built");
		}

		[Fact]
		public void ACorruptFileIsReplacedWithOneWarning()
		{
			Directory.CreateDirectory(Folder);
			File.WriteAllText(MarkerPath, "{ broken");

			Assert.Equal(new ReleaseMarkerData(1, "0.2.5", "0.2.5", false), Update("0.2.5"));
			Assert.Single(_warnings);
		}

		[Fact]
		public void ANewerFileIsNotRewritten()
		{
			const string Newer = "{\"version\":2,\"first\":\"0.3.0\"}";
			Directory.CreateDirectory(Folder);
			File.WriteAllText(MarkerPath, Newer);

			Assert.Null(Update("0.2.5"));
			Assert.Equal(Newer, File.ReadAllText(MarkerPath));
			Assert.Empty(_warnings);
		}

		[Fact]
		public void AFolderThatIsAnOrdinaryFileThrowsNothingAndWarnsOnce()
		{
			File.WriteAllText(Folder, "not a folder");

			Assert.Null(Update("0.2.5"));
			Assert.Single(_warnings);
		}
	}
}
