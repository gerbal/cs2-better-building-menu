using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Whether an asset is locked, the milestone that unlocks it, and what it still waits on.</summary>
	public readonly record struct LockState(bool IsLocked, int Milestone, string[] Requirements)
	{
		/// <remarks>The milestone is a permanent property of the asset and is kept whatever the lock
		/// state; the requirements answer "what is this waiting on", which an unlocked asset does not have.</remarks>
		public static LockState Of(bool isLocked, int milestone, string[] requirements) =>
			new(isLocked, milestone, isLocked ? requirements : Array.Empty<string>());
	}
}
