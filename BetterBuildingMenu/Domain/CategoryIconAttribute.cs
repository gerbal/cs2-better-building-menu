using System;
using System.Collections.Concurrent;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	public class CategoryIconAttribute : Attribute
	{
		public string Icon { get; set; }

		public CategoryIconAttribute(string icon)
		{
			Icon = icon;
		}

		/// <remarks>Cached: every indexed prefab asks, twice, on every pass, and the answer is fixed at
		/// compile time. A value with no attribute throws each time rather than being cached.</remarks>
		public static CategoryIconAttribute GetAttribute<TEnum>(TEnum enumValue) where TEnum : struct, Enum =>
			Cache<TEnum>.Attributes.GetOrAdd(enumValue, Lookup);

		private static CategoryIconAttribute Lookup<TEnum>(TEnum enumValue) where TEnum : struct, Enum
		{
			var memberInfo = typeof(TEnum).GetMember(enumValue.ToString()).FirstOrDefault() ?? throw new ArgumentException($"Invalid enum value: {enumValue}");

			var crnAttribute = (CategoryIconAttribute)memberInfo.GetCustomAttributes(typeof(CategoryIconAttribute), false).FirstOrDefault();

			return crnAttribute ?? throw new ArgumentException($"Enum value {enumValue} is missing CategoryIconAttribute");
		}

		private static class Cache<TEnum> where TEnum : struct, Enum
		{
			public static readonly ConcurrentDictionary<TEnum, CategoryIconAttribute> Attributes = new();
		}
	}
}
