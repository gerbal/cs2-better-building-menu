using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The build menu's five Width steps on screens of every aspect, and the step nearest a
	/// width, which the settings migration turns an earlier release's width into.
	/// </summary>
	public sealed class WidthStepsTests
	{
		private const double SixteenNine = 1920.0 / 1080.0;
		private const double TwentyOneNine = 2520.0 / 1080.0;
		private const double ThirtyTwoNine = 3840.0 / 1080.0;

		[Fact]
		public void SixteenNineGivesTheRuledWidths()
		{
			Assert.Equal(new[] { 706, 893, 1091, 1280, 1475 }, WidthSteps.For(SixteenNine));
		}

		[Fact]
		public void TwentyOneNineScalesTheRoomByTheExactShares()
		{
			// The ruling's rounded shares (0.243, 0.501, 0.746) would give 1392 and 1727 here.
			Assert.Equal(new[] { 706, 1039, 1391, 1728, 2075 }, WidthSteps.For(TwentyOneNine));
		}

		[Fact]
		public void ThirtyTwoNineScalesTheRoomByTheExactShares()
		{
			Assert.Equal(new[] { 706, 1360, 2052, 2713, 3395 }, WidthSteps.For(ThirtyTwoNine));
		}

		[Theory]
		[InlineData(SixteenNine)]
		[InlineData(TwentyOneNine)]
		[InlineData(ThirtyTwoNine)]
		[InlineData(1.6)]
		public void EveryScreenStartsAtTheGamesSizeAndEndsAtTheRoom(double aspect)
		{
			var widths = WidthSteps.For(aspect);
			var room = WidthSteps.LayoutHeight * aspect - WidthSteps.RoomRightOffset - WidthSteps.RoomLeft;

			Assert.Equal(WidthSteps.Vanilla, widths[0]);
			Assert.Equal((int)Math.Round(room, MidpointRounding.AwayFromZero), widths[WidthSteps.Count - 1]);
			Assert.Equal(widths.OrderBy(width => width), widths);
		}

		[Fact]
		public void TheRoomRunsFromTheToolOptionsToOneRemShortOfTheSocialColumn()
		{
			Assert.Equal(396, WidthSteps.RoomLeft);
			Assert.Equal(1871, WidthSteps.LayoutHeight * SixteenNine - WidthSteps.RoomRightOffset, 6);
			Assert.Equal(1872, WidthSteps.LayoutHeight * SixteenNine - WidthSteps.SocialColumnOffset, 6);
		}

		[Fact]
		public void ANarrowerScreenKeepsTheStepsInOrderFromTheGamesSize()
		{
			// 16:10 is 1,728 rem wide and 4:3 1,440: the same shares of a smaller room.
			Assert.Equal(new[] { 706, 846, 995, 1137, 1283 }, WidthSteps.For(1728.0 / 1080.0));
			Assert.Equal(new[] { 706, 776, 851, 922, 995 }, WidthSteps.For(1440.0 / 1080.0));
		}

		[Fact]
		public void AScreenWithNoRoomBeyondTheGamesSizeDrawsItAtEveryStep()
		{
			Assert.Equal(new[] { 706, 706, 706, 706, 706 }, WidthSteps.For(1.0));
		}

		[Theory]
		[InlineData(0.0)]
		[InlineData(-1.0)]
		[InlineData(double.NaN)]
		[InlineData(double.PositiveInfinity)]
		public void AnAspectThatCannotBeReadIsTheReferenceScreens(double aspect)
		{
			Assert.Equal(WidthSteps.For(WidthSteps.ReferenceAspect), WidthSteps.For(aspect));
		}

		[Theory]
		[InlineData(1091.0, SixteenNine, 3)]
		[InlineData(1091.0, TwentyOneNine, 2)]
		[InlineData(1091.0, ThirtyTwoNine, 2)]
		[InlineData(735.0, SixteenNine, 1)]
		[InlineData(735.0, TwentyOneNine, 1)]
		[InlineData(735.0, ThirtyTwoNine, 1)]
		[InlineData(1200.0, SixteenNine, 4)]
		[InlineData(1200.0, TwentyOneNine, 2)]
		[InlineData(1476.0, SixteenNine, 5)]
		public void AWidthBecomesTheNearestStepOnThisScreen(double width, double aspect, int step)
		{
			Assert.Equal(step, WidthSteps.Nearest(width, aspect));
		}

		[Fact]
		public void ATieGoesToTheNarrowerStep()
		{
			// 799.5 is 93.5 from 706 and from 893.
			Assert.Equal(1, WidthSteps.Nearest(799.5, SixteenNine));
			Assert.Equal(2, WidthSteps.Nearest(800, SixteenNine));
		}

		[Theory]
		[InlineData(double.NaN)]
		[InlineData(double.NegativeInfinity)]
		public void AWidthThatIsNotANumberIsTheFirstStep(double width)
		{
			Assert.Equal(WidthSteps.DefaultStep, WidthSteps.Nearest(width, SixteenNine));
		}

		[Theory]
		[InlineData(1, 1)]
		[InlineData(3, 3)]
		[InlineData(5, 5)]
		[InlineData(0, 1)]
		[InlineData(6, 1)]
		[InlineData(-1, 1)]
		[InlineData(9, 1)]
		public void AnythingThatIsNotAStepIsTheFirst(int step, int expected)
		{
			Assert.Equal(expected, WidthSteps.Sanitize(step));
		}

		[Fact]
		public void EveryStepHasAShareAndTheLastIsTheWholeRoom()
		{
			Assert.Equal(WidthSteps.Count, WidthSteps.Shares.Count);
			Assert.Equal(0, WidthSteps.Shares[0]);
			Assert.Equal(WidthSteps.ShareDenominator, WidthSteps.Shares[WidthSteps.Count - 1]);
			Assert.Equal(1, WidthSteps.DefaultStep);
		}
	}
}
