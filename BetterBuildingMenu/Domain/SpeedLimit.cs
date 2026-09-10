namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The unit of a network's speed limit, as the game keeps it.
	/// </summary>
	/// <remarks>
	/// A RoadPrefab is authored in km/h, but the component the index reads holds
	/// metres per second — NetInitializeSystem divides on the way in and the sign
	/// posts multiply on the way out. The catalog states km/h, so it converts too.
	/// </remarks>
	public static class SpeedLimit
	{
		private const float SecondsPerHourOverMetresPerKilometre = 3.6f;

		public static float KilometresPerHour(float metresPerSecond)
		{
			return metresPerSecond * SecondsPerHourOverMetresPerKilometre;
		}
	}
}
