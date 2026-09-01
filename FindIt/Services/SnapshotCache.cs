using System.Collections.Generic;
using FindItBuildingMenu.Domain;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Everything that decides what a projected snapshot contains.
	/// </summary>
	/// <remarks>
	/// The toolbar selection is spelled out as strings because
	/// <see cref="VanillaToolbarSelection"/> is a struct holding lists, and
	/// struct equality compares those by reference — every refresh would miss.
	/// The index generation is NOT part of the key: it is the cache's own
	/// clock, and a new generation empties the cache rather than filing a new
	/// entry beside a stale one.
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
	/// The projection used to be cleared at the top of every refresh, so it
	/// deduplicated the eight questions one refresh asks and cached nothing
	/// across a keystroke. This holds each scope's projection until the index
	/// itself changes (PrefabIndexingSystem.IndexGeneration), which is the
	/// only event that can make a projected entry wrong.
	/// </remarks>
	public sealed class SnapshotCache
	{
		private readonly Dictionary<SnapshotKey, BuildingCatalogEntry[]> _entries = new();
		private int _generation = -1;

		public int Count => _entries.Count;

		public bool TryGet(SnapshotKey key, int generation, out BuildingCatalogEntry[] entries)
		{
			if (generation != _generation)
			{
				_entries.Clear();
				_generation = generation;
			}

			return _entries.TryGetValue(key, out entries!);
		}

		public void Put(SnapshotKey key, int generation, BuildingCatalogEntry[] entries)
		{
			if (generation != _generation)
			{
				_entries.Clear();
				_generation = generation;
			}

			_entries[key] = entries;
		}
	}
}
