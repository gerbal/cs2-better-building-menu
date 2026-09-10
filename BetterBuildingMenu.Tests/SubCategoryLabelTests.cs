using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Every subcategory the lens can show has a label to show it under. Nothing
	/// else connects the enum to the string table, and a missing entry falls back
	/// quietly to a raw identifier. Only Locale.json is checked.
	/// </summary>
	public sealed class SubCategoryLabelTests
	{
		[Fact]
		public void EverySubCategoryHasAnEnglishLabel()
		{
			var labels = LoadLocaleKeys();
			var missing = SubCategories()
				.Where(name => !labels.Contains($"Tooltip.LABEL[BetterBuildingMenu.{name}]"))
				.ToArray();

			Assert.True(
				missing.Length == 0,
				$"No label in Locale.json for: {string.Join(", ", missing)}. "
				+ "Add \"Tooltip.LABEL[BetterBuildingMenu.<name>]\" for each.");
		}

		[Fact]
		public void EverySubCategoryHasAnIcon()
		{
			// The same omission with a different symptom: a heading with no icon
			// beside neighbours that have one, or a placeholder square that reads as
			// a broken asset.
			var missing = SubCategories()
				.Where(name => string.IsNullOrWhiteSpace(
					CategoryIconAttribute.GetAttribute(Parse(name)).Icon))
				.ToArray();

			Assert.True(missing.Length == 0, $"No CategoryIcon for: {string.Join(", ", missing)}");
		}

		/// <summary>
		/// The real subcategories, which is every value naming a parent.
		/// </summary>
		/// <remarks>
		/// The underscore is the discriminator: the enum also holds Any, a
		/// pseudo-category, and obsolete aliases reserving each block's base number.
		/// </remarks>
		private static IEnumerable<string> SubCategories() =>
			Enum.GetNames(typeof(PrefabSubCategory)).Where(name => name.Contains('_'));

		private static PrefabSubCategory Parse(string name) =>
			(PrefabSubCategory)Enum.Parse(typeof(PrefabSubCategory), name);

		private static HashSet<string> LoadLocaleKeys()
		{
			// Read from the mod assembly's own embedded copy rather than a path
			// relative to the test binary, so this cannot pass by finding a stale
			// file or fail by not finding one at all.
			using var stream = typeof(PrefabSubCategory).Assembly
				.GetManifestResourceStream("BetterBuildingMenu.Locale.json");

			Assert.NotNull(stream);

			using var reader = new StreamReader(stream!);
			var json = reader.ReadToEnd();
			var keys = new HashSet<string>(StringComparer.Ordinal);

			// Deliberately not a JSON parser: the file is a flat string-to-string
			// map, the test only needs the keys, and the mod targets a framework
			// whose serializer the test project does not reference.
			foreach (var line in json.Split('\n'))
			{
				var start = line.IndexOf('"');

				if (start < 0)
				{
					continue;
				}

				var end = line.IndexOf('"', start + 1);

				if (end > start)
				{
					keys.Add(line.Substring(start + 1, end - start - 1));
				}
			}

			return keys;
		}
	}
}
