using BetterBuildingMenu.Domain.Enums;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What a zone's own data says about its density tier.</summary>
	/// <remarks>
	/// Primitive fields rather than the ECS components they come from, so the rules
	/// can be tested without a world. Every field is read from ZonePropertiesData
	/// except <see cref="MaxLotWidth"/>, which is the widest building the zone grows.
	/// </remarks>
	public sealed record ZoneDensityFacts(
		bool IsResidential,
		float ResidentialProperties,
		float SpaceMultiplier,
		bool ScaleResidentials,
		bool SellsGoods,
		int MaxLotWidth,
		string PrefabName);

	/// <summary>
	/// The density tier a zone belongs to, from the game's own data.
	/// </summary>
	/// <remarks>
	/// Order matters in both tests below. Mixed leads because a mixed zone also has
	/// a ratio and would otherwise be filed by it; Low Rent must beat the ratio
	/// derivation, which calls those zones High.
	/// </remarks>
	public static class ZoneDensityClassifier
	{
		/// <summary>
		/// Residential properties per unit of space, at or above which a zone is
		/// low rent rather than merely high density.
		/// </summary>
		/// <remarks>
		/// The mechanic, not a coincidence of the current content: a low-rent zone packs
		/// markedly more properties into the space a high-density one gives, so the
		/// threshold sits in a wide gap rather than on a boundary.
		/// </remarks>
		private const float LowRentRatio = 3f;

		/// <summary>Name stems, longest-qualified first.</summary>
		/// <remarks>
		/// Substring tests, so a stem that contains another leads it: "LowRent" contains
		/// "Low", "Medium Row" contains "Medium". Reached only for zones the data cannot
		/// speak for — commercial and office, whose residential count is zero.
		/// </remarks>
		private static readonly (string Stem, ZoneTypeFilter Density)[] NameStems =
		{
			("LowRent", ZoneTypeFilter.LowRent),
			("Low Rent", ZoneTypeFilter.LowRent),
			("Mixed", ZoneTypeFilter.Mixed),
			("Row", ZoneTypeFilter.Row),
			("Low", ZoneTypeFilter.Low),
			("Medium", ZoneTypeFilter.Medium),
			("High", ZoneTypeFilter.High),
		};

		public static ZoneTypeFilter Classify(ZoneDensityFacts facts)
		{
			if (facts is null)
			{
				throw new ArgumentNullException(nameof(facts));
			}

			if (facts.IsResidential && facts.ResidentialProperties > 0f && facts.SpaceMultiplier > 0f)
			{
				// Residential AND selling goods is the game's mixed-use zone.
				if (facts.SellsGoods)
				{
					return ZoneTypeFilter.Mixed;
				}

				// The scale guard comes first: an unscaled zone can reach the low-rent
				// ratio without being low rent.
				if (!facts.ScaleResidentials)
				{
					return ZoneTypeFilter.Low;
				}

				var ratio = facts.ResidentialProperties / facts.SpaceMultiplier;

				if (ratio >= LowRentRatio)
				{
					return ZoneTypeFilter.LowRent;
				}

				if (ratio < 1f)
				{
					// "No spawnable building wider than 2" is exactly "the
					// widest is at most 2". A zone with none at all stays row.
					return facts.MaxLotWidth <= 2 ? ZoneTypeFilter.Row : ZoneTypeFilter.Medium;
				}

				return ZoneTypeFilter.High;
			}

			return FromName(facts.PrefabName);
		}

		/// <summary>The tier a zone's name carries, or Any for none.</summary>
		/// <remarks>
		/// The only source for commercial and office zones, whose residential count is
		/// zero, so the ratio derivation is silent for them. Industrial and extractor
		/// zones carry no tier word and correctly come back Any.
		/// </remarks>
		public static ZoneTypeFilter FromName(string? prefabName)
		{
			if (prefabName?.Trim() is not { Length: > 0 })
			{
				return ZoneTypeFilter.Any;
			}

			foreach (var (stem, density) in NameStems)
			{
				if (prefabName.IndexOf(stem, StringComparison.OrdinalIgnoreCase) >= 0)
				{
					return density;
				}
			}

			return ZoneTypeFilter.Any;
		}
	}
}
