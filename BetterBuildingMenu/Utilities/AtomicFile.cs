using System.IO;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>Writes a file whole or not at all.</summary>
	/// <remarks>
	/// Through a .tmp beside it, so a game killed mid-write leaves the old file whole. The
	/// mod runs on net48, whose File.Move cannot overwrite: hence Replace when the file exists.
	/// </remarks>
	public static class AtomicFile
	{
		public static void WriteAllText(string path, string text)
		{
			var temporary = path + ".tmp";
			File.WriteAllText(temporary, text);
			MoveOver(temporary, path);
		}

		/// <summary>Moves a file onto a path, replacing the file already there.</summary>
		public static void MoveOver(string source, string destination)
		{
			if (File.Exists(destination))
			{
				File.Replace(source, destination, null);
			}
			else
			{
				File.Move(source, destination);
			}
		}
	}
}
