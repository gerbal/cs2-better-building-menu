using FindItBuildingMenu.Utilities;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// cm-2xvs.24: the blackening that replaces vanilla's silhouette filter.
	/// </summary>
	/// <remarks>
	/// Fixtures are taken from the real icons — CS2's network glyphs carry
	/// several named and hex fills plus a clipPath, and the subway group that
	/// exposed the bug used exactly these shapes.
	/// </remarks>
	public sealed class SilhouetteIconTests
	{
		[Fact]
		public void RepaintsEveryVisibleFillAndStroke()
		{
			var svg = "<svg><path fill=\"#e9bc29\" d=\"M0 0\"/><path fill=\"gray\" stroke=\"#575656\" d=\"M1 1\"/></svg>";

			var black = SilhouetteIcons.Blacken(svg);

			Assert.Equal(
				"<svg><path fill=\"#191919\" d=\"M0 0\"/><path fill=\"#191919\" stroke=\"#191919\" d=\"M1 1\"/></svg>",
				black);
		}

		[Fact]
		public void LeavesFillNoneAlone()
		{
			// Structural, not decorative: fill="none" is how a shape says it is
			// an outline. Painting it black floods the icon into a solid block,
			// which is the difference between a silhouette and a blob.
			var svg = "<svg><path fill=\"none\" stroke=\"#abc\" d=\"M0 0\"/></svg>";

			Assert.Equal(
				"<svg><path fill=\"none\" stroke=\"#191919\" d=\"M0 0\"/></svg>",
				SilhouetteIcons.Blacken(svg));
		}

		[Fact]
		public void RepaintsPaintDeclaredInAStyleAttribute()
		{
			var svg = "<svg><path style=\"fill:#e9bc29;stroke:gray\" d=\"M0 0\"/></svg>";

			Assert.Equal(
				"<svg><path style=\"fill:#191919;stroke:#191919\" d=\"M0 0\"/></svg>",
				SilhouetteIcons.Blacken(svg));
		}

		[Fact]
		public void LeavesEverythingElseUntouched()
		{
			// Geometry, transforms and clip paths carry the shape; only paint
			// changes. A clipPath rect with no fill must survive as-is.
			var svg = "<svg viewBox=\"0 0 64 64\"><defs><clipPath id=\"b\"><rect width=\"64\" height=\"64\"/></clipPath></defs>"
				+ "<g transform=\"translate(-1.064 17.354)\"><path d=\"M733.484-305.8l3.379,2.65\" fill=\"#61544c\"/></g></svg>";

			var black = SilhouetteIcons.Blacken(svg);

			Assert.Contains("viewBox=\"0 0 64 64\"", black);
			Assert.Contains("transform=\"translate(-1.064 17.354)\"", black);
			Assert.Contains("d=\"M733.484-305.8l3.379,2.65\"", black);
			Assert.Contains("<rect width=\"64\" height=\"64\"/>", black);
			Assert.DoesNotContain("#61544c", black);
		}

		[Theory]
		[InlineData("Media/Game/Icons/DoubleTrainTrack.svg", true)]
		[InlineData("Media/Game/Icons/Lock.svg?width=128", true)]
		[InlineData("Media/Game/Icons/Lock.svg#icon", true)]
		[InlineData("8ef69617cc5d8c286aa1500971601d.png", false)]
		[InlineData("StationElevated02?width=128&height=128", false)]
		[InlineData("", false)]
		[InlineData(null, false)]
		public void RecognisesVectorThumbnails(string thumbnail, bool expected)
		{
			Assert.Equal(expected, SilhouetteIcons.IsVector(thumbnail));
		}

		[Fact]
		public void FlattensThePathWithoutLosingWhatDistinguishesIt()
		{
			// Two icons can share a leaf name under different roots — Placeholder
			// is real and appears in the subway group — so the whole relative
			// path has to survive into the cached name.
			Assert.Equal(
				"Media_Game_Icons_DoubleTrainTrack.svg",
				SilhouetteIcons.CacheFileName("Media/Game/Icons/DoubleTrainTrack.svg"));

			Assert.NotEqual(
				SilhouetteIcons.CacheFileName("Media/Game/Icons/Placeholder.svg"),
				SilhouetteIcons.CacheFileName("Media/Other/Icons/Placeholder.svg"));
		}

		[Fact]
		public void DropsQueryAndFragmentFromTheCachedName()
		{
			Assert.Equal(
				"Media_Game_Icons_Lock.svg",
				SilhouetteIcons.CacheFileName("Media/Game/Icons/Lock.svg?width=128"));
		}

		[Fact]
		public void ServesFromItsOwnHost()
		{
			Assert.Equal(
				"coui://finditsilhouettes/Media_Game_Icons_DoubleTrainTrack.svg",
				SilhouetteIcons.UrlFor("Media/Game/Icons/DoubleTrainTrack.svg"));
		}
	}
}
