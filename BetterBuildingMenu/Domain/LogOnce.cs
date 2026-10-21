using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Lets a failure that recurs every frame or flush be logged the first time only.</summary>
	/// <remarks>Not thread-safe: each instance belongs to the one system or file that logs through it.</remarks>
	public sealed class LogOnce
	{
		private bool _logged;
		private HashSet<string>? _keys;

		/// <summary>True the first time it is asked, false every time after.</summary>
		public bool IsFirst()
		{
			if (_logged)
			{
				return false;
			}

			_logged = true;

			return true;
		}

		/// <summary>True the first time each key is asked, so one instance covers a set of named failures.</summary>
		public bool IsFirst(string key) => (_keys ??= new HashSet<string>(StringComparer.Ordinal)).Add(key);
	}
}
