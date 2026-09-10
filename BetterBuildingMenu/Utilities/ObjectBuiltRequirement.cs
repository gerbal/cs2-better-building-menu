using System;
using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// "Build a Subway Yard", out of a requirement that names nothing.
	/// </summary>
	/// <remarks>
	/// ObjectBuiltRequirementPrefab carries only a minimum count, so the subject
	/// has to come from the prefab's own name ("Subway Yard Built Req"). Vanilla
	/// reads that name too, in PrefabUISystem.BindOnBuildRequirement.
	/// </remarks>
	public static class ObjectBuiltRequirement
	{
		/// <summary>The bookkeeping suffix these prefabs are named with.</summary>
		private static readonly Regex Suffix =
			new Regex(@"\s*(built\s*)?req(uirement)?\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

		/// <summary>
		/// The thing to build, or empty when the name says nothing useful.
		/// </summary>
		public static string SubjectOf(string? prefabName)
		{
			var trimmed = (prefabName ?? string.Empty).Trim();

			if (trimmed.Length == 0)
			{
				return string.Empty;
			}

			var subject = Suffix.Replace(trimmed, string.Empty).Trim();

			// A name that is ONLY bookkeeping leaves nothing behind: the empty
			// string, rather than a subjectless "Build a".
			return subject;
		}
	}
}
