
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
	public class IndexedPrefabList : IEnumerable<PrefabIndex>
	{
		private readonly Dictionary<int, PrefabIndex> _dictionary;
		private List<PrefabIndex> _orderedList;


		public IndexedPrefabList()
		{
			_dictionary = new();
		}

		public int Count => _dictionary.Count;

		// Name order, which was the default of the six upstream sort modes; the
		// sorting option sections that switched between them are gone
		// (cm-jjlv.9), and the lens orders its own page.
		public List<PrefabIndex> OrderedList => _orderedList ??= _dictionary.Values
			.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
			.ThenBy(x => x.PrefabName, StringComparer.Ordinal)
			.ToList();

		public PrefabIndex this[int index]
		{
			get => _dictionary[index];
			set
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
