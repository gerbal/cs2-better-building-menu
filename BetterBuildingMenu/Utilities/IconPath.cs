using System;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// Keeps icon URLs usable when the standalone successor is deployed without
	/// the optional Unified Icon Library mod. The game returns Uil URLs for some
	/// prefab thumbnails; those assets are vendored under this mod's host.
	/// </summary>
	public static class IconPath
	{
		private const string UnifiedIconLibraryPrefix = "coui://uil/";
		private const string VendoredIconPrefix = "coui://betterbuildingmenu/Icons/";

		public static string Normalize(string path)
		{
			if (string.IsNullOrEmpty(path)
				|| !path.StartsWith(UnifiedIconLibraryPrefix, StringComparison.OrdinalIgnoreCase))
			{
				return path;
			}

			return VendoredIconPrefix + path.Substring(UnifiedIconLibraryPrefix.Length);
		}
	}
}
