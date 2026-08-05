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
				"dlc" => query with { DlcIds = ToggleValue(query.DlcIds, normalizedOption), Offset = 0 },
				"theme" => query with { Themes = ToggleValue(query.Themes, normalizedOption), Offset = 0 },
				"assetpack" => query with { AssetPacks = ToggleValue(query.AssetPacks, normalizedOption), Offset = 0 },
				"placement" => query with { PlacementFlags = ToggleValue(query.PlacementFlags, normalizedOption), Offset = 0 },
				"extension" or "extensions" => query with { Extensions = ToggleValue(query.Extensions, normalizedOption), Offset = 0 },
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
				DlcIds = null,
				Themes = null,
				AssetPacks = null,
				PlacementFlags = null,
				Extensions = null,
				Offset = 0,
			};
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
