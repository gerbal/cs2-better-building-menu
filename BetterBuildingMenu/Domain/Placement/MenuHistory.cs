namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>One game menu's placements: the counts, the latest, and the two slot holders.</summary>
	public sealed class MenuHistory
	{
		private readonly Dictionary<string, float> _counts = new(StringComparer.Ordinal);
		private readonly List<string> _held = new();

		/// <summary>Placements by prefab name. A count halves at each launch, so it is a float.</summary>
		public IReadOnlyDictionary<string, float> Counts => _counts;

		/// <summary>The prefab placed last, or null.</summary>
		public string? Latest { get; private set; }

		/// <summary>The two prefabs that hold this menu's slots, most placed first.</summary>
		public IReadOnlyList<string> Held => _held;

		internal void Record(string prefab)
		{
			_counts[prefab] = (_counts.TryGetValue(prefab, out var count) ? count : 0f) + 1f;
			Latest = prefab;
			Hold(prefab);
		}

		internal void Restore(IEnumerable<KeyValuePair<string, float>> counts, string? latest, IEnumerable<string> held)
		{
			foreach (var pair in counts)
			{
				if (pair.Key.Trim().Length > 0 && IsCount(pair.Value))
				{
					_counts[pair.Key] = pair.Value;
				}
			}

			Latest = latest is not null && _counts.ContainsKey(latest) ? latest : null;

			foreach (var prefab in held)
			{
				if (_held.Count < PlacementHistory.HolderCount && _counts.ContainsKey(prefab) && !_held.Contains(prefab))
				{
					_held.Add(prefab);
				}
			}

			SortHeld();
		}

		internal void Decay()
		{
			foreach (var prefab in _counts.Keys.ToList())
			{
				_counts[prefab] *= 0.5f;

				if (_counts[prefab] < PlacementHistory.DropBelow && !IsKept(prefab))
				{
					_counts.Remove(prefab);
				}
			}

			if (_counts.Count <= PlacementHistory.KeepPerMenu)
			{
				return;
			}

			// The latest and the holders count towards the eight, and are never the ones cut.
			var keep = new HashSet<string>(_counts.Keys.Where(IsKept), StringComparer.Ordinal);
			keep.UnionWith(_counts
				.Where(pair => !keep.Contains(pair.Key))
				.OrderByDescending(pair => pair.Value)
				.ThenBy(pair => pair.Key, StringComparer.Ordinal)
				.Take(PlacementHistory.KeepPerMenu - keep.Count)
				.Select(pair => pair.Key)
				.ToList());

			foreach (var prefab in _counts.Keys.Where(prefab => !keep.Contains(prefab)).ToList())
			{
				_counts.Remove(prefab);
			}
		}

		private bool IsKept(string prefab) => prefab == Latest || _held.Contains(prefab);

		private void Hold(string prefab)
		{
			if (!_held.Contains(prefab))
			{
				if (_held.Count < PlacementHistory.HolderCount)
				{
					_held.Add(prefab);
				}
				else if (_counts[prefab] >= _counts[_held[_held.Count - 1]] * PlacementHistory.SlotMargin)
				{
					// Only from the margin up, so two close favourites do not trade a slot back and forth.
					_held[_held.Count - 1] = prefab;
				}
			}

			SortHeld();
		}

		private void SortHeld()
		{
			// Most placed first; a tie keeps the order the holders came in.
			if (_held.Count == 2 && _counts[_held[1]] > _counts[_held[0]])
			{
				(_held[0], _held[1]) = (_held[1], _held[0]);
			}
		}

		private static bool IsCount(float value) => !float.IsNaN(value) && !float.IsInfinity(value) && value > 0f;
	}
}
