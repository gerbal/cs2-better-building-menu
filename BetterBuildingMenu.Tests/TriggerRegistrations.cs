using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Every trigger the mod's systems register, with the TypeScript type of each argument it reads.
	/// </summary>
	/// <remarks>
	/// The registrations run in OnCreate against the game, so they are read from the systems' source:
	/// the name and the generic arguments are written out there. Anything it cannot read throws, so
	/// the generated table never quietly drops or mistypes a trigger.
	/// </remarks>
	internal static class TriggerRegistrations
	{
		internal sealed record Trigger(string Name, IReadOnlyList<string> Arguments);

		private static readonly Regex AnyTrigger = new(@"\bCreateTrigger\b", RegexOptions.Compiled);

		private static readonly Regex NamedTrigger = new(
			@"\bCreateTrigger\s*(?:<(?<types>[^()]*?)>)?\s*\(\s*""(?<name>\w+)""",
			RegexOptions.Singleline | RegexOptions.Compiled);

		// The read/write overload, CreateBinding("Value", "SetValue", ...): its trigger takes the
		// binding's own type, which the call states, the field it is assigned to declares, or its callback takes.
		private static readonly Regex AnySetterBinding = new(
			@"\bCreateBinding\s*(?:<[^()]*?>)?\s*\(\s*""\w+""\s*,\s*""",
			RegexOptions.Singleline | RegexOptions.Compiled);

		private static readonly Regex SetterBinding = new(
			@"(?:\b(?<field>\w+)\s*=\s*)?\bCreateBinding\s*(?:<(?<type>[^()]*?)>)?\s*\(\s*""\w+""\s*,\s*""(?<name>\w+)""(?:\s*,\s*[^,()]+?\s*,\s*(?<callback>\w+)\s*\))?",
			RegexOptions.Singleline | RegexOptions.Compiled);

		/// <summary>The triggers in BetterBuildingMenu/Systems, by name.</summary>
		public static IReadOnlyList<Trigger> Read()
		{
			var systems = Path.Combine(TestPaths.RepoRoot(), "BetterBuildingMenu", "Systems");
			var files = Directory.EnumerateFiles(systems, "*.cs").OrderBy(file => file, StringComparer.Ordinal);

			// One text, so a field declared in one partial types a binding made in another.
			return Parse(string.Join("\n", files.Select(File.ReadAllText)));
		}

		/// <summary>The triggers a source text registers, by name.</summary>
		public static IReadOnlyList<Trigger> Parse(string source)
		{
			var triggers = new List<Trigger>();

			foreach (Match match in NamedTrigger.Matches(source))
			{
				var types = match.Groups["types"].Success
					? match.Groups["types"].Value.Split(',').Select(TypeScriptType).ToArray()
					: Array.Empty<string>();

				triggers.Add(new Trigger(match.Groups["name"].Value, types));
			}

			RequireAllRead("CreateTrigger", AnyTrigger.Matches(source).Count, triggers.Count);

			var setters = SetterBinding.Matches(source);

			foreach (Match match in setters)
			{
				var type = match.Groups["type"].Success ? match.Groups["type"].Value
					: match.Groups["field"].Success ? FieldType(source, match.Groups["field"].Value)
					: CallbackType(source, match.Groups["callback"]);

				triggers.Add(new Trigger(match.Groups["name"].Value, new[] { TypeScriptType(type) }));
			}

			RequireAllRead("read/write CreateBinding", AnySetterBinding.Matches(source).Count, setters.Count);

			var twice = triggers.GroupBy(trigger => trigger.Name).FirstOrDefault(group => group.Count() > 1);

			if (twice is not null)
			{
				throw new InvalidOperationException($"the trigger {twice.Key} is registered twice");
			}

			return triggers.OrderBy(trigger => trigger.Name, StringComparer.Ordinal).ToArray();
		}

		/// <summary>The TypeScript type the UI sends for a C# trigger argument.</summary>
		public static string TypeScriptType(string csharp) => csharp.Trim() switch
		{
			"int" or "float" or "double" => "number",
			"bool" => "boolean",
			"string" => "string",
			"string[]" => "string[]",
			var other => throw new InvalidOperationException(
				$"a trigger argument of type {other} has no TypeScript type; add one to TriggerRegistrations.TypeScriptType"),
		};

		private static string FieldType(string source, string field)
		{
			var declaration = Regex.Match(source, @"ValueBindingHelper<(?<type>[^>]+)>\s+" + Regex.Escape(field) + @"\b");

			return declaration.Success
				? declaration.Groups["type"].Value
				: throw new InvalidOperationException($"no ValueBindingHelper<T> declaration for {field}, so its setter trigger has no type");
		}

		private static string CallbackType(string source, Group callback)
		{
			var declarations = callback.Success
				? Regex.Matches(source, @"\bvoid\s+" + Regex.Escape(callback.Value) + @"\s*\(\s*(?<type>[\w.\[\]]+)\s+\w+\s*\)")
				: null;

			return declarations is { Count: 1 }
				? declarations[0].Groups["type"].Value
				: throw new InvalidOperationException("a read/write binding with no field and no one-argument callback, so its setter trigger has no type");
		}

		private static void RequireAllRead(string call, int written, int read)
		{
			if (written != read)
			{
				throw new InvalidOperationException(
					$"{written} {call} calls but {read} read: a registration without a literal name, or with a type the reader cannot see");
			}
		}
	}
}
