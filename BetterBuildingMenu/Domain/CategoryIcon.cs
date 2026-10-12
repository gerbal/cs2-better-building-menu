using System;
using System.Diagnostics.CodeAnalysis;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Which of a category's two icon paths the UI can actually draw.</summary>
	public static class CategoryIcon
	{
		/// <remarks>
		/// An unresolved content hash draws nothing: the game resolves an address with exactly this
		/// prefix before its own tab bar draws it. What that leaves, a path or the hash it hands the tab
		/// bar as it is, draws. See docs/design-notes.md, "Tab icons".
		/// </remarks>
		public static bool IsResolvable([NotNullWhen(true)] string? icon) =>
			icon?.TrimStart() is { Length: > 0 } start
			&& !start.StartsWith(UnresolvedPrefix, StringComparison.Ordinal);

		/// <summary>The prefix the game's <c>UIExtensions.ResolveUri</c> resolves, compared as it compares it.</summary>
		private const string UnresolvedPrefix = "assetdb://global/";

		/// <summary>What the game's toolbar draws for a category with no icon of its own.</summary>
		public const string Placeholder = "Media/Placeholder.svg";

		/// <summary>The picture a tab draws: its own when it can be drawn, else its menu's, else the game's placeholder.</summary>
		/// <remarks>
		/// Every tab binding passes through here, so none publishes a blank or an unresolved hash. A tab
		/// left with its menu's picture says its name on the row. See docs/design-notes.md, "Tab icons".
		/// </remarks>
		public static string Chain(string? own, string? menuIcon) =>
			IsResolvable(own) ? own.Trim()
			: IsResolvable(menuIcon) ? menuIcon.Trim()
			: Placeholder;

		/// <summary>The prefab's own icon, or the image system's when that one cannot be drawn.</summary>
		public static string Resolve(string? prefabIcon, string? imageSystemIcon) =>
			IsResolvable(prefabIcon) ? prefabIcon.Trim()
			: IsResolvable(imageSystemIcon) ? imageSystemIcon.Trim()
			: prefabIcon ?? imageSystemIcon ?? string.Empty;
	}
}
