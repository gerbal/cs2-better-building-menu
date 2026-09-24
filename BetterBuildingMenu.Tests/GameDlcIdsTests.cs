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
			Assert.Equal(GameDlcIds.Invalid, DlcId.Invalid.id);
			Assert.Equal(GameDlcIds.BaseGame, DlcId.BaseGame.id);
		}
	}
}
