using System;
using System.IO;
using FindItBuildingMenu.Utilities;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The disk half of the silhouette swap: find the icon, blacken it once.
	/// </summary>
	public sealed class SilhouetteIconCacheTests : IDisposable
	{
		private readonly string _root = Path.Combine(Path.GetTempPath(), "findit-silhouette-" + Guid.NewGuid().ToString("N"));
		private readonly string _contentA;
		private readonly string _contentB;
		private readonly string _cache;

		public SilhouetteIconCacheTests()
		{
			_contentA = Path.Combine(_root, "Game", "UI");
			_contentB = Path.Combine(_root, "BridgesAndPorts", "UI");
			_cache = Path.Combine(_root, "cache");
			Directory.CreateDirectory(Path.Combine(_contentA, "Media", "Game", "Icons"));
			Directory.CreateDirectory(Path.Combine(_contentB, "Media", "Game", "Icons"));
		}

		public void Dispose()
		{
			try { Directory.Delete(_root, recursive: true); } catch { /* temp */ }
		}

		private SilhouetteIconCache Subject() => new SilhouetteIconCache(new[] { _contentA, _contentB }, _cache);

		private void WriteIcon(string root, string name, string body) =>
			File.WriteAllText(Path.Combine(root, "Media", "Game", "Icons", name), body);

		[Fact]
		public void BlackensAnIconAndServesItFromTheHost()
		{
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"#e9bc29\"/></svg>");

			var url = Subject().UrlFor("Media/Game/Icons/Track.svg");

			Assert.Equal("coui://finditsilhouettes/Media_Game_Icons_Track.svg", url);
			var written = File.ReadAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg"));
			Assert.Equal("<svg><path fill=\"#000000\"/></svg>", written);
		}

		[Fact]
		public void SearchesEveryContentRoot()
		{
			// DLC and packs each ship their own UI root; an icon can be in any.
			WriteIcon(_contentB, "Pier.svg", "<svg><path fill=\"gray\"/></svg>");

			Assert.NotNull(Subject().UrlFor("Media/Game/Icons/Pier.svg"));
		}

		[Fact]
		public void ReturnsNullWhenTheIconIsNowhere()
		{
			// The caller falls back to the normal thumbnail; locked is still
			// legible from the dimmed ground and the padlock.
			Assert.Null(Subject().UrlFor("Media/Game/Icons/Missing.svg"));
		}

		[Fact]
		public void IgnoresRasterThumbnails()
		{
			Assert.Null(Subject().UrlFor("something/thumbnail.png"));
			Assert.Null(Subject().UrlFor("StationElevated02?width=128&height=128"));
		}

		[Fact]
		public void BlackensEachIconOnlyOnce()
		{
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"#e9bc29\"/></svg>");
			var subject = Subject();

			subject.UrlFor("Media/Game/Icons/Track.svg");
			subject.UrlFor("Media/Game/Icons/Track.svg");
			subject.UrlFor("Media/Game/Icons/Track.svg?width=128");

			Assert.Equal(1, subject.Generated);
		}

		[Fact]
		public void RemembersAMissSoTheRootsAreNotRewalked()
		{
			var subject = Subject();

			Assert.Null(subject.UrlFor("Media/Game/Icons/Missing.svg"));
			// Appearing later must not resurrect it mid-session; the point is
			// that the projection stops paying for the lookup on every refresh.
			WriteIcon(_contentA, "Missing.svg", "<svg><path fill=\"gray\"/></svg>");
			Assert.Null(subject.UrlFor("Media/Game/Icons/Missing.svg"));
			Assert.Equal(0, subject.Generated);
		}

		[Fact]
		public void ReusesAFileLeftByAnEarlierSession()
		{
			Directory.CreateDirectory(_cache);
			File.WriteAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg"), "<svg>already black</svg>");
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"#e9bc29\"/></svg>");

			var subject = Subject();
			Assert.NotNull(subject.UrlFor("Media/Game/Icons/Track.svg"));
			Assert.Equal(0, subject.Generated);
			Assert.Equal("<svg>already black</svg>", File.ReadAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg")));
		}
	}
}
