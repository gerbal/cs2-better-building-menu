using Colossal.PSI.Environment;
using System.IO;

namespace BetterBuildingMenu.Utilities
{
    internal class FolderUtil
    {
        public static string ContentFolder { get; }
        public static string SettingsFolder { get; }

        static FolderUtil()
        {
            ContentFolder = Path.Combine(EnvPath.kUserDataPath, "ModsData", nameof(BetterBuildingMenu));
            //SettingsFolder = Path.Combine(EnvPath.kUserDataPath, "ModsSettings", nameof(BetterBuildingMenu));

            Directory.CreateDirectory(ContentFolder);
            //Directory.CreateDirectory(SettingsFolder);
        }
    }
}
