using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The mod's own files as text, for the tests that hold code and strings to what they say.</summary>
	internal static class ModSource
	{
		/// <summary>The mod's project folder, BetterBuildingMenu/.</summary>
		public static string Folder([CallerFilePath] string self = "") =>
			Path.GetFullPath(Path.Combine(Path.GetDirectoryName(self)!, "..", "BetterBuildingMenu"));

		/// <summary>A file under BetterBuildingMenu/, such as "Setting.cs" or "Systems/BuildingMenuUISystem.cs".</summary>
		public static string Text(string name) => File.ReadAllText(Path.Combine(Folder(), name));

		/// <summary>The English string Locale.json holds for a key.</summary>
		public static string English(string key)
		{
			using var locale = JsonDocument.Parse(Text("Locale.json"));

			return locale.RootElement.GetProperty(key).GetString()!;
		}

		/// <summary>A member's text, from its declaration to the brace that closes its body, or to the semicolon of an expression body.</summary>
		/// <remarks>Each run of whitespace reads as one space, so a test can hold a body whole without its indentation.</remarks>
		public static string Member(string source, string declaration)
		{
			var start = source.IndexOf(declaration, StringComparison.Ordinal);

			if (start < 0)
			{
				throw new InvalidOperationException("Not found: " + declaration);
			}

			var open = source.IndexOf('{', start);
			var semicolon = source.IndexOf(';', start);

			// A semicolon before any brace ends an expression-bodied member, which has no braces of its own.
			if (semicolon >= 0 && (open < 0 || semicolon < open))
			{
				return Regex.Replace(source.Substring(start, semicolon + 1 - start), @"\s+", " ");
			}

			var depth = 0;

			for (var i = open; i >= 0 && i < source.Length; i++)
			{
				depth += source[i] == '{' ? 1 : source[i] == '}' ? -1 : 0;

				if (depth == 0)
				{
					return Regex.Replace(source.Substring(start, i + 1 - start), @"\s+", " ");
				}
			}

			throw new InvalidOperationException("Never closes: " + declaration);
		}
	}
}
