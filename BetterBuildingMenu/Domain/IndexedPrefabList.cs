
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	public class IndexedPrefabList : IEnumerable<PrefabIndex>
	{
		private readonly Dictionary<int, PrefabIndex> _dictionary;
		private List<PrefabIndex>? _orderedList;


		public IndexedPrefabList()
		{
			_dictionary = new();
		}

		public int Count => _dictionary.Count;

		// Name order, tie-broken on the prefab name and then the id so it is stable,
		// and so CatalogIndex.GetByPrefabName agrees with it; the asset menu orders its own
		// page. Private, so no reader can reorder or edit it.
		private List<PrefabIndex> OrderedList => _orderedList ??= _dictionary.Values
			.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
			.ThenBy(x => x.PrefabName, StringComparer.Ordinal)
			.ThenBy(x => x.Id)
			.ToList();

		// Written only through CatalogIndex.File, which keeps the two lists an entry is
		// filed in together.
		public PrefabIndex this[int index]
		{
			get => _dictionary[index];
			internal set
			{
				_dictionary[index] = value;
				_orderedList = null;
			}
		}

		public bool Contains(int id)
		{
			return _dictionary.ContainsKey(id);
		}

		public bool TryGetValue(int id, out PrefabIndex prefabIndex)
		{
			return _dictionary.TryGetValue(id, out prefabIndex);
		}

		public IEnumerator<PrefabIndex> GetEnumerator()
		{
			return OrderedList.GetEnumerator();
		}

		IEnumerator IEnumerable.GetEnumerator()
		{
			return OrderedList.GetEnumerator();
		}

		internal void Remove(PrefabIndex prefabIndex)
		{
			_dictionary.Remove(prefabIndex.Id);

			ResetOrder();
		}

		internal void ResetOrder()
		{
			_orderedList = null;
		}
	}
}
