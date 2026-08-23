using FindItBuildingMenu.Utilities;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// cm-2xvs.26: the requirement that references nothing still names something.
	/// </summary>
	/// <remarks>
	/// Fixtures are the real prefab names, read out of the running game — all 21
	/// object-built requirements in Porterville 3 carry an empty m_LabelID, so
	/// the name is the only subject available.
	/// </remarks>
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
			// One naming convention observed, but it is a convention rather than
			// a contract, and a pack can add its own prefabs.
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
			// Silence beats a subjectless "build a", which is the reading that
			// made an earlier card say "build 1 +1".
			Assert.Equal("", ObjectBuiltRequirement.SubjectOf(prefabName));
		}
	}
}
