using BetterBuildingMenu.Domain.Placement;
using BetterBuildingMenu.Utilities;

using System.IO;
using System.Text.Json;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// history.json: version 1, read once a launch, written only by a flush, and never
	/// a reason for the game to stop.
	/// </summary>
	public sealed class PlacementHistoryFileTests : IDisposable
	{
		private const string Roads = "Roads";

		private readonly string _root = Path.Combine(Path.GetTempPath(), "bbm-history-" + Guid.NewGuid().ToString("N"));
		private readonly List<string> _debug = new();
		private readonly List<string> _warnings = new();

		public PlacementHistoryFileTests()
		{
			Directory.CreateDirectory(Folder);
		}

		public void Dispose()
		{
			try { Directory.Delete(_root, recursive: true); } catch { /* temp */ }
		}

		private string Folder => Path.Combine(_root, "BetterBuildingMenu");

		private string HistoryPath => Path.Combine(Folder, PlacementHistoryFile.FileName);

		private PlacementHistoryFile HistoryFile() => new(Folder, _debug.Add, _warnings.Add);

		private static PlacementHistory Placed(string menu, params string[] prefabs)
		{
			var history = new PlacementHistory();

			foreach (var prefab in prefabs)
			{
				history.Record(menu, prefab);
			}

			return history;
		}

		[Fact]
		public void WritesVersionOneWithMenusAlone()
		{
			HistoryFile().FlushIfDirty(Placed(Roads, "Small Road", "Small Road", "Medium Road"));

			using var document = JsonDocument.Parse(File.ReadAllText(HistoryPath));
			var root = document.RootElement;
			var roads = root.GetProperty("menus").GetProperty(Roads);

			Assert.Equal(new[] { "version", "menus" }, root.EnumerateObject().Select(property => property.Name));
			Assert.Equal(1, root.GetProperty("version").GetInt32());
			Assert.Equal("Medium Road", roads.GetProperty("latest").GetString());
			Assert.Equal(new[] { "Small Road", "Medium Road" }, roads.GetProperty("held").EnumerateArray().Select(name => name.GetString()));
			Assert.Equal(2f, roads.GetProperty("counts").GetProperty("Small Road").GetSingle());
		}

		[Fact]
		public void RoundTripsWhenNoFileExists()
		{
			var history = Placed(Roads, "Small Road", "Medium Road");

			HistoryFile().FlushIfDirty(history);

			Assert.False(history.IsDirty);
			Assert.Equal(PlacementHistoryJson.Write(history), PlacementHistoryJson.Write(PlacementHistoryJson.Read(File.ReadAllText(HistoryPath)).History));
			Assert.False(File.Exists(HistoryPath + ".tmp"));
		}

		[Fact]
		public void RoundTripsOverAnExistingFile()
		{
			var file = HistoryFile();
			var history = Placed(Roads, "Small Road");
			file.FlushIfDirty(history);

			history.Record(Roads, "Medium Road");
			file.FlushIfDirty(history);

			Assert.Equal(PlacementHistoryJson.Write(history), PlacementHistoryJson.Write(PlacementHistoryJson.Read(File.ReadAllText(HistoryPath)).History));
			Assert.False(File.Exists(HistoryPath + ".tmp"));
			Assert.Empty(_warnings);
		}

		[Fact]
		public void AFlushWithNothingNewWritesNothing()
		{
			HistoryFile().FlushIfDirty(new PlacementHistory());

			Assert.False(File.Exists(HistoryPath));
		}

		[Fact]
		public void LoadingHalvesTheCountsAndLeavesTheFileAsItWas()
		{
			HistoryFile().FlushIfDirty(Placed(Roads, "Small Road", "Small Road", "Small Road", "Small Road"));
			var written = File.ReadAllText(HistoryPath);

			var loaded = HistoryFile().Load();

			Assert.Equal(2f, loaded.Menus[Roads].Counts["Small Road"]);
			Assert.False(loaded.IsDirty);
			Assert.Equal(written, File.ReadAllText(HistoryPath));
		}

		[Fact]
		public void AMissingFileIsAnEmptyHistoryAndOneLine()
		{
			var loaded = HistoryFile().Load();

			Assert.Empty(loaded.Menus);
			Assert.False(loaded.IsReadOnly);
			Assert.Single(_debug);
			Assert.Empty(_warnings);
		}

		[Theory]
		[InlineData("{ not json")]
		[InlineData("")]
		[InlineData("[]")]
		[InlineData("{\"menus\":{}}")]
		[InlineData("{\"version\":\"1\",\"menus\":{}}")]
		[InlineData("{\"version\":0,\"menus\":{}}")]
		public void AFileThatIsNotAHistoryIsSetAsideAndAFreshOneWrittenAtTheNextFlush(string text)
		{
			File.WriteAllText(HistoryPath, text);
			var file = HistoryFile();

			var loaded = file.Load();

			Assert.Empty(loaded.Menus);
			Assert.Single(_warnings);
			Assert.Equal(text, File.ReadAllText(HistoryPath + ".bad"));
			Assert.False(File.Exists(HistoryPath));

			loaded.Record(Roads, "Small Road");
			file.FlushIfDirty(loaded);

			Assert.Equal(1f, PlacementHistoryJson.Read(File.ReadAllText(HistoryPath)).History.Menus[Roads].Counts["Small Road"]);
		}

		[Fact]
		public void ABadFileReplacesAnOlderBadOne()
		{
			File.WriteAllText(HistoryPath + ".bad", "older");
			File.WriteAllText(HistoryPath, "newer");

			HistoryFile().Load();

			Assert.Equal("newer", File.ReadAllText(HistoryPath + ".bad"));
		}

		[Fact]
		public void ANewerFileIsReadCountsNothingAndIsNeverRewritten()
		{
			const string Newer = "{\"version\":2,\"menus\":{\"Roads\":{\"counts\":{\"Small Road\":3}}},\"seenMods\":[\"local:Some\"]}";
			File.WriteAllText(HistoryPath, Newer);
			var file = HistoryFile();

			var loaded = file.Load();
			loaded.Record(Roads, "Medium Road");
			file.FlushIfDirty(loaded);

			Assert.True(loaded.IsReadOnly);
			Assert.Empty(loaded.Menus);
			Assert.Single(_warnings);
			Assert.Equal(Newer, File.ReadAllText(HistoryPath));
		}

		[Fact]
		public void AFlushWhereTheFolderIsAnOrdinaryFileThrowsNothingAndWarnsOnce()
		{
			Directory.Delete(Folder);
			File.WriteAllText(Folder, "not a folder");
			var file = HistoryFile();
			var history = Placed(Roads, "Small Road");

			file.FlushIfDirty(history);
			file.FlushIfDirty(history);

			Assert.Single(_warnings);
			Assert.True(history.IsDirty);
		}

		[Fact]
		public void AFlushThatCannotWriteWarnsOnceAndWritesAtTheNextFlushThatCan()
		{
			// A folder where the temporary file goes stands in for a locked file or a full disk.
			Directory.CreateDirectory(HistoryPath + ".tmp");
			var file = HistoryFile();
			var history = Placed(Roads, "Small Road");

			file.FlushIfDirty(history);
			history.Record(Roads, "Small Road");
			file.FlushIfDirty(history);
			Directory.Delete(HistoryPath + ".tmp");
			file.FlushIfDirty(history);

			Assert.Single(_warnings);
			Assert.False(history.IsDirty);
			Assert.Equal(2f, PlacementHistoryJson.Read(File.ReadAllText(HistoryPath)).History.Menus[Roads].Counts["Small Road"]);
		}

		[Fact]
		public void AFileAnotherProgramHoldsAtLaunchIsLeftAloneForTheSession()
		{
			HistoryFile().FlushIfDirty(Placed(Roads, "Small Road"));
			var written = File.ReadAllText(HistoryPath);
			var file = HistoryFile();
			PlacementHistory loaded;

			using (new FileStream(HistoryPath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
			{
				loaded = file.Load();
			}

			loaded.Record(Roads, "Medium Road");
			file.FlushIfDirty(loaded);

			Assert.True(loaded.IsReadOnly);
			Assert.Single(_warnings);
			Assert.Equal(written, File.ReadAllText(HistoryPath));
		}

		[Fact]
		public void ATemporaryFileAKilledFlushLeftIsIgnoredAndOverwritten()
		{
			HistoryFile().FlushIfDirty(Placed(Roads, "Small Road", "Small Road"));
			File.WriteAllText(HistoryPath + ".tmp", "{\"version\":1,\"menus\":{\"Ro");
			var file = HistoryFile();

			var loaded = file.Load();
			loaded.Record(Roads, "Small Road");
			file.FlushIfDirty(loaded);

			Assert.Empty(_warnings);
			Assert.False(File.Exists(HistoryPath + ".tmp"));
			Assert.Equal(2f, PlacementHistoryJson.Read(File.ReadAllText(HistoryPath)).History.Menus[Roads].Counts["Small Road"]);
		}

		[Fact]
		public void NamesThatNeedEscapingRoundTrip()
		{
			var history = new PlacementHistory();
			var prefabs = new[] { "Quote \"Road\"", "Back\\slash Road", "Straße", "道路", "Tab\tRoad" };

			foreach (var prefab in prefabs)
			{
				history.Record("Parks & Recreation", prefab);
			}

			HistoryFile().FlushIfDirty(history);
			var text = File.ReadAllText(HistoryPath);

			using var document = JsonDocument.Parse(text);
			Assert.Equal(
				prefabs.OrderBy(name => name, StringComparer.Ordinal),
				document.RootElement.GetProperty("menus").GetProperty("Parks & Recreation").GetProperty("counts").EnumerateObject().Select(property => property.Name).OrderBy(name => name, StringComparer.Ordinal));
			Assert.Equal(PlacementHistoryJson.Write(history), PlacementHistoryJson.Write(PlacementHistoryJson.Read(text).History));
		}

		[Fact]
		public void AHandEditedFileKeepsWhatIsWellFormedWithoutSettingItAside()
		{
			File.WriteAllText(HistoryPath, @"{
				""version"": 1,
				""menus"": {
					""Roads"": {
						""latest"": ""Gone Road"",
						""held"": [""Small Road"", ""Gone Road"", 7, ""Medium Road"", ""Alley""],
						""counts"": { ""Small Road"": 4, ""Medium Road"": 2, ""Alley"": ""six"", ""Huge"": 1e40, ""Negative"": -3 }
					},
					""Parks & Recreation"": ""not a menu"",
					""Landscaping"": { ""counts"": null }
				}
			}");

			var loaded = HistoryFile().Load();
			var roads = loaded.Menus[Roads];

			Assert.Equal(new[] { Roads }, loaded.Menus.Keys);
			Assert.Equal(new[] { "Medium Road", "Small Road" }, roads.Counts.Keys.OrderBy(name => name, StringComparer.Ordinal));
			Assert.Equal(2f, roads.Counts["Small Road"]);
			Assert.Null(roads.Latest);
			Assert.Equal(new[] { "Small Road", "Medium Road" }, roads.Held);
			Assert.Empty(_warnings);
			Assert.False(File.Exists(HistoryPath + ".bad"));
		}

		[Fact]
		public void AFileWithNoMenusIsAnEmptyHistory()
		{
			File.WriteAllText(HistoryPath, "{\"version\":1,\"menus\":null}");

			Assert.Empty(HistoryFile().Load().Menus);
			Assert.Empty(_warnings);
		}
	}
}
