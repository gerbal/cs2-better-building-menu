using System.IO;
using System.Text;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>Appends the pick log's lines to picks.jsonl in ModsData, moving it aside at 5 MB.</summary>
	/// <remarks>
	/// Never throws: a write that fails warns once a session, and its lines are dropped. The folder
	/// and the warning are parameters, so a test can hand it a folder that cannot be written. See
	/// docs/design-notes.md, "The pick logger".
	/// </remarks>
	public sealed class PickLogFile
	{
		public const string FileName = "picks.jsonl";

		/// <summary>Where a full log goes, replacing the one before.</summary>
		public const string RolledName = "picks.1.jsonl";

		public const long MaxBytes = 5L * 1024 * 1024;

		private readonly string _folder;
		private readonly Action<string> _warn;
		private bool _warned;

		public PickLogFile(string folder, Action<string> warn)
		{
			_folder = folder;
			_warn = warn;
		}

		private string FilePath => Path.Combine(_folder, FileName);

		/// <summary>Whether lines this long would carry a log this size past <see cref="MaxBytes"/>; an empty log never rolls.</summary>
		public static bool ShouldRoll(long size, long adding) => size > 0 && size + adding > MaxBytes;

		/// <summary>Appends lines, one per event. Never throws.</summary>
		public void Append(IEnumerable<string> lines)
		{
			try
			{
				var text = string.Concat(lines.Select(line => line + "\n"));

				if (text.Length == 0)
				{
					return;
				}

				Directory.CreateDirectory(_folder);

				if (File.Exists(FilePath) && ShouldRoll(new FileInfo(FilePath).Length, Encoding.UTF8.GetByteCount(text)))
				{
					AtomicFile.MoveOver(FilePath, Path.Combine(_folder, RolledName));
				}

				File.AppendAllText(FilePath, text);
			}
			catch (Exception ex)
			{
				Warn(ex);
			}
		}

		/// <summary>Once a session: the logger writes at every arm and placement.</summary>
		private void Warn(Exception ex)
		{
			if (_warned)
			{
				return;
			}

			_warned = true;

			try
			{
				_warn($"Could not write {FileName} ({ex.Message}); pick log lines are dropped until a write works");
			}
			catch
			{
				// The warning is the last resort; nothing here may reach the game.
			}
		}
	}
}
