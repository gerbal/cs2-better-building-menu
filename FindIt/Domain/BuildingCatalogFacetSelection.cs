namespace FindItBuildingMenu.Domain
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
				"dlc" => query with { DlcIds = ToggleValue(query.DlcIds, normalizedOption), Offset = 0 },
				"theme" => query with { Themes = ToggleValue(query.Themes, normalizedOption), Offset = 0 },
				"assetpack" => query with { AssetPacks = ToggleValue(query.AssetPacks, normalizedOption), Offset = 0 },
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
				AssetPacks = null,
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
		/// The two states every asset is in, exactly one of them, always.
		/// </summary>
		public static class Availability
		{
			public const string Locked = "Locked";
			public const string Unlocked = "Unlocked";

			public static readonly string[] All = { Locked, Unlocked };
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
		/// So empty is presented as all-selected (see BuildFacetState), and this
		/// makes the arithmetic match the presentation: clicking one option when
		/// nothing is stored removes it rather than adding it, because what the
		/// player sees is both ticked and what they meant was "not that one".
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

			// The first click SELECTS what was clicked, like every other facet in
			// the rail. It used to subtract — clicking Locked meant "not locked"
			// — on the argument that an empty selection shows both, so both are
			// ticked and unticking one is the honest reading. That argument
			// needs the ticks to be visible, and the control renders a plain
			// two-row list with no selection marks at all: the player sees
			// "Locked" and clicks it to see locked assets, and the menu hides
			// them instead.
			//
			// Consistency is worth more than the arithmetic being clever. Click
			// to narrow to one, click again to go back to both, the same gesture
			// Role and Theme answer to.
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
