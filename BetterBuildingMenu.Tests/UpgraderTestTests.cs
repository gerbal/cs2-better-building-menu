using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;

using System.IO;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Who ran a release before the redesign: the first of the signs those releases left that
	/// answers, in the ruled order, and what ModsData held before this load wrote there.
	/// </summary>
	public sealed class UpgraderTestTests : IDisposable
	{
		private readonly string _root = Path.Combine(Path.GetTempPath(), "bbm-upgrader-" + Guid.NewGuid().ToString("N"));

		public UpgraderTestTests()
		{
			Directory.CreateDirectory(_root);
		}

		public void Dispose()
		{
			try { Directory.Delete(_root, recursive: true); } catch { /* temp */ }
		}

		private string Folder => Path.Combine(_root, "BetterBuildingMenu");

		private static ReleaseMarkerData FirstWrittenBy(string release, bool stampBefore) =>
			new(ReleaseMarker.Version, release, release, stampBefore);

		private static UpgraderDecision? Decide(int version, PriorInstall prior, params string[] keys) =>
			UpgraderTest.Decide(version, prior, keys, UpgraderTest.FirstRedesignRelease);

		[Fact]
		public void TheInterimsSettingsVersionMakesAnUpgrader()
		{
			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsVersion, "1"), Decide(1, PriorInstall.Nothing));
		}

		[Fact]
		public void AMarkerAnEarlierReleaseFirstWroteMakesAnUpgrader()
		{
			var prior = new PriorInstall(FirstWrittenBy("0.2.5", stampBefore: false), StampExisted: false);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.Marker, "0.2.5"), Decide(0, prior));
		}

		[Theory]
		[InlineData("AssetMenuHeight")]
		[InlineData("AssetMenuCatalogWidth")]
		[InlineData("ControlPaneShown")]
		[InlineData("ReplaceVanillaBuildMenu")]
		[InlineData("AutoWidenSearch")]
		[InlineData("AssetMenuTileSize")]
		[InlineData("BuildingLensPanelHeight")]
		[InlineData("BuildingLensTileSize")]
		[InlineData("ShowCoverageOverlay")]
		[InlineData("SelectPrefabOnOpen")]
		[InlineData("HideRandomAssets")]
		[InlineData("AssetMenuViewMode")]
		public void EachKeyAnEarlierReleaseWroteMakesAnUpgrader(string key)
		{
			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsKey, key), Decide(0, PriorInstall.Nothing, key));
		}

		[Fact]
		public void TheStampAloneMakesAnUpgrader()
		{
			Assert.Equal(new UpgraderDecision(UpgraderSignal.Stamp, "stamp"), Decide(0, new PriorInstall(null, StampExisted: true)));
		}

		[Fact]
		public void NoSignMakesANewPlayer()
		{
			var decision = Decide(0, PriorInstall.Nothing);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.None, string.Empty), decision);
			Assert.False(decision!.Value.IsUpgrader);
		}

		[Theory]
		[InlineData("ApplyMimic")]
		[InlineData("DefaultAlignmentStyle")]
		[InlineData("AssetMenuWidthStep")]
		[InlineData("Upgrader")]
		public void AKeyNoEarlierReleaseWroteIsNoSign(string key)
		{
			Assert.Equal(UpgraderSignal.None, Decide(0, PriorInstall.Nothing, key)!.Value.Signal);
		}

		[Theory]
		[InlineData(2)]
		[InlineData(3)]
		[InlineData(7)]
		public void AStoredVersionOfTwoOrMoreDecidesNothing(int version)
		{
			Assert.Null(Decide(version, new PriorInstall(null, StampExisted: true), "AssetMenuHeight"));
		}

		[Fact]
		public void TheRedesignsOwnMarkerWithNoStampBeforeKeepsANewPlayerNewThoughAStampIsThere()
		{
			// A first launch whose settings save never landed: this release wrote the marker, and its cache the stamp.
			var prior = new PriorInstall(FirstWrittenBy(UpgraderTest.FirstRedesignRelease, stampBefore: false), StampExisted: true);

			Assert.Equal(UpgraderSignal.None, Decide(0, prior)!.Value.Signal);
		}

		[Fact]
		public void TheRedesignsOwnMarkerWithAStampBeforeMakesAnUpgrader()
		{
			var prior = new PriorInstall(FirstWrittenBy(UpgraderTest.FirstRedesignRelease, stampBefore: true), StampExisted: true);

			Assert.Equal(new UpgraderDecision(UpgraderSignal.Stamp, "stampBefore"), Decide(0, prior));
		}

		[Fact]
		public void ALaterRedesignReleasesMarkerIsNoSign()
		{
			var prior = new PriorInstall(FirstWrittenBy("0.3.4", stampBefore: false), StampExisted: true);

			Assert.Equal(UpgraderSignal.None, Decide(0, prior)!.Value.Signal);
		}

		[Fact]
		public void TheSignsAnswerInTheRuledOrder()
		{
			var everything = new PriorInstall(FirstWrittenBy("0.2.5", stampBefore: true), StampExisted: true);

			Assert.Equal(UpgraderSignal.SettingsVersion, Decide(1, everything, "AssetMenuHeight")!.Value.Signal);
			Assert.Equal(UpgraderSignal.Marker, Decide(0, everything, "AssetMenuHeight")!.Value.Signal);
			Assert.Equal(UpgraderSignal.SettingsKey, Decide(0, new PriorInstall(null, StampExisted: true), "AssetMenuHeight")!.Value.Signal);
		}

		[Fact]
		public void TheKeysAreTriedInTheirListedOrder()
		{
			// A development build's file from before 0.1.0: two keys no release declared, three 0.1.x ones.
			var decision = Decide(0, PriorInstall.Nothing, "ApplyMimic", "BuildingLensPanelHeight", "ReplaceVanillaBuildMenu", "DefaultAlignmentStyle", "ShowCoverageOverlay");

			Assert.Equal(new UpgraderDecision(UpgraderSignal.SettingsKey, "ReplaceVanillaBuildMenu"), decision);
		}

		[Theory]
		[InlineData("beta")]
		[InlineData("0.2.5-rc1")]
		[InlineData(" ")]
		public void AMarkerWhoseFirstReleaseIsNotANumberAnswersNothing(string first)
		{
			var prior = new PriorInstall(FirstWrittenBy(first, stampBefore: false), StampExisted: false);

			Assert.Equal(UpgraderSignal.None, Decide(0, prior)!.Value.Signal);
			Assert.Equal(UpgraderSignal.SettingsKey, Decide(0, prior, "ControlPaneShown")!.Value.Signal);
		}

		[Fact]
		public void TheListNamesTwelveDistinctKeys()
		{
			Assert.Equal(12, UpgraderTest.EarlierReleaseKeys.Count);
			Assert.Equal(12, UpgraderTest.EarlierReleaseKeys.Distinct(StringComparer.Ordinal).Count());
		}

		[Fact]
		public void ThisBuildIsTheRedesignsFirstReleaseOrLater()
		{
			// Its own marker must read as the redesign's, or a fresh install would read as an upgrader.
			var release = ReleaseMarker.ReleaseOf(typeof(Mod).Assembly.GetName().Version);

			Assert.False(ReleaseMarker.IsBefore(release, UpgraderTest.FirstRedesignRelease), release);
		}

		[Fact]
		public void FromKeepsOnlyAMarkerThisReleaseReads()
		{
			var marker = FirstWrittenBy("0.2.5", stampBefore: true);

			Assert.Equal(new PriorInstall(marker, true), PriorInstall.From(new ReleaseMarkerRead(ReleaseMarkerState.Read, marker), stampExisted: true));
			Assert.Equal(new PriorInstall(null, true), PriorInstall.From(new ReleaseMarkerRead(ReleaseMarkerState.Newer, null), stampExisted: true));
			Assert.Equal(PriorInstall.Nothing, PriorInstall.From(new ReleaseMarkerRead(ReleaseMarkerState.Corrupt, null), stampExisted: false));
		}

		[Fact]
		public void AReadingBeforeTheCacheSeesNoStampAndTheCacheThenWritesOne()
		{
			Assert.Equal(PriorInstall.Nothing, ReleaseMarkerFile.ReadPrior(Folder));

			// What Mod.OnLoad does later: the cache writes its stamp as it is built.
			_ = new SilhouetteIconCache(Array.Empty<string>(), Path.Combine(Folder, SilhouetteIconCache.FolderName));

			Assert.Equal(new PriorInstall(null, StampExisted: true), ReleaseMarkerFile.ReadPrior(Folder));
		}

		[Fact]
		public void ReadPriorKeepsTheMarkerAnEarlierLoadWrote()
		{
			ReleaseMarkerFile.Update(Folder, "0.2.5", _ => { });

			Assert.Equal(new PriorInstall(FirstWrittenBy("0.2.5", stampBefore: false), StampExisted: false), ReleaseMarkerFile.ReadPrior(Folder));
		}

		[Theory]
		[InlineData("{ broken")]
		[InlineData("{\"version\":2,\"first\":\"0.3.0\"}")]
		public void ReadPriorReadsACorruptOrNewerMarkerAsNone(string json)
		{
			Directory.CreateDirectory(Folder);
			File.WriteAllText(Path.Combine(Folder, ReleaseMarker.FileName), json);

			Assert.Equal(PriorInstall.Nothing, ReleaseMarkerFile.ReadPrior(Folder));
		}

		[Fact]
		public void ReadPriorOverAFolderThatIsAnOrdinaryFileReadsNothingAndThrowsNothing()
		{
			File.WriteAllText(Folder, "not a folder");

			Assert.Equal(PriorInstall.Nothing, ReleaseMarkerFile.ReadPrior(Folder));
		}
	}
}
