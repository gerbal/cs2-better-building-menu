using System;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// Rewrites Unified Icon Library URLs to this mod's vendored copies, so
	/// prefab thumbnails resolve without that mod installed.
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
