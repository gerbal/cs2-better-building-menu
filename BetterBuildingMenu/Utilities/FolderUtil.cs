using Colossal.PSI.Environment;
using System.IO;

namespace BetterBuildingMenu.Utilities
{
    internal class FolderUtil
    {
        public static string ContentFolder { get; }

        static FolderUtil()
        {
            ContentFolder = Path.Combine(EnvPath.kUserDataPath, "ModsData", nameof(BetterBuildingMenu));

            Directory.CreateDirectory(ContentFolder);
        }
    }
}
