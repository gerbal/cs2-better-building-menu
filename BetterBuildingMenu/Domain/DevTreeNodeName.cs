using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>A dev-tree node's name, as the dev tree itself shows it.</summary>
	/// <remarks>The game files node names under Progression.NODE_NAME, not the Assets.NAME a prefab's
	/// title id points at, so asking for the prefab's title gets the English prefab name.</remarks>
	public static class DevTreeNodeName
	{
		private const string NodeSuffix = " Node";

		/// <summary>The locale key of a node's name.</summary>
		public static string Key(string prefabName) => $"Progression.NODE_NAME[{prefabName}]";

		/// <summary>The localized name, or the fallback without the "Node" every prefab name ends in.</summary>
		/// <remarks>The dev tree never shows that word, and it would repeat across every tab of the strip.</remarks>
		public static string Resolve(string? localized, string fallback) =>
			WordFormat.GameText(localized)
			?? (fallback.EndsWith(NodeSuffix, StringComparison.Ordinal)
				? fallback.Substring(0, fallback.Length - NodeSuffix.Length)
				: fallback);
	}
}
