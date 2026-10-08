using BetterBuildingMenu.Domain.Placement;

using System.IO;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>Reads history.json once a launch and writes it when flushed.</summary>
	/// <remarks>
	/// Never throws. The folder and the log are parameters, so a test can hand it a folder
	/// that cannot be written and read what it logged. See docs/design-notes.md, "The
	/// placement history".
	/// </remarks>
	public sealed class PlacementHistoryFile
	{
		public const string FileName = "history.json";

		private readonly string _folder;
		private readonly Action<string> _debug;
		private readonly Action<string> _warn;
		private bool _warnedWrite;

		public PlacementHistoryFile(string folder, Action<string> debug, Action<string> warn)
		{
			_folder = folder;
			_debug = debug;
			_warn = warn;
		}

		private string FilePath => Path.Combine(_folder, FileName);

		/// <summary>The history the file holds, halved for this launch, or an empty one.</summary>
		public PlacementHistory Load()
		{
			string text;

			try
			{
				if (!File.Exists(FilePath))
				{
					return LoadTemporary();
				}

				text = File.ReadAllText(FilePath);
			}
			catch (Exception ex)
			{
				// Read-only this session: a file another program holds may be good, and a
				// flush would overwrite it with this session's placements alone.
				_warn($"Could not read {FileName} ({ex.Message}); placements are not kept this session");
				return new PlacementHistory(readOnly: true);
			}

			var read = PlacementHistoryJson.Read(text);

			switch (read.State)
			{
				case PlacementHistoryReadState.Newer:
					_warn($"{FileName} is from a newer release: it is left as it is, and nothing is counted this session");
					return read.History;
				case PlacementHistoryReadState.Corrupt:
					// Unless it is kept aside, the next flush would replace it with this session's placements alone.
					return SetAside() ? read.History : new PlacementHistory(readOnly: true);
				default:
					read.History.Decay();
					return read.History;
			}
		}

		/// <summary>The history a flush left under history.json.tmp when history.json itself is missing, or an empty one.</summary>
		/// <remarks>
		/// A first flush killed between the write and the move leaves the data only there, and so
		/// does a replace that fails once the old file is gone. It is read like the file, and dirty,
		/// so the next flush writes history.json. See docs/design-notes.md, "The placement history".
		/// </remarks>
		private PlacementHistory LoadTemporary()
		{
			var temporary = FilePath + ".tmp";

			try
			{
				if (File.Exists(temporary))
				{
					var read = PlacementHistoryJson.Read(File.ReadAllText(temporary));

					if (read.State == PlacementHistoryReadState.Read)
					{
						read.History.Decay();
						read.History.MarkDirty();
						_debug($"No {FileName}: the placement history is read from {FileName}.tmp, and written at the next flush");

						return read.History;
					}
				}
			}
			catch (Exception ex)
			{
				_debug($"Could not read {FileName}.tmp ({ex.Message}); it is ignored");
			}

			_debug($"No {FileName} yet: the placement history starts empty");

			return new PlacementHistory();
		}

		/// <summary>Writes the history if it has placements the file lacks. Never throws.</summary>
		public void FlushIfDirty(PlacementHistory history)
		{
			if (!history.IsDirty || history.IsReadOnly)
			{
				return;
			}

			try
			{
				Directory.CreateDirectory(_folder);
				AtomicFile.WriteAllText(FilePath, PlacementHistoryJson.Write(history));
				history.MarkClean();
			}
			catch (Exception ex)
			{
				// Once a session: the timer tries again every two minutes, and the counts stay in memory.
				if (!_warnedWrite)
				{
					_warnedWrite = true;
					_warn($"Could not write {FileName} ({ex.Message}); it is tried again at the next flush");
				}
			}
		}

		/// <returns>Whether the file was moved to history.json.bad.</returns>
		private bool SetAside()
		{
			var bad = FilePath + ".bad";

			try
			{
				AtomicFile.MoveOver(FilePath, bad);
				_warn($"{FileName} could not be read: it is kept as {FileName}.bad, and the placement history starts empty");

				return true;
			}
			catch (Exception ex)
			{
				_warn($"{FileName} could not be read, nor kept aside ({ex.Message}); placements are not kept this session");

				return false;
			}
		}
	}
}
