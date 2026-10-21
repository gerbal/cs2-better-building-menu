using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	public static class StringListExtensions
	{
		/// <summary>Whether the list holds the value, ignoring case. A missing list holds nothing.</summary>
		/// <remarks>A plain loop, so the per-entry catalog filters pay for no closure or enumerator.</remarks>
		public static bool ContainsIgnoreCase(this IReadOnlyList<string>? list, string? value)
		{
			if (list is null)
			{
				return false;
			}

			for (var i = 0; i < list.Count; i++)
			{
				if (string.Equals(list[i], value, StringComparison.OrdinalIgnoreCase))
				{
					return true;
				}
			}

			return false;
		}
	}
}
