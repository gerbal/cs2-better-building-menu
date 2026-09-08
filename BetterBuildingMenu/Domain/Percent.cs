namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A fraction as the whole percentage the game's tooltip shows: purification is
	/// Mathf.RoundToInt(100f * m_Purification), comfort (int)math.round(100f *
	/// m_ComfortFactor) (PrefabUISystem.cs:1604, :1643). The index used to pass the
	/// raw fraction, so a 60 % plant read "1 %" once rounded.
	/// </summary>
	public static class Percent
	{
		public static int FromFraction(float fraction)
		{
			return (int)System.Math.Round(100f * fraction);
		}
	}
}
