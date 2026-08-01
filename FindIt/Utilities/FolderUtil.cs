using Colossal.PSI.Environment;
using System.IO;

namespace FindItBuildingMenu.Utilities
{
    internal class FolderUtil
    {
        public static string ContentFolder { get; }
        public static string SettingsFolder { get; }

        static FolderUtil()
        {
            ContentFolder = Path.Combine(EnvPath.kUserDataPath, "ModsData", nameof(FindItBuildingMenu));
            //SettingsFolder = Path.Combine(EnvPath.kUserDataPath, "ModsSettings", nameof(FindItBuildingMenu));

            Directory.CreateDirectory(ContentFolder);
            //Directory.CreateDirectory(SettingsFolder);
        }
    }
}
