using BetterBuildingMenu.Domain.Enums;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What a zone's own data says about its density tier.</summary>
	/// <remarks>
	/// Primitive fields rather than the ECS components they come from, so the
	/// rules can be tested without a world. Every field is read from
	/// ZonePropertiesData except <see cref="MaxLotWidth"/>, which comes from
	/// the widest building the zone can actually grow.
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
	/// Probed against all 88 shipped zones on 2026-08-23; the raw output is in
	/// ../docs/archive/cs2-better-building-menu/superpowers/specs/2026-08-23-zone-density-probe-data.txt and the
	/// reasoning beside it. Two things that look like signals and are not:
	/// ZonePropertiesData.m_IgnoreLandValue is false on every zone in the game,
	/// and ZoneFlags has no low-rent bit — it is SupportNarrow, two corners and
	/// Office, and nothing else.
	///
	/// Order matters in both tests below. Mixed leads because a mixed zone also
	/// has a ratio and would otherwise be filed by it. Low Rent must beat the
	/// ratio derivation, which calls all five of those zones High.
	/// </remarks>
	public static class ZoneDensityClassifier
	{
		/// <summary>
		/// Residential properties per unit of space, at or above which a zone is
		/// low rent rather than merely high density.
		/// </summary>
		/// <remarks>
		/// The measured ratios are discrete — 0.5 row, 0.75 medium, 2.0 high,
		/// 2.5 high, 4.0 low rent — so this sits in the middle of a real gap
		/// rather than on a boundary. It is the mechanic, not a coincidence of
		/// the current content: low rent packs four properties into the space
		/// high density gives two.
		/// </remarks>
		private const float LowRentRatio = 3f;

		/// <summary>Name stems, longest-qualified first.</summary>
		/// <remarks>
		/// These are substring tests, so a stem that contains another must come
		/// first. "LowRent" contains "Low" and the old table put Low first, so
		/// every low-rent zone read as low density. "Medium Row" contains
		/// "Medium", so Row leads it.
		///
		/// Reachable only for a zone the data cannot speak for — every
		/// commercial and office zone, since their m_ResidentialProperties is
		/// zero — but the ordering still has to be right, or the fallback
		/// reintroduces the bug the data rule fixes.
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
				// Exact across all thirteen of them, with no false positives.
				if (facts.SellsGoods)
				{
					return ZoneTypeFilter.Mixed;
				}

				// The scale guard comes first, exactly as the existing
				// derivation orders it. Without it, UK Residential Low Terraced
				// — ratio 3.0, unscaled — is filed as low rent.
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
		/// The only source for commercial and office zones, whose
		/// m_ResidentialProperties is zero, so the ratio derivation is silent
		/// for them. Industrial and extractor zones carry no tier word and
		/// correctly come back Any.
		/// </remarks>
		public static ZoneTypeFilter FromName(string? prefabName)
		{
			if (string.IsNullOrWhiteSpace(prefabName))
			{
				return ZoneTypeFilter.Any;
			}

			foreach (var (stem, density) in NameStems)
			{
				if (prefabName!.IndexOf(stem, StringComparison.OrdinalIgnoreCase) >= 0)
				{
					return density;
				}
			}

			return ZoneTypeFilter.Any;
		}
	}
}
