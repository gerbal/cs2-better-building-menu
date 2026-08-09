using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// Every subcategory the lens can show has a label to show it under.
	/// </summary>
	/// <remarks>
	/// Written because adding one was not enough. Closing the vanilla-menu
	/// coverage gaps introduced five subcategories — seaways, power lines, pipes,
	/// road services and transit lines — and every one of them shipped without a
	/// locale entry, because nothing connected the enum to the string table but
	/// the memory of whoever last edited both.
	///
	/// The failure is quiet in exactly the way that matters: the heading falls
	/// back to a raw identifier, so a menu reads "Networks_PowerLines" beside
	/// "Highways" and looks like a bug in the game rather than a missing
	/// translation.
	///
	/// Only Locale.json is checked. The translated files are deliberately partial
	/// (102 keys against 246) and fall back to English, so requiring them to keep
	/// pace would either block a change on translation or invite English strings
	/// to be pasted in as if they were translated.
	/// </remarks>
	public sealed class SubCategoryLabelTests
	{
		[Fact]
		public void EverySubCategoryHasAnEnglishLabel()
		{
			var labels = LoadLocaleKeys();
			var missing = SubCategories()
				.Where(name => !labels.Contains($"Tooltip.LABEL[FindItBuildingMenu.{name}]"))
				.ToArray();

			Assert.True(
				missing.Length == 0,
				$"No label in Locale.json for: {string.Join(", ", missing)}. "
				+ "Add \"Tooltip.LABEL[FindItBuildingMenu.<name>]\" for each.");
		}

		[Fact]
		public void EverySubCategoryHasAnIcon()
		{
			// The same omission with a different symptom: a heading with no icon
			// where its neighbours have one, or the placeholder square that the
			// empty ferry tab already taught us reads as a broken asset.
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
		/// The underscore is the discriminator because the enum holds three kinds
		/// of value: Any and Favorite, which are pseudo-categories; the obsolete
		/// aliases that exist only to reserve each block's base number; and the
		/// subcategories themselves, all of the form Parent_Child.
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
				.GetManifestResourceStream("FindItBuildingMenu.Locale.json");

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
