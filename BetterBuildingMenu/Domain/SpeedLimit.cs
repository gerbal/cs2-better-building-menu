namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The unit of a network's speed limit, as the game keeps it.
	/// </summary>
	/// <remarks>
	/// A RoadPrefab is authored in km/h (m_SpeedLimit = 100f by default), but
	/// the component the index reads — RoadData, TrackData, PathwayData,
	/// WaterwayData, TaxiwayData — holds metres per second: NetInitializeSystem
	/// divides by 3.6 on the way in (Prefabs/NetInitializeSystem.cs:1944), and
	/// the sign posts multiply by 3.6 on the way out (Objects/
	/// SecondaryObjectSystem.cs:2768). The catalog states km/h, so it converts
	/// back the way the signs do. Read raw, the Two-Lane Road said "22 km/h"
	/// for a road signed 80.
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
