namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Where a water building draws from, worded the way the game's own tooltip
	/// does (PrefabUISystem.RequiredResourceBinder): ground water when that flag
	/// is set, surface water otherwise, and nothing when the component allows no
	/// type — a water tower is a pumping station that draws from nowhere.
	/// </summary>
	public static class WaterSource
	{
		public static string? Describe(bool groundwater, bool surfaceWater)
		{
			if (groundwater) return "GroundWater";
			if (surfaceWater) return "SurfaceWater";
			return null;
		}
	}
}
