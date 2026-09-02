using System;
using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// "Build a Subway Yard", out of a requirement that names nothing.
	/// </summary>
	/// <remarks>
	/// Reported by the user: buildings gated on placing a subway depot said
	/// nothing at all, so the tile read locked with no reachable reason.
	///
	/// Two earlier attempts missed it. ObjectBuiltRequirementPrefab carries
	/// m_MinimumCount and no reference, so there is nothing to resolve — that
	/// much was right, and returning silence rather than a subjectless "build 1"
	/// was the correct call at the time. Then m_LabelID looked like the answer,
	/// because vanilla binds it for every requirement kind. Measured in game
	/// across 21 of these: EVERY ONE has an empty labelId.
	///
	/// What they do have is a name, and the names are already human:
	///
	///     Subway Yard Built Req    Bus Depot Built Req
	///     Tram Track Built Req     Crematorium Built Req
	///
	/// The subject was in the prefab name the whole time. Vanilla binds that
	/// name too — see PrefabUISystem.BindOnBuildRequirement, which writes
	/// prefab.name beside the count — so reading it is following the game
	/// rather than inventing a convention.
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

			// A name that was ONLY bookkeeping leaves nothing behind, and
			// "Build a" with no object is worse than the silence it replaces.
			return subject;
		}
	}
}
