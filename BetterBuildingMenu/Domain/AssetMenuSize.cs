namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// When a size the player dragged the asset menu to is the size the settings already hold.
	/// </summary>
	/// <remarks>
	/// Shared by the height and the width: a size this near the stored one leaves the settings
	/// file alone.
	/// </remarks>
	public static class AssetMenuSize
	{
		/// <summary>How far apart two sizes may be and still count as the same.</summary>
		public const float Tolerance = 0.1f;

		public static bool Same(float stored, float size) => Math.Abs(stored - size) < Tolerance;
	}
}
