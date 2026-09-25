using Game.City;
using Game.Prefabs;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A building's effects, as vanilla's CityModifierBinder and LocalModifierBinder bind them.
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

		/// <summary>What a building does for the city, one line per effect: its city effects, then
		/// its local ones.</summary>
		/// <remarks>Both buffers the game applies, with m_Range.max and m_Delta.max, the figures
		/// vanilla binds. As vanilla binds them: every effect, a zero or a repeat included, but for
		/// CriminalMonitorProbability, which vanilla leaves out of its own effect list.</remarks>
		public static EffectLine[] Lines(IReadOnlyList<CityModifierData>? city, IReadOnlyList<LocalModifierData>? local)
		{
			var lines = new List<EffectLine>();

			if (city is not null)
			{
				foreach (var modifier in city)
				{
					// Vanilla hides this one from its own effect list, so a card that showed it
					// would be inventing an effect the game does not acknowledge.
					if (modifier.m_Type == CityModifierType.CriminalMonitorProbability)
					{
						continue;
					}

					lines.Add(Describe(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Range.max,
						IsPercent(modifier.m_Type, modifier.m_Mode)));
				}
			}

			if (local is not null)
			{
				foreach (var modifier in local)
				{
					lines.Add(Describe(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Delta.max,
						IsPercent(modifier.m_Mode)));
				}
			}

			return lines.ToArray();
		}

		/// <summary>Whether vanilla shows a city effect as a percentage.</summary>
		public static bool IsPercent(CityModifierType type, ModifierValueMode mode) =>
			mode != ModifierValueMode.Absolute || AbsolutePercent.Contains(type);

		/// <summary>Whether vanilla shows a local effect as a percentage.</summary>
		public static bool IsPercent(ModifierValueMode mode) => mode != ModifierValueMode.Absolute;

		/// <summary>One effect: its type in words, the delta vanilla binds, and its unit.</summary>
		public static EffectLine Describe(string type, ModifierValueMode mode, float value, bool percent) =>
			new(type.FormatWords(), Delta(mode, value), percent ? EffectLine.Percentage : EffectLine.FloatSingleFraction);

		/// <summary>ModifierUIUtils.GetModifierDelta's arithmetic: a relative modifier as a
		/// percentage change, an inverse one as the change it makes to what it divides.</summary>
		public static float Delta(ModifierValueMode mode, float value) => mode switch
		{
			ModifierValueMode.Relative => 100f * value,
			ModifierValueMode.InverseRelative => 100f * (1f / Math.Max(0.001f, 1f + value) - 1f),
			_ => value,
		};
	}
}
