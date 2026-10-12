namespace BetterBuildingMenu.Domain
{
	/// <summary>The build menu's five widths, one per Width step, on a screen of any aspect.</summary>
	/// <remarks>
	/// A step is stored as its number, never its width, because the widths follow the screen. The
	/// UI computes the same widths from the copy generated into sharedContracts.generated.ts and
	/// decides where the box sits. See docs/design-notes.md, "The Width steps".
	/// </remarks>
	public static class WidthSteps
	{
		/// <summary>The layout's height in rem at every aspect: a screen is this times its aspect wide.</summary>
		public const double LayoutHeight = 1080;

		/// <summary>The aspect read when the screen's cannot be: the layout's reference resolution's.</summary>
		public const double ReferenceAspect = 16.0 / 9.0;

		/// <summary>The first step, the game's own build menu's width, on every screen.</summary>
		public const int Vanilla = 706;

		public const int Count = 5;

		/// <summary>The step a new player gets, and the one anything that is not a step reads as.</summary>
		public const int DefaultStep = 1;

		/// <summary>
		/// Each step's share of the room beyond <see cref="Vanilla"/>, over <see cref="ShareDenominator"/>:
		/// the 16:9 steps' exact shares, so that 16:9 gives 706, 893, 1091, 1280 and 1475.
		/// </summary>
		public static readonly IReadOnlyList<int> Shares = new[] { 0, 187, 385, 574, 769 };

		public const int ShareDenominator = 769;

		/// <summary>The room's left edge: the tool options' right edge at the game's own text size.</summary>
		public const double RoomLeft = 396;

		/// <summary>How far short of the screen's right edge the room ends: 1 rem short of the social column.</summary>
		public const double RoomRightOffset = 49;

		/// <summary>How far short of the screen's right edge the social column starts. The control pane may run up to it.</summary>
		public const double SocialColumnOffset = 48;

		/// <summary>The five widths on a screen of this aspect, narrowest first, in whole rem.</summary>
		/// <remarks>The UI's copy computes in the same order, so both round the same doubles.</remarks>
		public static int[] For(double aspect)
		{
			var room = Math.Max(Vanilla, LayoutHeight * Usable(aspect) - RoomRightOffset - RoomLeft);

			return Shares
				.Select(share => (int)Math.Round(Vanilla + (room - Vanilla) * share / ShareDenominator, MidpointRounding.AwayFromZero))
				.ToArray();
		}

		/// <summary>The step whose width on this screen is nearest a width; a tie goes to the narrower step.</summary>
		public static int Nearest(double width, double aspect)
		{
			if (double.IsNaN(width) || double.IsInfinity(width))
			{
				return DefaultStep;
			}

			var widths = For(aspect);
			var nearest = 0;

			for (var i = 1; i < widths.Length; i++)
			{
				if (Math.Abs(widths[i] - width) < Math.Abs(widths[nearest] - width))
				{
					nearest = i;
				}
			}

			return nearest + 1;
		}

		/// <summary>A step number, or <see cref="DefaultStep"/> for anything that is not one.</summary>
		public static int Sanitize(int step) => step >= 1 && step <= Count ? step : DefaultStep;

		private static double Usable(double aspect) =>
			double.IsNaN(aspect) || double.IsInfinity(aspect) || aspect <= 0 ? ReferenceAspect : aspect;
	}
}
