namespace BetterBuildingMenu.Tests
{
	/// <summary>The source reader the rule tests lean on.</summary>
	public sealed class ModSourceTests
	{
		[Fact]
		public void ABlockBodyEndsAtItsClosingBrace()
		{
			var source = "int A() { return 1; }\nint B() { return 2; }";

			Assert.Equal("int A() { return 1; }", ModSource.Member(source, "int A("));
		}

		[Fact]
		public void AnExpressionBodyEndsAtItsSemicolonNotAtTheNextMembersBrace()
		{
			var source = "int A() =>\n\tOne(\n\t\t2);\nint B() { return 3; }";

			Assert.Equal("int A() => One( 2);", ModSource.Member(source, "int A("));
		}
	}
}
