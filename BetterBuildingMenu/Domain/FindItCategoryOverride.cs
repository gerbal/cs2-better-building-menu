using System;
using System.Collections.Generic;
using System.Globalization;
using System.Diagnostics.CodeAnalysis;

using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What an asset's editor category override asks of this index.</summary>
	/// <remarks>
	/// Written in Find It's tags, "FindIt/{category}/{subcategory}[/{Paradox Mods id}]", or with our
	/// name in place of FindIt. The legacy tags are still read, so existing assets keep their
	/// classification.
	/// </remarks>
	public readonly record struct FindItCategoryOverride(
		bool Excluded,
		PrefabCategory? Category,
		PrefabSubCategory? SubCategory,
		string? PdxModsId)
	{
		public static bool IsOurs([NotNullWhen(true)] string? tag) =>
			tag is not null
			&& (tag == "FindIt"
				|| tag.StartsWith("FindIt/", StringComparison.Ordinal)
				|| tag == "BetterBuildingMenu"
				|| tag.StartsWith("BetterBuildingMenu/", StringComparison.Ordinal));

		/// <remarks>
		/// An exclusion counts only beside an include, any mod's, as in Find It: a bare
		/// exclude=FindIt opts out of Find It's prop generators, not the catalog. An unfiled
		/// category pair is ignored, since the index would throw on it. The last usable include wins.
		/// </remarks>
		public static FindItCategoryOverride Read(IReadOnlyList<string?>? includes, IReadOnlyList<string?>? excludes)
		{
			var excluded = false;
			var hasInclude = includes is { Count: > 0 };

			if (hasInclude && excludes is not null)
			{
				foreach (var exclude in excludes)
				{
					excluded |= IsOurs(exclude);
				}
			}

			PrefabCategory? category = null;
			PrefabSubCategory? subCategory = null;
			string? pdxModsId = null;

			foreach (var tag in includes ?? Array.Empty<string?>())
			{
				if (!IsOurs(tag))
				{
					continue;
				}

				var split = tag.Split('/');

				if (split.Length >= 3
					&& TryParse(split[1], out var categoryValue)
					&& TryParse(split[2], out var subCategoryValue)
					&& IsFiled((PrefabCategory)categoryValue, (PrefabSubCategory)subCategoryValue))
				{
					category = (PrefabCategory)categoryValue;
					subCategory = (PrefabSubCategory)subCategoryValue;
				}

				if (split.Length >= 4 && TryParse(split[3], out var modsId))
				{
					pdxModsId = modsId.ToString(CultureInfo.InvariantCulture);
				}
			}

			return new FindItCategoryOverride(excluded, category, subCategory, pdxModsId);
		}

		/// <summary>Whether the index files this subcategory under this category.</summary>
		/// <remarks>The same rule that lays the index out: a category's subcategories take the
		/// hundred values above it, and each category also has an Any list, for entries filed
		/// under the category alone.</remarks>
		public static bool IsFiled(PrefabCategory category, PrefabSubCategory subCategory) =>
			category is not PrefabCategory.Any
			&& Enum.IsDefined(typeof(PrefabCategory), category)
			&& (subCategory is PrefabSubCategory.Any
				|| (Enum.IsDefined(typeof(PrefabSubCategory), subCategory)
					&& (int)subCategory > (int)category
					&& (int)subCategory < (int)category + 100));

		private static bool TryParse(string text, out int value) =>
			int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
	}
}
