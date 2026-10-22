using Colossal.UI.Binding;

using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A property name and its value in one call, so a writer reads as the list of fields the
	/// UI receives, in order. A missing number is written as null and a missing list as an empty array.
	/// </summary>
	internal static class JsonPropExtensions
	{
		public static void Prop(this IJsonWriter writer, string name, string value)
		{
			writer.PropertyName(name);
			writer.Write(value);
		}

		public static void Prop(this IJsonWriter writer, string name, int value)
		{
			writer.PropertyName(name);
			writer.Write(value);
		}

		public static void Prop(this IJsonWriter writer, string name, bool value)
		{
			writer.PropertyName(name);
			writer.Write(value);
		}

		public static void Prop(this IJsonWriter writer, string name, double value)
		{
			writer.PropertyName(name);
			writer.Write(value);
		}

		public static void Prop(this IJsonWriter writer, string name, int? value)
		{
			writer.PropertyName(name);
			if (value.HasValue)
			{
				writer.Write(value.Value);
			}
			else
			{
				writer.WriteNull();
			}
		}

		public static void Prop(this IJsonWriter writer, string name, double? value)
		{
			writer.PropertyName(name);
			if (value.HasValue)
			{
				writer.Write(value.Value);
			}
			else
			{
				writer.WriteNull();
			}
		}

		public static void Prop(this IJsonWriter writer, string name, IReadOnlyList<string>? values)
		{
			writer.PropertyName(name);
			writer.ArrayBegin((uint)(values?.Count ?? 0));

			if (values is not null)
			{
				for (var i = 0; i < values.Count; i++)
				{
					writer.Write(values[i]);
				}
			}

			writer.ArrayEnd();
		}

		public static void Prop<T>(this IJsonWriter writer, string name, IReadOnlyList<T>? items)
			where T : IJsonWritable
		{
			writer.PropertyName(name);
			writer.ArrayBegin((uint)(items?.Count ?? 0));

			if (items is not null)
			{
				for (var i = 0; i < items.Count; i++)
				{
					items[i].Write(writer);
				}
			}

			writer.ArrayEnd();
		}
	}
}
