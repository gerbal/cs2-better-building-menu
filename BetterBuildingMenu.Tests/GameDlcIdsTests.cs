using BetterBuildingMenu.Domain;

using Colossal.PSI.Common;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class GameDlcIdsTests
	{
		[Fact, Trait("Requires", "Game")]
		public void MatchTheGamesDlcIds()
		{
			Assert.Equal(DlcId.Invalid.id, GameDlcIds.Invalid);
			Assert.Equal(DlcId.BaseGame.id, GameDlcIds.BaseGame);
		}
	}
}
