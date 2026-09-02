using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The C#↔TS binding boundary, as a diff of two name sets.
	/// </summary>
	/// <remarks>
	/// Nothing fails at build time when one side renames or abandons a
	/// binding: C# publishes to a name nobody subscribes to, or TS subscribes
	/// to a name nobody publishes and reads its default forever. The 2026-09-01
	/// review found nine of the first kind and three of the second. This reads
	/// both trees as text and requires the sets to agree, so the next one
	/// fails here instead of in the game.
	///
	/// A regex over source is a blunt instrument, and this is the one place
	/// it is the right one: the boundary IS strings, on both sides.
	/// </remarks>
	public sealed class BindingManifestTests
	{
		/// <summary>
		/// C# bindings the UI is known not to read yet. Each entry names the
		/// bead that either wires it or deletes it; an entry without one is a
		/// failure of this test's purpose, not a convenience.
		/// </summary>
		private static readonly string[] KnownUnreadByUi = System.Array.Empty<string>();
		// Empty since cm-jjlv.8: the UI reads BuildingCatalogGroupBy. Keep it
		// empty; an entry here is a regression of that phase, not a convenience.

		[Fact]
		public void EveryNameTheUiUsesIsRegisteredByCSharp()
		{
			var registered = CSharpNames();
			var used = TypeScriptNames();

			var phantom = used.Except(registered).OrderBy(name => name, StringComparer.Ordinal).ToArray();

			Assert.True(phantom.Length == 0,
				"UI reads or triggers names no C# system registers: " + string.Join(", ", phantom));
		}

		[Fact]
		public void EveryNameCSharpRegistersIsUsedByTheUi()
		{
			var registered = CSharpNames();
			var used = TypeScriptNames();

			var orphaned = registered
				.Except(used)
				.Except(KnownUnreadByUi)
				.OrderBy(name => name, StringComparer.Ordinal)
				.ToArray();

			Assert.True(orphaned.Length == 0,
				"C# registers names the UI never reads or triggers: " + string.Join(", ", orphaned));
		}

		[Fact]
		public void TheAllowlistOnlyNamesThingsThatStillExist()
		{
			// An allowlist entry for a name C# no longer registers, or one the
			// UI has started reading, is stale and must go.
			var registered = CSharpNames();
			var used = TypeScriptNames();

			foreach (var name in KnownUnreadByUi)
			{
				Assert.Contains(name, registered);
				Assert.DoesNotContain(name, used);
			}
		}

		[Fact]
		public void TheExtractorsFindTheBoundaryAtAll()
		{
			// Guards the guards: if a refactor moves the systems or the UI, both
			// sets go empty and the two diffs above pass vacuously.
			Assert.True(CSharpNames().Count > 40, "C# extractor found too few names");
			Assert.True(TypeScriptNames().Count > 40, "TS extractor found too few names");
			Assert.Contains("SearchChanged", CSharpNames());
			Assert.Contains("SearchChanged", TypeScriptNames());
		}

		// Matches CreateBinding("Name", …), CreateTrigger<int>("Name", …), and the
		// two-name CreateBinding("Name", "SetName", value, setter). The generic
		// argument may not contain parentheses, which keeps a lazy match from
		// spanning from one call to the next.
		private static readonly Regex CSharpRegistration = new(
			@"Create(?:Binding|Trigger)\s*(?:<[^()]*?>)?\s*\(\s*""(?<name>\w+)""(?:\s*,\s*""(?<trigger>\w+)"")?",
			RegexOptions.Singleline | RegexOptions.Compiled);

		private static readonly Regex TypeScriptUse = new(
			@"bindValue\s*(?:<[^()]*?>)?\s*\(\s*mod\.id\s*,\s*""(?<name>\w+)""" +
			@"|trigger\s*\(\s*mod\.id\s*,\s*""(?<name>\w+)""" +
			@"|createTriggerCommand\(\s*""(?<name>\w+)""" +
			@"|method:\s*""(?<name>\w+)""",
			RegexOptions.Singleline | RegexOptions.Compiled);

		// Commands aimed at the game's own binding groups, not at this mod.
		private static readonly Regex TypeScriptForeignCommand = new(
			@"group:\s*""(?!BetterBuildingMenu"")\w+""\s*,\s*method:\s*""(?<name>\w+)""",
			RegexOptions.Singleline | RegexOptions.Compiled);

		private static HashSet<string> CSharpNames()
		{
			var names = new HashSet<string>(StringComparer.Ordinal);

			foreach (var file in Directory.EnumerateFiles(Path.Combine(RepoRoot(), "BetterBuildingMenu", "Systems"), "*.cs"))
			{
				foreach (Match match in CSharpRegistration.Matches(File.ReadAllText(file)))
				{
					names.Add(match.Groups["name"].Value);

					if (match.Groups["trigger"].Success)
					{
						names.Add(match.Groups["trigger"].Value);
					}
				}
			}

			return names;
		}

		private static HashSet<string> TypeScriptNames()
		{
			var names = new HashSet<string>(StringComparer.Ordinal);
			var foreign = new HashSet<string>(StringComparer.Ordinal);
			var root = Path.Combine(RepoRoot(), "BetterBuildingMenu", "UI", "src");

			foreach (var file in Directory.EnumerateFiles(root, "*.ts*", SearchOption.AllDirectories))
			{
				if (!file.EndsWith(".ts", StringComparison.Ordinal) && !file.EndsWith(".tsx", StringComparison.Ordinal))
				{
					continue;
				}

				var source = File.ReadAllText(file);

				foreach (Match match in TypeScriptUse.Matches(source))
				{
					names.Add(match.Groups["name"].Value);
				}

				foreach (Match match in TypeScriptForeignCommand.Matches(source))
				{
					foreign.Add(match.Groups["name"].Value);
				}
			}

			names.ExceptWith(foreign);

			return names;
		}

		private static string RepoRoot()
		{
			var dir = new DirectoryInfo(Directory.GetCurrentDirectory());

			while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "BetterBuildingMenu")))
			{
				dir = dir.Parent;
			}

			Assert.NotNull(dir);

			return dir!.FullName;
		}
	}
}
