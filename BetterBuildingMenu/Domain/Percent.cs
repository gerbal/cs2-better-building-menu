namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A fraction as the whole percentage the game's tooltip shows: the game rounds
	/// 100f times the fraction, so the index hands over the same whole number.
	/// </summary>
	public static class Percent
	{
		public static int FromFraction(float fraction)
		{
			return (int)System.Math.Round(100f * fraction);
		}
	}
}
