using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Tells apart indexed prefabs that share a display name: "Foo 1", "Foo 2".</summary>
	/// <remarks>
	/// Always computed from each prefab's own asset name, never from a name it numbered earlier.
	/// A partial pass re-reads one prefab, and numbering only what that pass touched would leave
	/// it a plain "Foo" beside a sibling still called "Foo 2".
	/// </remarks>
	public static class DuplicateNameNumbering
	{
		/// <summary>The display name of each item, in the order given.</summary>
		/// <param name="items">Each prefab's asset name and prefab name. The prefab name
		/// sets the numbers' order; items that share a prefab name too keep the order they are
		/// given in, so a caller that wants the same numbers every time sorts them first.</param>
		public static string[] Names(IReadOnlyList<(string AssetName, string PrefabName)> items)
		{
			var names = new string[items.Count];

			foreach (var group in Enumerable.Range(0, items.Count).GroupBy(i => items[i].AssetName, StringComparer.Ordinal))
			{
				var members = group.OrderBy(i => items[i].PrefabName, StringComparer.Ordinal).ToList();

				if (members.Count == 1)
				{
					names[members[0]] = items[members[0]].AssetName;
					continue;
				}

				var format = new string('0', members.Count.ToString(CultureInfo.InvariantCulture).Length);

				for (var n = 0; n < members.Count; n++)
				{
					names[members[n]] = $"{items[members[n]].AssetName} {(n + 1).ToString(format, CultureInfo.InvariantCulture)}";
				}
			}

			return names;
		}
	}
}
