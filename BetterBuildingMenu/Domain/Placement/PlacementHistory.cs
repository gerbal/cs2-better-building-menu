namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>
	/// What the player places, per game menu, kept on their computer in history.json for the
	/// build menu to offer their usual buildings. Nothing is sent anywhere.
	/// </summary>
	/// <remarks>
	/// Menus are the game's UIAssetMenuPrefab names and prefabs their prefab names. See
	/// docs/design-notes.md, "The placement history".
	/// </remarks>
	public sealed class PlacementHistory
	{
		/// <summary>The file format this release reads and writes: the menus alone.</summary>
		public const int Version = 1;

		public const int HolderCount = 2;

		/// <summary>A newcomer takes the weaker holder's slot once its count is this many times the holder's.</summary>
		public const float SlotMargin = 1.25f;

		/// <summary>After the launch's halving, a count under this goes, unless it is the latest or a holder.</summary>
		public const float DropBelow = 0.5f;

		/// <summary>How many prefabs a menu keeps after the launch's halving, the latest and the holders among them.</summary>
		public const int KeepPerMenu = 8;

		private readonly Dictionary<string, MenuHistory> _menus = new(StringComparer.Ordinal);

		/// <param name="readOnly">True for a file this session must not write over: a newer release's, or one that cannot be read or kept aside.</param>
		public PlacementHistory(bool readOnly = false)
		{
			IsReadOnly = readOnly;
		}

		public IReadOnlyDictionary<string, MenuHistory> Menus => _menus;

		public bool IsReadOnly { get; }

		/// <summary>Whether there is a placement the file does not have yet.</summary>
		public bool IsDirty { get; private set; }

		/// <summary>One placement: a count of 1, the latest, and the slots checked again.</summary>
		public void Record(string menu, string prefab)
		{
			if (IsReadOnly)
			{
				return;
			}

			if (!_menus.TryGetValue(menu, out var history))
			{
				history = new MenuHistory();
				_menus[menu] = history;
			}

			history.Record(prefab);
			IsDirty = true;
		}

		/// <summary>A menu as the file holds it, keeping only what is well-formed.</summary>
		/// <remarks>
		/// A count must be a positive number; the latest and the holders must have a count;
		/// at most two holders. A file edited by hand loses the rest, not the whole file.
		/// </remarks>
		public void Restore(string menu, IEnumerable<KeyValuePair<string, float>> counts, string? latest, IEnumerable<string> held)
		{
			var history = new MenuHistory();
			history.Restore(counts, latest, held);

			if (menu.Trim().Length > 0 && history.Counts.Count > 0)
			{
				_menus[menu] = history;
			}
		}

		/// <summary>
		/// Once a launch, as the file is read: every count halves, counts under a half go and
		/// each menu keeps its eight most placed, never dropping the latest or a holder.
		/// </summary>
		/// <remarks>
		/// Leaves the history clean, so a launch that places nothing leaves the file as it was.
		/// Recent habits outweigh old ones, and a miscount fades.
		/// </remarks>
		public void Decay()
		{
			foreach (var menu in _menus.Keys.ToList())
			{
				_menus[menu].Decay();

				if (_menus[menu].Counts.Count == 0)
				{
					_menus.Remove(menu);
				}
			}
		}

		/// <summary>The file now holds every placement.</summary>
		public void MarkClean()
		{
			IsDirty = false;
		}
	}
}
