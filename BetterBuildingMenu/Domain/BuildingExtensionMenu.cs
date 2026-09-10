using System;
using System.Collections.Generic;

using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
#nullable enable
	/// <summary>
	/// What our extension picker shows for the selected building: the catalog
	/// entry behind each upgrade the building supports, in vanilla's order.
	/// </summary>
	/// <remarks>
	/// Presentation only: vanilla's <c>upgradeMenu.upgrades</c> binding is the
	/// authority on what may be attached and what is locked or already built. The UI
	/// joins it to these entries by prefab name and leaves the panel to vanilla on a gap.
	/// </remarks>
	public sealed record BuildingExtensionMenu(
		string BuildingName,
		BuildingCatalogEntry[] Entries) : IJsonWritable
	{
		public static readonly BuildingExtensionMenu Empty = new(string.Empty, Array.Empty<BuildingCatalogEntry>());

		/// <param name="supportedUpgrades">
		/// <see cref="PrefabIndex.SupportedUpgradeIds"/> — prefab names, already
		/// in the order vanilla's picker lists them.
		/// </param>
		/// <param name="resolve">The catalog entry for a prefab name, or null.</param>
		public static BuildingExtensionMenu Build(
			string buildingName,
			IReadOnlyList<string>? supportedUpgrades,
			Func<string, BuildingCatalogEntry?> resolve)
		{
			if (supportedUpgrades is null || supportedUpgrades.Count == 0)
			{
				return new BuildingExtensionMenu(buildingName, Array.Empty<BuildingCatalogEntry>());
			}

			var entries = new List<BuildingCatalogEntry>(supportedUpgrades.Count);

			foreach (var name in supportedUpgrades)
			{
				if (resolve(name) is { } entry)
				{
					entries.Add(entry);
				}
			}

			return new BuildingExtensionMenu(buildingName, entries.ToArray());
		}

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.PropertyName("buildingName");
			writer.Write(BuildingName);

			writer.PropertyName("entries");
			writer.ArrayBegin((uint)Entries.Length);
			foreach (var entry in Entries)
			{
				entry.Write(writer);
			}
			writer.ArrayEnd();

			writer.TypeEnd();
		}
	}
}
