using Game.City;
using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Globalization;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One effect line, as vanilla's CityModifierBinder and LocalModifierBinder bind it: the
	/// signed delta, in a percentage or to one decimal.
	/// </summary>
	public static class EffectWording
	{
		/// <summary>The city effects CityModifierBinder.GetModifierUnit shows as a percentage even
		/// when their value is absolute.</summary>
		private static readonly HashSet<CityModifierType> AbsolutePercent = new()
		{
			CityModifierType.DiseaseProbability,
			CityModifierType.OfficeSoftwareEfficiency,
			CityModifierType.IndustrialElectronicsEfficiency,
			CityModifierType.CollegeGraduation,
			CityModifierType.UniversityGraduation,
			CityModifierType.IndustrialEfficiency,
			CityModifierType.OfficeEfficiency,
			CityModifierType.HospitalEfficiency,
			CityModifierType.IndustrialFishInputEfficiency,
			CityModifierType.IndustrialFishHubEfficiency,
		};

		/// <summary>Whether vanilla shows a city effect as a percentage.</summary>
		public static bool IsPercent(CityModifierType type, ModifierValueMode mode) =>
			mode != ModifierValueMode.Absolute || AbsolutePercent.Contains(type);

		/// <summary>Whether vanilla shows a local effect as a percentage.</summary>
		public static bool IsPercent(ModifierValueMode mode) => mode != ModifierValueMode.Absolute;

		/// <summary>The line for one effect, or empty when it rounds to nothing.</summary>
		/// <remarks>ModifierUIUtils.GetModifierDelta's arithmetic. The game's percentage unit is a
		/// whole number, and floatSingleFraction one decimal (see <see cref="SingleFraction"/>).
		/// Invariant, as the card's other words are.</remarks>
		public static string Describe(string type, ModifierValueMode mode, float value, bool percent)
		{
			var scaled = mode switch
			{
				ModifierValueMode.Relative => 100f * value,
				ModifierValueMode.InverseRelative => 100f * (1f / Math.Max(0.001f, 1f + value) - 1f),
				_ => value,
			};

			var number = percent ? scaled.ToString("0", CultureInfo.InvariantCulture) : SingleFraction(scaled);

			// What rounds to nothing says nothing, whichever sign it rounded from.
			if (number is "0" or "-0")
			{
				return string.Empty;
			}

			// The sign is the point: a modifier can make something worse, and an
			// unsigned number would read as a benefit either way.
			var sign = scaled > 0 ? "+" : string.Empty;

			return $"{type.FormatWords()} {sign}{number}{(percent ? "%" : string.Empty)}";
		}

		/// <summary>A figure as the game's floatSingleFraction unit draws it.</summary>
		/// <remarks>One decimal, but a whole number from 100 up, and never less than 0.1 for a
		/// figure that is not zero, so a small effect still reads as one.</remarks>
		internal static string SingleFraction(float value)
		{
			var magnitude = Math.Abs(value);

			if (magnitude >= 100f)
			{
				return value.ToString("0", CultureInfo.InvariantCulture);
			}

			if (magnitude > 0f && magnitude < 0.1f)
			{
				value = Math.Sign(value) * 0.1f;
			}

			return value.ToString("0.#", CultureInfo.InvariantCulture);
		}
	}
}
