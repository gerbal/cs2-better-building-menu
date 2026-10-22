using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>A row of one of the asset menu's descriptor tables: the metrics, facets, sort columns
	/// and group dimensions.</summary>
	internal interface IDescriptor
	{
		DescriptorIds Ids { get; }
	}

	/// <summary>The ids a descriptor answers to: its own and any aliases.</summary>
	/// <remarks>Every table looks its rows up through <see cref="Find{T}"/>, so an id matches the same
	/// way in each: whole, ignoring case. Trimming is left to the table, as the sort columns do not.</remarks>
	internal sealed class DescriptorIds
	{
		private readonly string[] _lowered;

		internal DescriptorIds(string id, params string[] aliases)
		{
			_lowered = new[] { id }.Concat(aliases).Select(key => key.ToLowerInvariant()).ToArray();
		}

		/// <summary>The first row an id names, or null when it names none.</summary>
		internal static T? Find<T>(IReadOnlyList<T> rows, string? id)
			where T : class, IDescriptor
		{
			var lowered = (id ?? string.Empty).ToLowerInvariant();

			for (var i = 0; i < rows.Count; i++)
			{
				if (Array.IndexOf(rows[i].Ids._lowered, lowered) >= 0)
				{
					return rows[i];
				}
			}

			return null;
		}
	}
}
