using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Finds a mod in the game's enabled list, which names each one by its assembly's full name.</summary>
	public static class EnabledMods
	{
		/// <remarks>Matched ordinally on the simple name, the part before the first comma, so
		/// "RoadBuilder" does not match "RoadBuilderExtras" and the OS culture has no say.</remarks>
		public static bool Contains(IEnumerable<string?>? enabled, string assemblyName) =>
			enabled?.Any(fullName => fullName is not null
				&& fullName.StartsWith(assemblyName, StringComparison.Ordinal)
				&& (fullName.Length == assemblyName.Length || fullName[assemblyName.Length] == ','))
			?? false;
	}
}
