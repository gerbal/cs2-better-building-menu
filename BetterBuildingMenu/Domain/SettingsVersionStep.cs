namespace BetterBuildingMenu.Domain
{
	/// <summary>The settings file's format version, which a load raises to this release's.</summary>
	/// <remarks>See docs/design-notes.md, "The release marker and the settings version".</remarks>
	public static class SettingsVersionStep
	{
		public const int Current = 1;

		/// <summary>The version to store: one below this release's is raised, any other kept.</summary>
		/// <remarks>Kept rather than lowered, so a later release's version survives a return to this one.</remarks>
		public static int Next(int stored) => stored < Current ? Current : stored;
	}
}
