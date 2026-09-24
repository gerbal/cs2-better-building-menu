using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Utilities;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// Every indexed prefab, filed twice: under everything, and under its subcategory.
	/// </summary>
	/// <remarks>
	/// A load publishes an empty one at preload, and a full pass builds a new one aside and
	/// publishes it when the pass succeeds. PrefabIndexingSystem is the only writer, on the
	/// main thread, and a partial pass or an unlock edits the published one in place, then
	/// bumps the generation. See docs/indexing.md, "A pass that fails".
	/// </remarks>
	public sealed class CatalogIndex
	{
		private readonly Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> _lists = new();

		// Prefab name -> every entry filed under it, kept in step by File and Remove. A
		// prefab's name is set before it is filed and never after.
		private readonly Dictionary<string, List<PrefabIndex>> _namesakes = new(StringComparer.Ordinal);

		/// <summary>An empty index with every list laid out, over the tables a full pass has read.</summary>
		/// <remarks>A table left out is empty, as before the first pass; tests build only what they read.</remarks>
		public CatalogIndex(
			VanillaMenuIndex? menus = null,
			ZoneIndex? zones = null,
			ProgressionIndex? progression = null,
			ModCompatibility? mods = null)
		{
			Menus = menus ?? VanillaMenuIndex.Empty;
			Zones = zones ?? ZoneIndex.Empty;
			Progression = progression ?? ProgressionIndex.Empty;
			Mods = mods ?? ModCompatibility.None;

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

		/// <summary>The game's own build menus, as the pass that built this index read them.</summary>
		public VanillaMenuIndex Menus { get; }

		/// <summary>The zones, as the pass that built this index read them.</summary>
		public ZoneIndex Zones { get; }

		/// <summary>The milestones and the development tree, as the pass that built this index read them.</summary>
		public ProgressionIndex Progression { get; }

		/// <summary>The mods this index adapted to, as of the pass that built it.</summary>
		public ModCompatibility Mods { get; }

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

		/// <summary>The entry a prefab name resolves to, or null when nothing indexed carries it.</summary>
		/// <remarks>Two prefab types can carry one name; then the first by display name answers,
		/// as the lists order them, and the lower id between equal names.</remarks>
		public PrefabIndex? GetByPrefabName(string prefabName)
		{
			if (!_namesakes.TryGetValue(prefabName, out var namesakes))
			{
				return null;
			}

			var first = namesakes[0];

			for (var i = 1; i < namesakes.Count; i++)
			{
				var order = StringComparer.OrdinalIgnoreCase.Compare(namesakes[i].Name, first.Name);

				if (order < 0 || (order == 0 && namesakes[i].Id < first.Id))
				{
					first = namesakes[i];
				}
			}

			return first;
		}

		public PrefabBase? GetPrefab(int id) => Get(id)?.Prefab;

		/// <summary>The tab strip for a menu, empty when the menu has none.</summary>
		/// <remarks>Roads gets more tabs than the game gives it: the lens gathers every network there
		/// (see <see cref="NetworkMenuExtension"/>), so the strip has to offer the extras too.</remarks>
		public IReadOnlyList<VanillaMenuCategory> GetMenuCategories(string? menu)
		{
			var tabs = Menus.CategoriesOf(menu);

			if (!NetworkMenuExtension.IsExtended(menu) || tabs.Count == 0)
			{
				return tabs;
			}

			return tabs.Concat(ExtraNetworkCategories()).ToArray();
		}

		/// <summary>A tab for each kind of network the Roads menu does not already hold.</summary>
		/// <remarks>Built from what is indexed rather than from the enum, so a subcategory with nothing
		/// in it draws no tab. Ids match what NetworkMenuExtension.Reframe writes onto the entries.</remarks>
		private IEnumerable<VanillaMenuCategory> ExtraNetworkCategories()
		{
			foreach (var pair in ListsIn(PrefabCategory.Networks).OrderBy(pair => (int)pair.Key))
			{
				if (pair.Key == PrefabSubCategory.Any || pair.Value.Count == 0)
				{
					continue;
				}

				// Only the ones that arrive through the extension. A subcategory whose
				// members are all in the Roads menu already has vanilla tabs covering
				// them, and a second tab over the same assets would split the roads.
				if (!pair.Value.Any(prefab => !string.Equals(
						prefab.UiMenuName,
						NetworkMenuExtension.RoadsMenu,
						StringComparison.OrdinalIgnoreCase)))
				{
					continue;
				}

				var name = pair.Key.ToString();

				yield return new VanillaMenuCategory(
					Id: NetworkMenuExtension.GroupId(name),
					Name: NetworkMenuExtension.GroupId(name),
					Icon: IconPath.Normalize(CategoryIconAttribute.GetAttribute(pair.Key).Icon) ?? string.Empty,
					Priority: NetworkMenuExtension.GroupPriority(name));
			}
		}

		/// <summary>Files an entry in the two lists it belongs to: everything, and its own subcategory's.</summary>
		/// <remarks>
		/// An entry already filed under the same id is taken out first, so when two processors
		/// claim one prefab it stays listed under the later one's category only. A category's
		/// <see cref="PrefabSubCategory.Any"/> list holds just the entries filed under it alone.
		/// </remarks>
		internal void File(PrefabIndex entry)
		{
			Remove(entry.Id);

			All[entry.Id] = entry;
			_lists[entry.Category][entry.SubCategory][entry.Id] = entry;

			if (entry.PrefabName.Length > 0)
			{
				if (!_namesakes.TryGetValue(entry.PrefabName, out var namesakes))
				{
					_namesakes[entry.PrefabName] = namesakes = new List<PrefabIndex>(1);
				}

				namesakes.Add(entry);
			}
		}

		internal void Remove(int id)
		{
			if (All.TryGetValue(id, out var entry))
			{
				All.Remove(entry);
				_lists[entry.Category][entry.SubCategory].Remove(entry);

				if (_namesakes.TryGetValue(entry.PrefabName, out var namesakes)
					&& namesakes.RemoveAll(namesake => namesake.Id == id) > 0
					&& namesakes.Count == 0)
				{
					_namesakes.Remove(entry.PrefabName);
				}
			}
		}

		/// <summary>Removes every entry filed under a prefab name that <paramref name="which"/> picks.</summary>
		/// <returns>How many it removed.</returns>
		internal int RemoveNamesakes(string prefabName, Func<PrefabIndex, bool> which)
		{
			if (!_namesakes.TryGetValue(prefabName, out var namesakes))
			{
				return 0;
			}

			var ids = namesakes.Where(which).Select(entry => entry.Id).ToList();

			foreach (var id in ids)
			{
				Remove(id);
			}

			return ids.Count;
		}

		/// <summary>Numbers the display names that repeat, so each row can be told apart.</summary>
		/// <remarks>
		/// Every pass, partial ones too: one re-read prefab takes back its plain name, and its
		/// namesakes' numbers are only right if all of them are counted again. Upgrades are left
		/// out: every school type has an "Extension Wing", and they are never listed beside each
		/// other, only on their own parent's picker, where "Extension Wing 2" has no referent.
		/// </remarks>
		internal void NumberDuplicateNames()
		{
			// In id order, so namesakes that share a prefab name too are numbered the same way
			// on every pass, whatever order they were filed in.
			var numbered = All.Where(entry => !entry.IsServiceUpgrade).OrderBy(entry => entry.Id).ToList();
			var names = DuplicateNameNumbering.Names(numbered.Select(entry => (entry.AssetName, entry.PrefabName)).ToList());

			for (var i = 0; i < numbered.Count; i++)
			{
				numbered[i].Name = names[i];
			}

			// Every list is in name order.
			foreach (var (_, _, list) in Lists())
			{
				list.ResetOrder();
			}
		}

		/// <summary>Every list, for renumbering.</summary>
		private IEnumerable<(PrefabCategory Category, PrefabSubCategory SubCategory, IndexedPrefabList List)> Lists() =>
			_lists.SelectMany(category => category.Value.Select(sub => (category.Key, sub.Key, sub.Value)));
	}
}
