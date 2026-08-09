using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
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
		/// From the <c>ObjectRequirementElement</c> buffer, NOT from
		/// <c>ThemeObject.m_Theme</c>. This is the trap: the mod's building
		/// indexer reads ThemeObject for its own theme facet, and that is a
		/// different fact. Vanilla gates visibility on the requirement buffer,
		/// so a zone whose ThemeObject says European can still be visible under
		/// North American if its requirements say so — and matching on the wrong
		/// one silently disagrees with the game's own menu.
		/// </remarks>
		public IReadOnlyList<int> ThemeRequirements { get; }

		/// <summary>Pack entities from the <c>AssetPackElement</c> buffer.</summary>
		public IReadOnlyList<int> AssetPacks { get; }

		/// <summary>
		/// Whether the asset has an <c>AssetPackElement</c> buffer at all.
		/// </summary>
		/// <remarks>
		/// Distinct from an empty pack list: "no buffer" is what vanilla treats
		/// as a base-game asset and gates behind the Vanilla toggle, while an
		/// empty buffer is a pack asset belonging to no selected pack. Collapsing
		/// the two hides every base-game asset the moment a pack is picked.
		/// </remarks>
		public bool HasPackBuffer { get; }

		/// <summary>Carries <c>ModPrerequisiteData</c>, directly or via a pack.</summary>
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
	}

	/// <summary>
	/// The state of the game's toolbar filter row: themes, packs, and the two
	/// source toggles.
	/// </summary>
	/// <remarks>
	/// Published by the game as the UI bindings <c>toolbar.selectedThemes</c>,
	/// <c>toolbar.selectedAssetPacks</c>, <c>toolbar.vanillaSelected</c> and
	/// <c>toolbar.modsSelected</c>. The equivalent fields on ToolbarUISystem are
	/// private, so the bindings are the reachable route.
	/// </remarks>
	public readonly struct VanillaToolbarSelection
	{
		public IReadOnlyList<int> SelectedThemes { get; }
		public IReadOnlyList<int> SelectedPacks { get; }
		public bool VanillaSelected { get; }
		public bool ModsSelected { get; }

		public VanillaToolbarSelection(
			IReadOnlyList<int>? selectedThemes,
			IReadOnlyList<int>? selectedPacks,
			bool vanillaSelected,
			bool modsSelected)
		{
			SelectedThemes = selectedThemes ?? System.Array.Empty<int>();
			SelectedPacks = selectedPacks ?? System.Array.Empty<int>();
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
	/// A transcription of <c>ToolbarUISystem.FilterByThemes</c> and
	/// <c>FilterByPacks</c> (decompiled ToolbarUISystem.cs:1357 and :1422), which
	/// vanilla runs over every asset in <c>BindAssets</c> before drawing a menu.
	/// The lens replaced that menu and did not replace these, so the toolbar's
	/// EU/NA toggle — and the pack and Vanilla/Mods toggles beside it — changed
	/// the vanilla grid and did nothing to ours.
	///
	/// Kept as a pure function on plain lists so it can be tested against the
	/// decompiled rules directly, without a World, and so the transcription can
	/// be checked line by line against the original by anyone who doubts it.
	/// </remarks>
	public static class VanillaToolbarFilter
	{
		/// <summary>
		/// The theme half. An asset is hidden when it carries a theme
		/// requirement and none of the selected themes satisfies it.
		/// </summary>
		/// <remarks>
		/// Note the shape: a requirement list with no ThemeData at all leaves the
		/// asset visible whatever is selected, because it is not theme-gated.
		/// Vanilla expresses this with a flag that only turns on when it sees
		/// ThemeData and turns off again on a match.
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
