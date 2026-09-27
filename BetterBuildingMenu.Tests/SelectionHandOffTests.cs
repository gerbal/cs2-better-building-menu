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
			Assert.True(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: true, lensOpen: true, lensOwnsMenu: true));
		}

		[Fact]
		public void KeepsTheMenuOpenOverASelectionMadeBeforeItOpened()
		{
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: false, somethingSelected: true, lensOpen: true, lensOwnsMenu: true));
		}

		[Fact]
		public void KeepsTheMenuOpenWhenTheSelectionIsCleared()
		{
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: false, lensOpen: true, lensOwnsMenu: true));
		}

		[Fact]
		public void LeavesALensThatOwnsNoMenuAlone()
		{
			// No toolbar menu is selected, so the panel shows beside it already.
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: true, lensOpen: true, lensOwnsMenu: false));
		}

		[Fact]
		public void DoesNothingWhileTheLensIsClosed()
		{
			Assert.False(SelectionHandOff.ShouldCloseMenu(selectionChanged: true, somethingSelected: true, lensOpen: false, lensOwnsMenu: true));
		}
	}
}
