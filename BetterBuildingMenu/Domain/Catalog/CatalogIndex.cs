using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// Every indexed prefab, filed three ways: everything, its category, and its subcategory.
	/// </summary>
	/// <remarks>
	/// A full pass builds a new one. PrefabIndexingSystem is the only writer, on the main
	/// thread, and a partial pass or an unlock edits the published one in place, then bumps
	/// the generation. See docs/indexing.md, "A pass that fails".
	/// </remarks>
	public sealed class CatalogIndex
	{
		private readonly Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> _lists = new();

		/// <summary>An empty index with every list laid out, not yet ready.</summary>
		public CatalogIndex()
		{
			foreach (PrefabCategory category in Enum.GetValues(typeof(PrefabCategory)))
			{
				_lists[category] = new() { { PrefabSubCategory.Any, new() } };

				if (category == PrefabCategory.Any)
				{
					continue;
				}

				// A subcategory's value sits just above its category's, within the next hundred.
				foreach (PrefabSubCategory subCategory in Enum.GetValues(typeof(PrefabSubCategory)))
				{
					if ((int)subCategory > (int)category && (int)subCategory < (int)category + 100)
					{
						_lists[category][subCategory] = new();
					}
				}
			}

			All = _lists[PrefabCategory.Any][PrefabSubCategory.Any];
		}

		/// <summary>Whether a pass has filled it; until then the panel shows the indexing notice.</summary>
		public bool IsReady { get; internal set; }

		/// <summary>Every entry, in name order.</summary>
		public IndexedPrefabList All { get; }

		/// <summary>The entries filed under one subcategory, or null for a pair that is not laid out.</summary>
		public IndexedPrefabList? List(PrefabCategory category, PrefabSubCategory subCategory) =>
			_lists.TryGetValue(category, out var subCategories) && subCategories.TryGetValue(subCategory, out var list)
				? list
				: null;

		/// <summary>A category's lists, its own <see cref="PrefabSubCategory.Any"/> included.</summary>
		/// <remarks>Projected rather than the dictionary itself, which a caller could cast back and edit.</remarks>
		public IEnumerable<KeyValuePair<PrefabSubCategory, IndexedPrefabList>> ListsIn(PrefabCategory category) =>
			_lists.TryGetValue(category, out var subCategories)
				? subCategories.Select(pair => pair)
				: Enumerable.Empty<KeyValuePair<PrefabSubCategory, IndexedPrefabList>>();

		/// <summary>The entry for a prefab entity's index, or null when nothing indexed it.</summary>
		public PrefabIndex? Get(int id) => All.TryGetValue(id, out var entry) ? entry : null;

		public PrefabBase? GetPrefab(int id) => Get(id)?.Prefab;

		/// <summary>Files an entry in the three lists the panel reads: everything, its category, its subcategory.</summary>
		/// <remarks>
		/// An entry already filed under the same id is taken out of its own lists first. Two
		/// processors can claim one prefab, and the later entry would otherwise replace the
		/// earlier one only in the lists they share, leaving it listed under the earlier
		/// category too.
		/// </remarks>
		internal void File(PrefabIndex entry)
		{
			Remove(entry.Id);

			_lists[PrefabCategory.Any][PrefabSubCategory.Any][entry.Id] = entry;
			_lists[entry.Category][PrefabSubCategory.Any][entry.Id] = entry;
			_lists[entry.Category][entry.SubCategory][entry.Id] = entry;
		}

		internal void Remove(int id)
		{
			if (All.TryGetValue(id, out var entry))
			{
				All.Remove(entry);
				_lists[entry.Category][PrefabSubCategory.Any].Remove(entry);
				_lists[entry.Category][entry.SubCategory].Remove(entry);
			}
		}

		/// <summary>The first entry in name order with this prefab name.</summary>
		internal bool Find(string prefabName, out int id)
		{
			var entry = All.FirstOrDefault(candidate => candidate.PrefabName == prefabName);
			id = entry?.Id ?? 0;

			return entry is not null;
		}

		/// <summary>Every list, for the indexer's clean-up passes.</summary>
		internal IEnumerable<(PrefabCategory Category, PrefabSubCategory SubCategory, IndexedPrefabList List)> Lists() =>
			_lists.SelectMany(category => category.Value.Select(sub => (category.Key, sub.Key, sub.Value)));
	}
}
