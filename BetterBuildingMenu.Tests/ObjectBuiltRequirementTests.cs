using BetterBuildingMenu.Utilities;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The requirement that references nothing still names something: an
	/// object-built requirement carries an empty m_LabelID, so its prefab name is
	/// the only subject available.
	/// </summary>
	public sealed class ObjectBuiltRequirementTests
	{
		[Theory]
		[InlineData("Subway Yard Built Req", "Subway Yard")]
		[InlineData("Bus Depot Built Req", "Bus Depot")]
		[InlineData("Tram Track Built Req", "Tram Track")]
		[InlineData("Crematorium Built Req", "Crematorium")]
		[InlineData("Cargo Airplane Terminal Built Req", "Cargo Airplane Terminal")]
		public void TakesTheSubjectOutOfTheRealNames(string prefabName, string expected)
		{
			Assert.Equal(expected, ObjectBuiltRequirement.SubjectOf(prefabName));
		}

		[Theory]
		[InlineData("Rail Yard Requirement", "Rail Yard")]
		[InlineData("Rail Yard Req", "Rail Yard")]
		[InlineData("Rail Yard BuiltReq", "Rail Yard")]
		[InlineData("  Rail Yard Built Req  ", "Rail Yard")]
		public void ToleratesTheSuffixBeingWrittenSeveralWays(string prefabName, string expected)
		{
			// The suffix is a convention rather than a contract, and a pack can add
			// its own prefabs.
			Assert.Equal(expected, ObjectBuiltRequirement.SubjectOf(prefabName));
		}

		[Fact]
		public void KeepsANameThatCarriesNoSuffix()
		{
			// Nothing to strip is not a failure: the whole name is the subject.
			Assert.Equal("Subway Yard", ObjectBuiltRequirement.SubjectOf("Subway Yard"));
		}

		[Theory]
		[InlineData("Built Req")]
		[InlineData("Requirement")]
		[InlineData("   ")]
		[InlineData("")]
		[InlineData(null)]
		public void SaysNothingWhenTheNameWasOnlyBookkeeping(string? prefabName)
		{
			// Silence beats a subjectless "build a" on the card.
			Assert.Equal("", ObjectBuiltRequirement.SubjectOf(prefabName));
		}
	}
}
