namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Pure state transitions for the asset menu facet selection. Outside the UI system, so trigger
	/// behaviour is deterministic and can be exercised without a running world.
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
				// "assetpack" is deliberately absent. Packs are the GAME's selection: the
				// rail writes them through toolbar.setSelectedAssetPacks and they filter
				// through VanillaToolbarFilter, so there is no field here to toggle.
				"placement" => query with { PlacementFlags = ToggleValue(query.PlacementFlags, normalizedOption), Offset = 0 },
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
				// StripTabs is deliberately absent. It is the top bar's selection, which is
				// navigation like UiCategory beside it, and the menu reset is what drops it.
				Offset = 0,
			};
		}

		/// <summary>
		/// The three states every asset is in, exactly one of them, always.
		/// </summary>
		/// <remarks>
		/// A partition, which is what lets the toggle stay exhaustive. AlreadyBuilt SUPERSEDES
		/// Unlocked: a unique you have built is unlocked in the progression sense and unbuildable
		/// in the only sense the player cares about.
		/// </remarks>
		public static class Availability
		{
			public const string Locked = "Locked";
			public const string Unlocked = "Unlocked";

			/// <summary>A unique asset the city already holds one of.</summary>
			public const string AlreadyBuilt = "AlreadyBuilt";

			/// <remarks>
			/// Ordered the way the player meets them, and the order the control draws: what you can
			/// build now, what you cannot build yet, what you have already built. The stored order is
			/// the drawn order — there is no second list to keep in step. The UI's copy of the
			/// options is generated from this.
			/// </remarks>
			public static readonly IReadOnlyList<string> All = new[] { Unlocked, Locked, AlreadyBuilt };
		}

		/// <summary>
		/// Toggling within a dimension whose options are exhaustive.
		/// </summary>
		/// <remarks>
		/// Availability is exhaustive where Role and Theme are open-ended: it covers every asset
		/// with no remainder, so an empty selection means "showing them all" and is presented as
		/// all-selected. Selecting everything collapses back to null, so "all" has one form.
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

			// From the resting state, a click NARROWS TO what was clicked rather than removing
			// it: every state is showing, the player who touches this control wants one of them,
			// and the Theme row directly above behaves the same way. Clicking again returns to all.
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
