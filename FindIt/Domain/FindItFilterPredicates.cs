using Game.Prefabs;

using System;
using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Filter predicates the root FindIt asset grid shares with Building Lens.
	/// </summary>
	/// <remarks>
	/// Placement flags, extensions and role were filterable in the lens but not
	/// in the asset grid, even though <c>PrefabIndex</c> has carried all three
	/// all along. These are pure functions over the indexed values rather than
	/// methods on <see cref="Filters"/> so they can be tested: PrefabIndex needs
	/// a live PrefabBase and cannot be constructed in a unit test.
	/// </remarks>
	public static class FindItFilterPredicates
	{
		/// <summary>
		/// True when the prefab carries every required placement flag.
		/// </summary>
		/// <remarks>
		/// Deliberately "all" rather than "any", matching the lens's MatchesAll
		/// semantics: choosing two placement constraints asks for something that
		/// satisfies both. A prefab with no flags at all satisfies no
		/// requirement, so a null must not be read as a wildcard.
		/// </remarks>
		public static bool MatchesRequiredFlags(BuildingFlags? value, BuildingFlags? required)
		{
			if (!required.HasValue || required.Value == default)
			{
				return true;
			}

			return value.HasValue && (value.Value & required.Value) == required.Value;
		}

		/// <summary>
		/// True when the prefab supports any of the selected extensions.
		/// </summary>
		public static bool MatchesAnyExtension(
			IReadOnlyList<string>? extensions,
			IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return true;
			}

			if (extensions is null || extensions.Count == 0)
			{
				return false;
			}

			foreach (var candidate in selected)
			{
				foreach (var extension in extensions)
				{
					if (string.Equals(extension, candidate, StringComparison.OrdinalIgnoreCase))
					{
						return true;
					}
				}
			}

			return false;
		}

		/// <summary>
		/// True when the prefab's service role is one of those selected.
		/// </summary>
		public static bool MatchesAnyRole(string? role, IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return true;
			}

			if (string.IsNullOrWhiteSpace(role))
			{
				return false;
			}

			foreach (var candidate in selected)
			{
				if (string.Equals(role, candidate, StringComparison.OrdinalIgnoreCase))
				{
					return true;
				}
			}

			return false;
		}
	}
}
