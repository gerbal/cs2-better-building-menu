using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	public static class DictionaryExtensions
	{
		/// <summary>The value under the key, stored from <paramref name="create"/> first when there is none.</summary>
		/// <remarks>Pass a static lambda: it is built once, so a hit costs nothing and a miss costs the value.</remarks>
		public static TValue GetOrAdd<TKey, TValue>(this Dictionary<TKey, TValue> map, TKey key, Func<TValue> create)
		{
			if (!map.TryGetValue(key, out var value))
			{
				value = create();
				map[key] = value;
			}

			return value;
		}
	}
}
