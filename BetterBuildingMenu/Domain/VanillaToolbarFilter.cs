using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// What the game's own toolbar row knows about one asset.
	/// </summary>
	/// <remarks>
	/// Entity indices rather than entities, so the rule below can be exercised
	/// without a World. The indexer fills these from the same components
	/// <c>ToolbarUISystem</c> reads.
	/// </remarks>
	public readonly struct VanillaAssetFacts
	{
		/// <summary>
		/// Requirement entities on this asset that carry <c>ThemeData</c>.
		/// </summary>
		/// <remarks>
		/// From the <c>ObjectRequirementElement</c> buffer, NOT <c>ThemeObject.m_Theme</c>,
		/// which is a different fact. Vanilla gates visibility on the requirement buffer,
		/// so matching on the other one silently disagrees with the game's own menu.
		/// </remarks>
		public IReadOnlyList<int> ThemeRequirements { get; }

		/// <summary>Pack entities from the <c>AssetPackElement</c> buffer.</summary>
		public IReadOnlyList<int> AssetPacks { get; }

		/// <summary>
		/// Whether the asset has an <c>AssetPackElement</c> buffer at all.
		/// </summary>
		/// <remarks>
		/// Distinct from an empty pack list: "no buffer" is what vanilla treats as a
		/// base-game asset and gates behind the Vanilla toggle. Collapsing the two hides
		/// every base-game asset the moment a pack is picked.
		/// </remarks>
		public bool HasPackBuffer { get; }

		/// <summary>Carries <c>ModPrerequisiteData</c> itself, and no pack of its carries it too: one
		/// that does answers to the pack filter instead. See <see cref="From"/>.</summary>
		public bool IsModAsset { get; }

		public VanillaAssetFacts(
			IReadOnlyList<int>? themeRequirements,
			IReadOnlyList<int>? assetPacks,
			bool hasPackBuffer,
			bool isModAsset)
		{
			ThemeRequirements = themeRequirements ?? System.Array.Empty<int>();
			AssetPacks = assetPacks ?? System.Array.Empty<int>();
			HasPackBuffer = hasPackBuffer;
			IsModAsset = isModAsset;
		}

		/// <summary>The facts from what the indexer read off an asset's entity.</summary>
		/// <param name="requirements">Each ObjectRequirementElement's entity index, and whether that
		/// entity carries ThemeData.</param>
		/// <param name="packs">Each AssetPackElement's entity index, and whether that pack carries
		/// ModPrerequisiteData; null when the asset has no AssetPackElement buffer.</param>
		/// <param name="hasModPrerequisite">Whether the asset itself carries ModPrerequisiteData.</param>
		/// <remarks>IsModAsset, and the second half is easy to get backwards: an asset carrying
		/// ModPrerequisiteData is NOT a mod asset when one of its packs carries it too, so the pack
		/// filter governs it, not the Mods toggle.</remarks>
		public static VanillaAssetFacts From(
			IEnumerable<(int Index, bool IsTheme)> requirements,
			IReadOnlyList<(int Index, bool HasModPrerequisite)>? packs,
			bool hasModPrerequisite)
		{
			var themeRequirements = new List<int>();

			foreach (var (index, isTheme) in requirements)
			{
				if (isTheme)
				{
					themeRequirements.Add(index);
				}
			}

			var packIndices = new List<int>();
			var isModAsset = hasModPrerequisite;

			if (packs is not null)
			{
				foreach (var (index, packHasModPrerequisite) in packs)
				{
					packIndices.Add(index);

					if (isModAsset && packHasModPrerequisite)
					{
						isModAsset = false;
					}
				}
			}

			return new VanillaAssetFacts(themeRequirements, packIndices, packs is not null, isModAsset);
		}
	}

	/// <summary>
	/// The state of the game's toolbar filter row: themes, packs, and the two
	/// source toggles.
	/// </summary>
	/// <remarks>
	/// Published by the game as the UI bindings <c>toolbar.selectedThemes</c>,
	/// <c>selectedAssetPacks</c>, <c>vanillaSelected</c> and <c>modsSelected</c>; the
	/// equivalent ToolbarUISystem fields are private, so the bindings are the route.
	/// </remarks>
	public readonly struct VanillaToolbarSelection
	{
		// Read through the properties, so default(VanillaToolbarSelection) is None
		// rather than a pair of nulls.
		private readonly IReadOnlyList<int>? _selectedThemes;
		private readonly IReadOnlyList<int>? _selectedPacks;

		public IReadOnlyList<int> SelectedThemes => _selectedThemes ?? System.Array.Empty<int>();
		public IReadOnlyList<int> SelectedPacks => _selectedPacks ?? System.Array.Empty<int>();
		public bool VanillaSelected { get; }
		public bool ModsSelected { get; }

		public VanillaToolbarSelection(
			IReadOnlyList<int>? selectedThemes,
			IReadOnlyList<int>? selectedPacks,
			bool vanillaSelected,
			bool modsSelected)
		{
			_selectedThemes = selectedThemes;
			_selectedPacks = selectedPacks;
			VanillaSelected = vanillaSelected;
			ModsSelected = modsSelected;
		}

		public static VanillaToolbarSelection None => new(null, null, false, false);

		/// <summary>Nothing is selected, so nothing is filtered.</summary>
		public bool IsEmpty =>
			SelectedThemes.Count == 0 && SelectedPacks.Count == 0 && !VanillaSelected && !ModsSelected;
	}

	/// <summary>
	/// Whether the game's own toolbar row would show an asset.
	/// </summary>
	/// <remarks>
	/// A transcription of <c>ToolbarUISystem.FilterByThemes</c> and <c>FilterByPacks</c>,
	/// which vanilla runs over every asset in <c>BindAssets</c> before drawing a menu.
	/// A pure function on plain lists, so it can be checked against those without a World.
	/// </remarks>
	public static class VanillaToolbarFilter
	{
		/// <summary>
		/// The theme half. An asset is hidden when it carries a theme
		/// requirement and none of the selected themes satisfies it.
		/// </summary>
		/// <remarks>
		/// A requirement list with no ThemeData at all leaves the asset visible whatever
		/// is selected, because it is not theme-gated: vanilla uses a flag that only
		/// turns on when it sees ThemeData and turns off again on a match.
		/// </remarks>
		public static bool PassesThemes(VanillaAssetFacts asset, IReadOnlyList<int> selectedThemes)
		{
			if (asset.ThemeRequirements.Count == 0)
			{
				return true;
			}

			for (var i = 0; i < asset.ThemeRequirements.Count; i++)
			{
				for (var j = 0; j < selectedThemes.Count; j++)
				{
					if (asset.ThemeRequirements[i] == selectedThemes[j])
					{
						return true;
					}
				}
			}

			return false;
		}

		/// <summary>
		/// The pack and source half, including the Vanilla and Mods toggles,
		/// which live on the same row and share this filter in the game.
		/// </summary>
		public static bool PassesPacks(VanillaAssetFacts asset, VanillaToolbarSelection selection)
		{
			// Vanilla's own early out: with nothing selected anywhere, this
			// filter does not run at all. It is what makes an untouched toolbar
			// show everything rather than nothing.
			if (selection.SelectedPacks.Count == 0 && !selection.VanillaSelected && !selection.ModsSelected)
			{
				return true;
			}

			if (asset.IsModAsset)
			{
				return selection.ModsSelected;
			}

			if (!asset.HasPackBuffer)
			{
				return selection.VanillaSelected;
			}

			if (selection.SelectedPacks.Count == 0)
			{
				return false;
			}

			for (var i = 0; i < asset.AssetPacks.Count; i++)
			{
				for (var j = 0; j < selection.SelectedPacks.Count; j++)
				{
					if (asset.AssetPacks[i] == selection.SelectedPacks[j])
					{
						return true;
					}
				}
			}

			return false;
		}

		/// <summary>Both halves, in the order vanilla applies them.</summary>
		public static bool IsVisible(VanillaAssetFacts asset, VanillaToolbarSelection selection)
		{
			if (selection.IsEmpty)
			{
				return true;
			}

			return PassesThemes(asset, selection.SelectedThemes) && PassesPacks(asset, selection);
		}
	}
}
