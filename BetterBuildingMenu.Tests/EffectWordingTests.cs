using BetterBuildingMenu.Domain;

using Colossal.Mathematics;

using Game.Buildings;
using Game.City;
using Game.Prefabs;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// An effect line as vanilla's modifier binders word it: ModifierUIUtils' arithmetic, and the
	/// unit CityModifierBinder.GetModifierUnit picks.
	/// </summary>
	public sealed class EffectWordingTests
	{
		[Theory]
		[InlineData(ModifierValueMode.Relative, 0.125f, true, "Crime Probability +13%")]
		[InlineData(ModifierValueMode.Relative, -0.2f, true, "Crime Probability -20%")]
		// 100 × (1 / (1 + 0.25) − 1) is −20.
		[InlineData(ModifierValueMode.InverseRelative, 0.25f, true, "Crime Probability -20%")]
		[InlineData(ModifierValueMode.Absolute, 5f, true, "Crime Probability +5%")]
		[InlineData(ModifierValueMode.Absolute, 1.24f, false, "Crime Probability +1.2")]
		public void AnEffectIsSignedInVanillasUnit(ModifierValueMode mode, float value, bool percent, string expected)
		{
			Assert.Equal(expected, EffectWording.Describe("CrimeProbability", mode, value, percent));
		}

		[Theory]
		[InlineData(ModifierValueMode.Relative, 0.004f, true)]
		[InlineData(ModifierValueMode.Relative, -0.004f, true)]
		[InlineData(ModifierValueMode.Absolute, 0f, false)]
		public void AnEffectThatRoundsToNothingSaysNothing(ModifierValueMode mode, float value, bool percent)
		{
			Assert.Equal(string.Empty, EffectWording.Describe("CrimeProbability", mode, value, percent));
		}

		/// <summary>floatSingleFraction, as the game's UI draws it: a small effect never rounds
		/// away, and a large one drops its decimal.</summary>
		[Theory]
		[InlineData(0.04f, "Crime Probability +0.1")]
		[InlineData(-0.04f, "Crime Probability -0.1")]
		[InlineData(0.14f, "Crime Probability +0.1")]
		[InlineData(99.44f, "Crime Probability +99.4")]
		[InlineData(150.44f, "Crime Probability +150")]
		[InlineData(-250.6f, "Crime Probability -251")]
		public void AOneDecimalEffectReadsAsTheGameDrawsIt(float value, string expected)
		{
			Assert.Equal(expected, EffectWording.Describe("CrimeProbability", ModifierValueMode.Absolute, value, percent: false));
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

		[Fact]
		public void ABuildingsEffectsAreItsCityOnesThenItsLocalOnes()
		{
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.CrimeAccumulation, ModifierValueMode.Relative, -0.1f) },
				new[] { Local(LocalModifierType.CrimeAccumulation, ModifierValueMode.Relative, -0.2f) });

			Assert.Equal(new[] { "Crime Accumulation -10%", "Crime Accumulation -20%" }, lines);
		}

		[Fact]
		public void ACityEffectVanillaShowsAsAPercentageIsOneHereToo()
		{
			// Absolute, but in CityModifierBinder.GetModifierUnit's percentage list.
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.HospitalEfficiency, ModifierValueMode.Absolute, 10f) },
				null);

			Assert.Equal(new[] { "Hospital Efficiency +10%" }, lines);
		}

		[Fact]
		public void TheEffectVanillaHidesIsHiddenHereToo()
		{
			var lines = EffectWording.Lines(
				new[] { City(CityModifierType.CriminalMonitorProbability, ModifierValueMode.Relative, 0.5f) },
				null);

			Assert.Empty(lines);
		}

		[Fact]
		public void AnEffectThatRoundsToNothingDrawsNoLineAndARepeatDrawsOne()
		{
			var lines = EffectWording.Lines(
				null,
				new[]
				{
					// 0.4 %, which the whole-number percentage rounds to 0.
					Local(LocalModifierType.Health, ModifierValueMode.Relative, 0.004f),
					Local(LocalModifierType.Wellbeing, ModifierValueMode.Absolute, 5f),
					Local(LocalModifierType.Wellbeing, ModifierValueMode.Absolute, 5f),
				});

			Assert.Equal(new[] { "Wellbeing +5" }, lines);
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

			Assert.Equal(new[] { "Attractiveness +20", "Wellbeing +3", "Health +1.5" }, lines);
		}
	}
}
