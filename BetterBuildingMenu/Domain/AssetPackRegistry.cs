using System.Collections.Generic;
using System.Globalization;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Pack entity index -> the whole entity, and its name.
	/// </summary>
	/// <remarks>
	/// Vanilla's pack setter takes entities, so the version is recorded here as the
	/// indexer walks the packs and both halves are in hand. Its own type, not a
	/// static on the indexing system, so the pack facet can be tested without a World.
	/// </remarks>
	public static class AssetPackRegistry
	{
		private static readonly Dictionary<int, (int Version, string Name)> _packs = new();

		/// <summary>First writer wins: the pack is the same entity every time.</summary>
		public static void Record(int index, int version, string name)
		{
			if (string.IsNullOrWhiteSpace(name) || _packs.ContainsKey(index))
			{
				return;
			}

			_packs[index] = (version, name);
		}

		/// <summary>The pack's name, or empty when it was never indexed.</summary>
		public static string NameOf(int index) =>
			_packs.TryGetValue(index, out var pack) ? pack.Name : string.Empty;

		/// <summary>
		/// The pack as "index:version", which is what the vanilla setter needs.
		/// </summary>
		public static string IdOf(int index) =>
			_packs.TryGetValue(index, out var pack)
				? $"{index.ToString(CultureInfo.InvariantCulture)}:{pack.Version.ToString(CultureInfo.InvariantCulture)}"
				: string.Empty;

		/// <summary>Drops everything — a re-index republishes it.</summary>
		public static void Clear() => _packs.Clear();
	}
}
