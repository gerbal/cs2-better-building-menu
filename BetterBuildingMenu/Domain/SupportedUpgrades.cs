using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One upgrade a building offers: its menu priority, the name a player reads, and the
	/// prefab name that places it.</summary>
	public readonly record struct UpgradeOffer(int Priority, string Name, string PrefabName);

	/// <summary>The upgrades a building supports, in the order vanilla offers them.</summary>
	public static class SupportedUpgrades
	{
		/// <summary>The offers by priority, as two lists side by side: the names, and the prefab
		/// names in the same order.</summary>
		/// <param name="offers">Each upgrade that has a UIObject and a prefab, in the order the game's
		/// buffers hold them: BuildingUpgradeElement's, then BuildingModule's.</param>
		/// <remarks>UpgradeMenuUISystem's order. OrderBy, not Sort: it is stable, so two upgrades
		/// sharing a priority keep the order the game's own buffers hold them in.</remarks>
		public static (string[] DisplayNames, string[] PrefabNames) InMenuOrder(IReadOnlyList<UpgradeOffer>? offers)
		{
			if (offers is null)
			{
				return (Array.Empty<string>(), Array.Empty<string>());
			}

			var ordered = offers.OrderBy(offer => offer.Priority).ToArray();

			return (
				ordered.Select(offer => offer.Name).ToArray(),
				ordered.Select(offer => offer.PrefabName).ToArray());
		}
	}
}
