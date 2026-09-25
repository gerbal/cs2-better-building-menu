using BetterBuildingMenu.Domain;

using Colossal.Mathematics;

using Game.Buildings;
using Game.City;
using Game.Prefabs;

using System;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// A building's effects as vanilla's modifier binders bind them: ModifierUIUtils' arithmetic,
	/// and the unit CityModifierBinder.GetModifierUnit picks.
	/// </summary>
	public sealed class EffectWordingTests
	{
		private const string Percent = EffectLine.Percentage;
		private const string OneDecimal = EffectLine.FloatSingleFraction;

		[Theory]
		[InlineData(ModifierValueMode.Relative, 0.125f, true, 12.5f, Percent)]
		[InlineData(ModifierValueMode.Relative, -0.2f, true, -20f, Percent)]
		// 100 × (1 / (1 + 0.25) − 1) is −20.
		[InlineData(ModifierValueMode.InverseRelative, 0.25f, true, -20f, Percent)]
		[InlineData(ModifierValueMode.Absolute, 5f, true, 5f, Percent)]
		[InlineData(ModifierValueMode.Absolute, 1.24f, false, 1.24f, OneDecimal)]
		public void AnEffectIsVanillasDeltaInVanillasUnit(ModifierValueMode mode, float value, bool percent, float delta, string unit)
		{
			var line = EffectWording.Describe("CrimeProbability", mode, value, percent);

			Assert.Equal("Crime Probability", line.Label);
			Assert.Equal(delta, line.Delta, 4);
			Assert.Equal(unit, line.Unit);
		}

		/// <summary>The delta goes to the UI unrounded, as vanilla binds it: the unit's rounding is
		/// the game's number format's to apply.</summary>
		[Fact]
		public void TheDeltaIsNotRoundedHere()
		{
			Assert.Equal(0.4f, EffectWording.Describe("Health", ModifierValueMode.Relative, 0.004f, percent: true).Delta, 4);
			Assert.Equal(0.04f, EffectWording.Describe("Health", ModifierValueMode.Absolute, 0.04f, percent: false).Delta, 4);
		}

		[Fact]
		public void TheAbsoluteCityEffectsVanillaNamesArePercentages()
		{
			Assert.True(EffectWording.IsPercent(CityModifierType.CollegeGraduation, ModifierValueMode.Absolute));
			Assert.True(EffectWording.IsPercent(CityModifierType.IndustrialFishHubEfficiency, ModifierValueMode.Absolute));
			Assert.False(EffectWording.IsPercent(CityModifierType.CrimeProbability, ModifierValueMode.Absolute));
			Assert.True(EffectWording.IsPercent(CityModifierType.CrimeProbability, ModifierValueMode.Relative));
			Assert.False(EffectWording.IsPercent(ModifierValueMode.Absolute));
			Assert.True(EffectWording.IsPercent(ModifierValueMode.InverseRelative));
		}

		// Initialisers, not the game's constructors, so these run against mock assemblies too.
		private static CityModifierData City(CityModifierType type, ModifierValueMode mode, float max) =>
			new() { m_Type = type, m_Mode = mode, m_Range = new Bounds1 { min = 0f, max = max } };

		private static LocalModifierData Local(LocalModifierType type, ModifierValueMode mode, float max) =>
			new() { m_Type = type, m_Mode = mode, m_Delta = new Bounds1 { min = 0f, max = max } };

		// The delta rounded to what the assertions state, so a float's last bits cannot fail them.
		private static (string Label, float Delta, string Unit)[] Shapes(EffectLine[] lines) =>
			lines.Select(line => (line.Label, (float)Math.Round(line.Delta, 3), line.Unit)).ToArray();

		[Fact]
		public void ABuildingsEffectsAreItsCityOnesThenItsLocalOnes()
		{
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.CrimeAccumulation, ModifierValueMode.Relative, -0.1f) },
				new[] { Local(LocalModifierType.CrimeAccumulation, ModifierValueMode.Relative, -0.2f) });

			Assert.Equal(new[] { ("Crime Accumulation", -10f, Percent), ("Crime Accumulation", -20f, Percent) }, Shapes(lines));
		}

		[Fact]
		public void ACityEffectVanillaShowsAsAPercentageIsOneHereToo()
		{
			// Absolute, but in CityModifierBinder.GetModifierUnit's percentage list.
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.HospitalEfficiency, ModifierValueMode.Absolute, 10f) },
				null);

			Assert.Equal(new[] { ("Hospital Efficiency", 10f, Percent) }, Shapes(lines));
		}

		[Fact]
		public void TheEffectVanillaHidesIsHiddenHereToo()
		{
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.CriminalMonitorProbability, ModifierValueMode.Relative, 0.5f) },
				null);

			Assert.Empty(lines);
		}

		/// <summary>Vanilla binds every effect: one that rounds to nothing, a zero and a repeat
		/// each draw a line.</summary>
		[Fact]
		public void EveryEffectDrawsALineAZeroAndARepeatIncluded()
		{
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.Attractiveness, ModifierValueMode.Absolute, 0f) },
				new[]
				{
					// 0.4 %, which the whole-number percentage rounds to 0.
					Local(LocalModifierType.Health, ModifierValueMode.Relative, 0.004f),
					Local(LocalModifierType.Wellbeing, ModifierValueMode.Absolute, 5f),
					Local(LocalModifierType.Wellbeing, ModifierValueMode.Absolute, 5f),
				});

			Assert.Equal(
				new[]
				{
					("Attractiveness", 0f, OneDecimal),
					("Health", 0.4f, Percent),
					("Wellbeing", 5f, OneDecimal),
					("Wellbeing", 5f, OneDecimal),
				},
				Shapes(lines));
		}

		[Fact]
		public void ABuildingWithNeitherBufferHasNoEffects()
		{
			Assert.Empty(EffectWording.Lines(null, null));
		}

		/// <summary>A park: attractiveness for the city, wellbeing and health nearby.</summary>
		[Fact]
		public void GoldenPark()
		{
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.Attractiveness, ModifierValueMode.Absolute, 20f) },
				new[]
				{
					Local(LocalModifierType.Wellbeing, ModifierValueMode.Absolute, 3f),
					Local(LocalModifierType.Health, ModifierValueMode.Absolute, 1.5f),
				});

			Assert.Equal(
				new[] { ("Attractiveness", 20f, OneDecimal), ("Wellbeing", 3f, OneDecimal), ("Health", 1.5f, OneDecimal) },
				Shapes(lines));
		}
	}
}
