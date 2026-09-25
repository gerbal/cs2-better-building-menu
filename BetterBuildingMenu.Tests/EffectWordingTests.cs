using BetterBuildingMenu.Domain;

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
	}
}
