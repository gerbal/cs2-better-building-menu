using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Which of a category's two icon paths the UI can actually draw.</summary>
	public static class CategoryIcon
	{
		/// <remarks>A content hash draws nothing: the tool button swaps it for a placeholder glyph. An
		/// asset-database PATH, which is what a mod's own icon file resolves to, draws fine.</remarks>
		public static bool IsResolvable(string? icon) =>
			!string.IsNullOrWhiteSpace(icon)
			&& !icon!.TrimStart().StartsWith("assetdb://global/", StringComparison.OrdinalIgnoreCase);

		/// <summary>The prefab's own icon, or the image system's when that one cannot be drawn.</summary>
		public static string Resolve(string? prefabIcon, string? imageSystemIcon) =>
			IsResolvable(prefabIcon) ? prefabIcon!.Trim()
			: IsResolvable(imageSystemIcon) ? imageSystemIcon!.Trim()
			: prefabIcon ?? imageSystemIcon ?? string.Empty;
	}
}
