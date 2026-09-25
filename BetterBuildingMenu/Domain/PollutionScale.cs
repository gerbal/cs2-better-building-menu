namespace BetterBuildingMenu.Domain
{
	/// <summary>The thresholds one kind of pollution is graded by, from the game's
	/// <c>UIPollutionConfigurationPrefab</c>.</summary>
	public readonly record struct PollutionThresholds(int Low, int Medium, int High)
	{
		/// <summary>The level a figure falls in: "None", "Low", "Medium" or "High".</summary>
		/// <remarks>PollutionUIUtils.GetPollutionKey, transcribed: a figure has to pass a threshold,
		/// so one exactly on it stays in the level below.</remarks>
		public string LevelOf(float pollution) =>
			pollution > High ? "High"
				: pollution > Medium ? "Medium"
				: pollution > Low ? "Low"
				: "None";
	}

	/// <summary>The thresholds for each kind of pollution a building gives off.</summary>
	/// <remarks>Settings, not a fact about a building: the indexer reads them once a pass and hands
	/// them to every prefab's snapshot.</remarks>
	public sealed record PollutionScale(PollutionThresholds Ground, PollutionThresholds Air, PollutionThresholds Noise);
}
