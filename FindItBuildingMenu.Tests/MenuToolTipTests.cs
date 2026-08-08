using System.Text.RegularExpressions;

using FindItBuildingMenu.Domain;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The identifiers here must match UI/src/domain/menuAxisMap.ts's AUTHORED
	/// table exactly, once each is normalized (lowercased, non-alphanumeric
	/// stripped) the same way that module normalizes its own keys. A mismatch
	/// is silent: the tab strip just falls back to its computed axis instead
	/// of erroring, so this is the only place either side would fail a build
	/// over a drift between the two.
	/// </summary>
	public sealed class MenuToolTipTests
	{
		[Theory]
		[InlineData("Media/Game/Icons/Zones.svg", "zones")]
		[InlineData("Media/Game/Icons/Electricity.svg", "electricity")]
		[InlineData("Media/Game/Icons/Water.svg", "water")]
		[InlineData("Media/Game/Icons/Healthcare.svg", "healthcare")]
		[InlineData("Media/Game/Icons/Garbage.svg", "garbage")]
		[InlineData("Media/Game/Icons/Education.svg", "education")]
		[InlineData("Media/Game/Icons/FireSafety.svg", "firesafety")]
		[InlineData("Media/Game/Icons/Police.svg", "police")]
		[InlineData("Media/Game/Icons/Transportation.svg", "transportation")]
		[InlineData("Media/Game/Icons/ParksAndRecreation.svg", "parksandrecreation")]
		[InlineData("Media/Game/Icons/Communications.svg", "communications")]
		public void NormalizesToTheIdentifierMenuAxisMapExpects(string iconPath, string expectedNormalized)
		{
			string? toolTip = MenuToolTip.FromIconPath(iconPath);

			Assert.NotNull(toolTip);
			Assert.Equal(expectedNormalized, Normalize(toolTip!));
		}

		[Fact]
		public void IsIndifferentToTheSchemeThePathArrivesWith()
		{
			// ImageSystem.GetIcon resolves the URI before this ever sees it, but
			// the basename should not care whether that leaves a bare game path
			// or a coui:// one.
			Assert.Equal("Water", MenuToolTip.FromIconPath("coui://uisystem/Media/Game/Icons/Water.svg"));
		}

		[Fact]
		public void ReturnsNullForNoIcon()
		{
			Assert.Null(MenuToolTip.FromIconPath(null));
			Assert.Null(MenuToolTip.FromIconPath(string.Empty));
		}

		// Mirrors menuAxisMap.ts's `normalise`.
		private static string Normalize(string value) =>
			Regex.Replace(value.ToLowerInvariant(), "[^a-z0-9]", string.Empty);
	}
}
