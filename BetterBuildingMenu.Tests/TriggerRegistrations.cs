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
	/// The registrations run in OnCreate against the game, so they are read from the systems' source,
	/// outside comments and literals. Every CreateTrigger and CreateBinding is read or throws, so the
	/// generated table never quietly drops or mistypes a trigger.
	/// </remarks>
	internal static class TriggerRegistrations
	{
		internal sealed record Trigger(string Name, IReadOnlyList<string> Arguments);

		private static readonly Regex Registration = new(@"\b(?:CreateTrigger|CreateBinding)\b", RegexOptions.Compiled);

		private static readonly Regex Literal = new(@"^""(?<name>\w+)""$", RegexOptions.Compiled);

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
			var text = new SourceText(source);
			var triggers = new List<Trigger>();

			foreach (Match match in Registration.Matches(text.Shape))
			{
				var call = Call.Read(text, match.Index, match.Index + match.Length);

				if (match.Value == "CreateTrigger")
				{
					var name = call.Arguments.Count == 2 ? LiteralName(call.Arguments[0]) : null;
					var types = call.Generic?.Split(',') ?? Array.Empty<string>();

					triggers.Add(new Trigger(
						name ?? throw Unreadable("a CreateTrigger without a literal name", call),
						types.Select(TypeScriptType).ToArray()));
				}
				else if (call.Arguments.Count is 3 or 4)
				{
					// The read/write overload, CreateBinding("Value", "SetValue", initial[, callback]):
					// its trigger takes the binding's type, from the call, its field or its callback.
					var name = LiteralName(call.Arguments[1])
						?? throw Unreadable("a read/write CreateBinding without a literal trigger name", call);
					var type = call.Generic
						?? FieldType(text, call.Field)
						?? CallbackType(text, call.Arguments.Count == 4 ? call.Arguments[3] : null)
						?? throw Unreadable($"no type for the trigger {name}", call);

					triggers.Add(new Trigger(name, new[] { TypeScriptType(type) }));
				}
				else if (call.Arguments.Count != 2)
				{
					throw Unreadable($"a CreateBinding with {call.Arguments.Count} arguments, neither a value binding nor a read/write one", call);
				}
			}

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

		private static string? LiteralName(string argument)
		{
			var literal = Literal.Match(argument);

			return literal.Success ? literal.Groups["name"].Value : null;
		}

		// The binding's type from the ValueBindingHelper<T> field it is assigned to.
		private static string? FieldType(SourceText text, string? field)
		{
			var declaration = field is null
				? Match.Empty
				: Regex.Match(text.Shape, @"\bValueBindingHelper<(?<type>[^<>]+)>\s+" + Regex.Escape(field) + @"\b");

			return declaration.Success ? declaration.Groups["type"].Value : null;
		}

		// The binding's type from the one parameter of the method its callback names.
		private static string? CallbackType(SourceText text, string? callback)
		{
			var declarations = callback is not null && Regex.IsMatch(callback, @"^\w+$")
				? Regex.Matches(text.Shape, @"\bvoid\s+" + Regex.Escape(callback) + @"\s*\(\s*(?<type>[\w.\[\]]+)\s+\w+\s*\)")
				: null;

			return declarations is { Count: 1 } ? declarations[0].Groups["type"].Value : null;
		}

		private static InvalidOperationException Unreadable(string problem, Call call) =>
			new($"{problem}, so the trigger table cannot be generated: {call.Text}");

		/// <summary>One registration call: its type arguments, its top-level arguments and the field it is assigned to.</summary>
		private sealed record Call(string Text, string? Generic, IReadOnlyList<string> Arguments, string? Field)
		{
			/// <summary>The call whose method name runs from start to at.</summary>
			public static Call Read(SourceText text, int start, int at)
			{
				var shape = text.Shape;
				string? generic = null;

				at = SkipSpace(shape, at);

				if (at < shape.Length && shape[at] == '<' && ClosingAngle(shape, at) is var close and > 0)
				{
					generic = text.Code.Substring(at + 1, close - at - 1);
					at = SkipSpace(shape, close + 1);
				}

				if (at >= shape.Length || shape[at] != '(')
				{
					throw new InvalidOperationException(
						$"a registration that is not a call, so the trigger table cannot be generated: {Excerpt(text.Code, start, at + 1)}");
				}

				var arguments = new List<string>();
				var depth = 0;
				var from = at + 1;

				for (var i = from; i < shape.Length; i++)
				{
					var c = shape[i];

					if (c == '<' && IsWordChar(shape[i - 1]) && ClosingAngle(shape, i) is var angle and > 0)
					{
						i = angle;
					}
					else if (c is '(' or '[' or '{')
					{
						depth++;
					}
					else if (c is ')' or ']' or '}' && depth > 0)
					{
						depth--;
					}
					else if (c == ',' && depth == 0)
					{
						arguments.Add(text.Code.Substring(from, i - from).Trim());
						from = i + 1;
					}
					else if (c == ')')
					{
						var last = text.Code.Substring(from, i - from).Trim();

						if (last.Length > 0 || arguments.Count > 0)
						{
							arguments.Add(last);
						}

						return new Call(Excerpt(text.Code, start, i + 1), generic, arguments, AssignedField(shape, start));
					}
				}

				throw new InvalidOperationException($"an unclosed registration call: {Excerpt(text.Code, start, shape.Length)}");
			}

			// The name in `name = ` just before the call, if the call is assigned.
			private static string? AssignedField(string shape, int start)
			{
				var at = SkipSpaceBack(shape, start - 1);

				if (at < 1 || shape[at] != '=' || "=!<>+-*/%&|^?".Contains(shape[at - 1]))
				{
					return null;
				}

				var end = SkipSpaceBack(shape, at - 1);
				at = end;

				while (at >= 0 && IsWordChar(shape[at]))
				{
					at--;
				}

				return end > at ? shape.Substring(at + 1, end - at) : null;
			}

			// The '>' that closes the type-argument list opening at `open`, or -1 where '<' is a comparison.
			private static int ClosingAngle(string shape, int open)
			{
				var depth = 0;

				for (var i = open; i < shape.Length; i++)
				{
					var c = shape[i];

					if (c == '<')
					{
						depth++;
					}
					else if (c == '>' && --depth == 0)
					{
						return i;
					}
					else if (!(IsWordChar(c) || char.IsWhiteSpace(c) || c is ',' or '.' or '?' or '[' or ']'))
					{
						return -1;
					}
				}

				return -1;
			}

			private static bool IsWordChar(char c) => char.IsLetterOrDigit(c) || c == '_';

			private static int SkipSpace(string shape, int at)
			{
				while (at < shape.Length && char.IsWhiteSpace(shape[at]))
				{
					at++;
				}

				return at;
			}

			private static int SkipSpaceBack(string shape, int at)
			{
				while (at >= 0 && char.IsWhiteSpace(shape[at]))
				{
					at--;
				}

				return at;
			}

			private static string Excerpt(string code, int start, int end) =>
				Regex.Replace(code.Substring(start, Math.Min(end, code.Length) - start), @"\s+", " ");
		}

		/// <summary>
		/// A source with its comments blanked (Code), and with the insides of its string and char
		/// literals blanked too (Shape). Both keep every offset, so a match in one indexes the other.
		/// </summary>
		private sealed class SourceText
		{
			public readonly string Code;
			public readonly string Shape;

			private readonly string _source;
			private readonly char[] _code;
			private readonly char[] _shape;

			public SourceText(string source)
			{
				_source = source;
				_code = source.ToCharArray();
				_shape = source.ToCharArray();
				ScanCode(0, hole: false);
				Code = new string(_code);
				Shape = new string(_shape);
			}

			// Scans code from `at`; in an interpolation hole, up to the brace that closes the hole.
			private int ScanCode(int at, bool hole)
			{
				var depth = 0;

				while (at < _source.Length)
				{
					var c = _source[at];

					if (hole && c == '}' && depth == 0)
					{
						return at;
					}

					if (c == '/' && Next(at) == '/')
					{
						var end = _source.IndexOf('\n', at);
						at = Blank(at, end < 0 ? _source.Length : end, comment: true);
					}
					else if (c == '/' && Next(at) == '*')
					{
						var end = _source.IndexOf("*/", at + 2, StringComparison.Ordinal);
						at = Blank(at, end < 0 ? throw Unclosed("comment", at) : end + 2, comment: true);
					}
					else if (c == '\'')
					{
						at = ScanChar(at);
					}
					else if (c == '"' || (c is '$' or '@' && StringStartsAt(at)))
					{
						at = ScanString(at);
					}
					else
					{
						depth += c == '{' ? 1 : c == '}' ? -1 : 0;
						at++;
					}
				}

				return hole ? throw Unclosed("interpolated string", at) : at;
			}

			private int ScanChar(int open)
			{
				// Past the first character, so an escaped quote does not close it.
				var first = Next(open) == '\\' ? open + 2 : open + 1;
				var close = _source.IndexOf('\'', first + 1);

				if (close < 0 || _source.IndexOf('\n', open, close - open) >= 0)
				{
					throw Unclosed("char literal", open);
				}

				Blank(open + 1, close, comment: false);
				return close + 1;
			}

			private int ScanString(int start)
			{
				var quote = _source.IndexOf('"', start);
				var prefix = _source.Substring(start, quote - start);
				var verbatim = prefix.Contains('@');
				var interpolated = prefix.Contains('$');

				if (!verbatim && string.CompareOrdinal(_source, quote, "\"\"\"", 0, 3) == 0)
				{
					throw new InvalidOperationException("the trigger reader does not read raw string literals; teach TriggerRegistrations.SourceText them");
				}

				var at = quote + 1;

				while (true)
				{
					if (at >= _source.Length || (!verbatim && _source[at] == '\n'))
					{
						throw Unclosed("string literal", start);
					}

					var c = _source[at];

					if (c == '\\' && !verbatim)
					{
						at += 2;
					}
					else if (c == '"' && verbatim && Next(at) == '"')
					{
						at += 2;
					}
					else if (c == '"')
					{
						break;
					}
					else if (interpolated && c is '{' or '}' && Next(at) == c)
					{
						at += 2;
					}
					else if (interpolated && c == '{')
					{
						at = ScanCode(at + 1, hole: true) + 1;
					}
					else
					{
						at++;
					}
				}

				// The whole literal, holes and all, is one argument's text.
				Blank(quote + 1, at, comment: false);
				return at + 1;
			}

			private bool StringStartsAt(int at)
			{
				while (at < _source.Length && _source[at] is '$' or '@')
				{
					at++;
				}

				return at < _source.Length && _source[at] == '"';
			}

			// Blanks [from, to) in the shape, and in the code too for a comment; returns `to`.
			private int Blank(int from, int to, bool comment)
			{
				for (var i = from; i < to; i++)
				{
					if (_source[i] != '\n')
					{
						_shape[i] = ' ';

						if (comment)
						{
							_code[i] = ' ';
						}
					}
				}

				return to;
			}

			private char Next(int at) => at + 1 < _source.Length ? _source[at + 1] : '\0';

			private static InvalidOperationException Unclosed(string what, int at) =>
				new($"an unclosed {what} at offset {at}, so the trigger reader cannot tell code from text");
		}
	}
}
