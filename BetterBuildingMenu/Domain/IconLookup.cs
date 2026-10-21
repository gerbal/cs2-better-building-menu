using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>An icon the game looks up, or nothing when the lookup throws.</summary>
	/// <remarks>The game's thumbnail lookup throws when a prefab's icon names an asset-database file
	/// that is missing (<c>AssetDatabase.GetAsset</c>, which throws). One such asset must cost only its
	/// own icon: not its row, and for a zone, not the whole index.</remarks>
	public static class IconLookup
	{
		public static string? OrNull(Func<string?> lookup, Action<Exception> failed)
		{
			try
			{
				return lookup();
			}
			catch (Exception ex)
			{
				failed(ex);

				return null;
			}
		}
	}
}
