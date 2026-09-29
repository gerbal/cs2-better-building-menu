using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class SelectionHandOffTests
	{
		[Fact]
		public void ClosesTheMenuWhenTheMapSelectsSomethingNew()
		{
			// The game hides the selected-info panel while a toolbar menu is selected.
			Assert.True(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: true, assetMenuOpen: true, ownsMenu: true));
		}

		[Fact]
		public void KeepsTheMenuOpenOverASelectionMadeBeforeItOpened()
		{
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: false, somethingSelected: true, assetMenuOpen: true, ownsMenu: true));
		}

		[Fact]
		public void KeepsTheMenuOpenWhenTheSelectionIsCleared()
		{
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: false, assetMenuOpen: true, ownsMenu: true));
		}

		[Fact]
		public void LeavesAnAssetMenuThatOwnsNoMenuAlone()
		{
			// No toolbar menu is selected, so the panel shows beside it already.
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: true, assetMenuOpen: true, ownsMenu: false));
		}

		[Fact]
		public void DoesNothingWhileTheAssetMenuIsClosed()
		{
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: true, assetMenuOpen: false, ownsMenu: true));
		}
	}
}
