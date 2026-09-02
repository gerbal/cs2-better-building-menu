using System;
using System.IO;
using BetterBuildingMenu.Utilities;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The disk half of the silhouette swap: find the icon, blacken it once.
	/// </summary>
	public sealed class SilhouetteIconCacheTests : IDisposable
	{
		private readonly string _root = Path.Combine(Path.GetTempPath(), "bbm-silhouette-" + Guid.NewGuid().ToString("N"));
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

			Assert.Equal("coui://betterbuildingmenusilhouettes/Media_Game_Icons_Track.svg", url);
			var written = File.ReadAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg"));
			Assert.Equal("<svg><path fill=\"#191919\"/></svg>", written);
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

		private void SeedCache(string body, string? stamp)
		{
			Directory.CreateDirectory(_cache);
			File.WriteAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg"), body);

			if (stamp is not null)
			{
				File.WriteAllText(Path.Combine(_cache, ".stamp"), stamp);
			}
		}

		[Fact]
		public void ReusesAFileLeftByAnEarlierSessionWithTheSameTransform()
		{
			SeedCache("<svg>already dark</svg>", SilhouetteIcons.CacheStamp);
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"#e9bc29\"/></svg>");

			var subject = Subject();
			Assert.NotNull(subject.UrlFor("Media/Game/Icons/Track.svg"));
			Assert.Equal(0, subject.Generated);
			Assert.Equal("<svg>already dark</svg>", File.ReadAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg")));
		}

		[Fact]
		public void ThrowsAwayACacheWrittenByADifferentTint()
		{
			// Retuning the colour has to reach installs that already generated.
			// The files persist on purpose, so without the stamp nothing would
			// ever regenerate and the old tint would be permanent.
			SeedCache("<svg>the old colour</svg>", "tint=#000000");
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"#e9bc29\"/></svg>");

			var subject = Subject();

			Assert.NotNull(subject.UrlFor("Media/Game/Icons/Track.svg"));
			Assert.Equal(1, subject.Generated);
			Assert.Equal(
				"<svg><path fill=\"" + SilhouetteIcons.SilhouetteColor + "\"/></svg>",
				File.ReadAllText(Path.Combine(_cache, "Media_Game_Icons_Track.svg")));
		}

		[Fact]
		public void ThrowsAwayACacheThatWasNeverStamped()
		{
			SeedCache("<svg>from before the stamp existed</svg>", null);
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"gray\"/></svg>");

			var subject = Subject();

			Assert.NotNull(subject.UrlFor("Media/Game/Icons/Track.svg"));
			Assert.Equal(1, subject.Generated);
		}

		[Fact]
		public void StampsTheCacheItWrites()
		{
			WriteIcon(_contentA, "Track.svg", "<svg><path fill=\"gray\"/></svg>");
			Subject().UrlFor("Media/Game/Icons/Track.svg");

			Assert.Equal(SilhouetteIcons.CacheStamp, File.ReadAllText(Path.Combine(_cache, ".stamp")).Trim());
		}

		[Fact]
		public void MatchesTheColourVanillasOwnFilterLandsOn()
		{
			// Measured by sampling a filtered raster tile on screen: Cohtml's
			// brightness(0%) bottoms out at rgb(25,25,25), not black.
			Assert.Equal("#191919", SilhouetteIcons.SilhouetteColor);
		}
	}
}
