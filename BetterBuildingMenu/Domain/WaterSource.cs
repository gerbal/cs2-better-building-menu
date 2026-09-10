namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Where a water building draws from, worded as the game's own tooltip does
	/// (PrefabUISystem.RequiredResourceBinder): ground water when that flag is set,
	/// surface water otherwise, and nothing when the component allows no type.
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
