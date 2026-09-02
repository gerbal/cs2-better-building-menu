namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Pure state transitions for the Lens facet selection. Keeping this outside
	/// the UI system makes trigger behavior deterministic and easy to exercise
	/// without a running world.
	/// </summary>
	public static class BuildingCatalogFacetSelection
	{
		public static BuildingCatalogQuery Toggle(
			BuildingCatalogQuery query,
			string facetId,
			string optionId)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			if (string.IsNullOrWhiteSpace(facetId) || string.IsNullOrWhiteSpace(optionId))
			{
				return query;
			}

			string normalizedOption = optionId.Trim();
			return facetId.Trim().ToLowerInvariant() switch
			{
				"buildingtype" => query with { BuildingTypes = ToggleValue(query.BuildingTypes, normalizedOption), Offset = 0 },
				"provenance" => query with { Provenance = ToggleValue(query.Provenance, normalizedOption), Offset = 0 },
				"availability" => query with { Availability = ToggleExhaustive(query.Availability, normalizedOption, Availability.All), Offset = 0 },
				// The Content facet's DLC half. Its pack and base-game options
				// never reach here — the rail sends those to the game's own
				// triggers, because the game owns that state. See ContentOption.
				"content" or "dlc" => ContentOption.DlcIdOf(normalizedOption) is { Length: > 0 } dlc
					? query with { DlcIds = ToggleValue(query.DlcIds, dlc), Offset = 0 }
					: query,
				"theme" => query with { Themes = ToggleValue(query.Themes, normalizedOption), Offset = 0 },
				// "assetpack" is deliberately absent. Packs are the GAME's
				// selection now — the rail writes them through
				// toolbar.setSelectedAssetPacks and they filter through
				// VanillaToolbarFilter, so there is no field here to toggle.
				// See AddAssetPackGroup.
				"placement" => query with { PlacementFlags = ToggleValue(query.PlacementFlags, normalizedOption), Offset = 0 },
				"extension" or "extensions" => query with { Extensions = ToggleValue(query.Extensions, normalizedOption), Offset = 0 },
				"zone" or "zonetype" => query with { ZoneTypes = ToggleValue(query.ZoneTypes, normalizedOption), Offset = 0 },
				_ => query,
			};
		}

		public static BuildingCatalogQuery Clear(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			return query with
			{
				BuildingTypes = null,
				Provenance = null,
				Availability = null,
				DlcIds = null,
				Themes = null,
				PlacementFlags = null,
				ZoneTypes = null,
				Extensions = null,
				// StripTabs is deliberately absent. It is the top bar's
				// selection, which is navigation like UiCategory beside it —
				// and Clear leaves that alone too. It was cleared here only
				// while the rail also offered the axis as a filter; the menu
				// reset is what drops a strip tab now.
				Offset = 0,
			};
		}

		/// <summary>
		/// The three states every asset is in, exactly one of them, always.
		/// </summary>
		/// <remarks>
		/// Still a partition, which is what lets the toggle stay exhaustive.
		/// AlreadyBuilt SUPERSEDES Unlocked rather than sitting beside it: a
		/// unique you have built is unlocked in the progression sense and
		/// unbuildable in the only sense the player cares about, and reporting
		/// it as Unlocked put it in the list of things to build.
		///
		/// Ordered the way the player meets them — cannot build yet, can build,
		/// already did.
		/// </remarks>
		public static class Availability
		{
			public const string Locked = "Locked";
			public const string Unlocked = "Unlocked";

			/// <summary>A unique asset the city already holds one of.</summary>
			public const string AlreadyBuilt = "AlreadyBuilt";

			/// <remarks>
			/// Ordered the way the player meets them, and the order the control
			/// draws: what you can build now, what you cannot build yet, what
			/// you have already built. The stored order is the drawn order —
			/// there is no second list to keep in step.
			/// </remarks>
			public static readonly string[] All = { Unlocked, Locked, AlreadyBuilt };
		}

		/// <summary>
		/// Toggling within a dimension whose options are exhaustive.
		/// </summary>
		/// <remarks>
		/// Availability is not like the other facets. Role, Theme and packs are
		/// open-ended sets where an empty selection honestly means "I have not
		/// picked any". Locked/Unlocked covers every asset with no remainder, so
		/// an empty selection means "showing BOTH" — and the rail drew that as
		/// two unticked boxes, which reads as "no filter" rather than as the
		/// state it is.
		///
		/// So empty is presented as all-selected, and this makes the arithmetic
		/// match the presentation: clicking one option when nothing is stored
		/// removes it rather than adding it, because what the player sees is
		/// every state lit and what they meant was "not that one".
		///
		/// Selecting everything again collapses back to null, so there is one
		/// representation of "both" rather than two that behave alike and
		/// compare differently.
		///
		/// Deselecting the last remaining option would mean showing nothing at
		/// all, which no player wants and the engine reads as "show everything"
		/// anyway. It returns to both, so the control cannot be driven into an
		/// empty result.
		/// </remarks>
		private static IReadOnlyList<string>? ToggleExhaustive(
			IReadOnlyList<string>? values,
			string option,
			IReadOnlyList<string> all)
		{
			bool known = all.Any(value => string.Equals(value, option, StringComparison.OrdinalIgnoreCase));
			if (!known)
			{
				return values;
			}

			// From the resting state, a click NARROWS TO what was clicked
			// rather than removing it: every state is showing, and the player
			// who touches this control almost always wants one of them —
			// usually "just the ones I can build". One click, not two.
			//
			// This has been flipped twice, so the reasoning is worth keeping.
			// It subtracted originally; that was abandoned because the rail
			// drew the facet as a plain list with no selection marks, so
			// clicking "Locked" looked like a request to SEE locked assets and
			// the menu hid them. The control has since moved into the game's
			// tool-options panel with vanilla's selected fill (cm-2xvs.15), and
			// I briefly took that as licence to subtract again — but the ticks
			// were only half the problem. The other half is that subtracting
			// makes the common case cost three clicks instead of one, and it
			// disagrees with the Theme row sitting directly above it.
			//
			// So: presentation says "everything is showing", and the gesture is
			// "show me this one". Clicking again returns to everything, which
			// is the collapse below.
			List<string> next = values is null || values.Count == 0
				? new List<string> { option }
				: ToggleValue(values, option)?.ToList() ?? new List<string>();

			// Both ends of the range collapse to null: everything selected and
			// nothing selected are the same visible result, and the engine
			// already treats them identically.
			if (next.Count == 0 || next.Count >= all.Count)
			{
				return null;
			}

			return next.ToArray();
		}

		private static IReadOnlyList<string>? ToggleValue(
			IReadOnlyList<string>? values,
			string option)
		{
			var next = values?.ToList() ?? new List<string>();
			int existing = next.FindIndex(value => string.Equals(value, option, StringComparison.OrdinalIgnoreCase));
			if (existing >= 0)
			{
				next.RemoveAll(value => string.Equals(value, option, StringComparison.OrdinalIgnoreCase));
			}
			else
			{
				next.Add(option);
			}

			return next.Count == 0 ? null : next.ToArray();
		}
	}
}
