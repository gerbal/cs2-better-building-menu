using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Services
{
	/// <summary>
	/// Everything that decides what a projected snapshot contains.
	/// </summary>
	/// <remarks>
	/// The toolbar selection is spelled out as strings because <see cref="VanillaToolbarSelection"/>
	/// is a struct holding lists, and struct equality compares those by reference. The index's
	/// content generation is NOT part of the key: it is the cache's own clock, and a new one empties it.
	/// </remarks>
	public readonly record struct SnapshotKey(
		string Menu,
		string DlcUnion,
		bool IgnorePacks,
		string Themes,
		string Packs,
		bool VanillaSelected,
		bool ModsSelected)
	{
		public static SnapshotKey For(
			string? menu,
			IReadOnlyList<string>? dlcUnion,
			bool ignorePacks,
			VanillaToolbarSelection selection) =>
			new(
				menu?.Trim() ?? string.Empty,
				dlcUnion is null ? "*" : string.Join(",", dlcUnion),
				ignorePacks,
				string.Join(",", selection.SelectedThemes),
				string.Join(",", selection.SelectedPacks),
				selection.VanillaSelected,
				selection.ModsSelected);
	}

	/// <summary>
	/// Projected snapshots that survive from one refresh to the next.
	/// </summary>
	/// <remarks>
	/// Each scope's projection is held until the index's contents change
	/// (PrefabIndexingSystem.ContentGeneration). A lock or a placed unique only moves the
	/// generation each snapshot is stamped with, and the adapter brings that snapshot's rows up to
	/// date in place rather than projecting the menu again.
	/// </remarks>
	public sealed class SnapshotCache
	{
		private readonly Dictionary<SnapshotKey, (BuildingCatalogEntry[] Entries, int Generation)> _entries = new();
		private int _content = -1;

		public int Count => _entries.Count;

		/// <param name="generation">The generation the snapshot's rows were last brought up to.</param>
		public bool TryGet(SnapshotKey key, int content, [NotNullWhen(true)] out BuildingCatalogEntry[]? entries, out int generation)
		{
			Expire(content);

			if (_entries.TryGetValue(key, out var held))
			{
				(entries, generation) = held;
				return true;
			}

			entries = null;
			generation = -1;
			return false;
		}

		public void Put(SnapshotKey key, int content, int generation, BuildingCatalogEntry[] entries)
		{
			Expire(content);
			_entries[key] = (entries, generation);
		}

		private void Expire(int content)
		{
			if (content != _content)
			{
				_entries.Clear();
				_content = content;
			}
		}
	}
}
