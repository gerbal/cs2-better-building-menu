using System.Collections.Generic;
using System.Globalization;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Pack entity index -> the whole entity, and its name.
	/// </summary>
	/// <remarks>
	/// The rail has to be able to SELECT a pack, and vanilla's setter takes
	/// entities. An index alone cannot be turned back into one, so the version
	/// is kept here as the indexer walks the packs, where both halves are
	/// already in hand.
	///
	/// Its own type rather than a static on the indexing system so the facet
	/// that reads it can be exercised without a World — the pack group is built
	/// from this, and a group that can only be tested in a running game is a
	/// group that goes untested.
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
