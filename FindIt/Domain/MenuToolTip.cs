using System.IO;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Turns a toolbar menu's game icon path into the identifier the tab
	/// strip's authored axis lookup keys on.
	/// </summary>
	/// <remarks>
	/// See UI/src/domain/menuAxisMap.ts. The menu's prefab name is a display
	/// string ("Health &amp; Deathcare", "Water &amp; Sewage" — see
	/// <see cref="VanillaMenuPresets"/>) and its localized tooltip is
	/// language-dependent, so neither is stable enough to key a lookup table
	/// on. Its icon is a real game asset path such as
	/// Media/Game/Icons/Water.svg, and the file's basename is exactly the set
	/// of identifiers confirmed against the running game's toolbar icons:
	/// Zones, Electricity, Water, Healthcare, Garbage, Education, FireSafety,
	/// Police, Transportation, ParksAndRecreation, Communications.
	/// </remarks>
	public static class MenuToolTip
	{
		public static string? FromIconPath(string? icon)
		{
			if (string.IsNullOrEmpty(icon))
			{
				return null;
			}

			try
			{
				return Path.GetFileNameWithoutExtension(icon);
			}
			catch (System.ArgumentException)
			{
				// Path.GetFileNameWithoutExtension throws on a small set of
				// characters, and this value comes from prefab data a mod could
				// supply. An unrecognised menu is meant to degrade quietly to
				// the tab strip's computed fallback (see menuAxisMap.ts), not
				// throw — an empty result reaches that fallback the same way a
				// missing icon already does.
				return string.Empty;
			}
		}
	}
}
