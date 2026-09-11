# Publishing to Paradox Mods

The game ships its own uploader, `ModPublisher`, under
`Cities2_Data/Content/Game/.ModdingToolchain/ModPublisher/`. It is a
framework-dependent .NET 6 console app with no native dependencies, so it runs
under the host's `dotnet` on Linux — no Wine, no Windows toolchain install.
Verified on 2026-09-09 with dotnet 10.0.301 and `DOTNET_ROLL_FORWARD=Major`.

## How it signs in

`Context.Create` reads the session the game stored under
`<LocalAppData>/../LocalLow/Colossal Order/Cities Skylines II/.pdxsdk/`
(`database.json` holds the session and refresh tokens). On Linux
`LocalAppData` is `~/.local/share`, so the uploader looks in
`~/.local/LocalLow/…`. A symlink from there to the Proton prefix's copy makes
the game's login visible:

```sh
mkdir -p "$HOME/.local/LocalLow/Colossal Order"
ln -s "$HOME/.local/share/Steam/steamapps/compatdata/949230/pfx/drive_c/users/steamuser/AppData/LocalLow/Colossal Order/Cities Skylines II" \
      "$HOME/.local/LocalLow/Colossal Order/Cities Skylines II"
```

The `CSII_PDXCACHEPATH` / `CSII_PDXMODSPATH` overrides are read with
`EnvironmentVariableTarget.User`, which is a no-op outside Windows, so the
symlink is the only way to point it at the prefix.

Signing in **rotates the stored tokens**, and the game reads the same file, so
run the uploader only while the game is closed.

## Where to run it from

**Never run it with the toolchain folder as the working directory.** The SDK
resolves the Windows paths from `.cache/Mods/mod_directory.json`
(`C:/users/steamuser/…`) relative to the current directory and creates that
tree there. Under `Cities2_Data/Content/Game/` that stray tree breaks the
game's DLC hash (`HashHelper.ComputeHash` over the content folder throws
`ArgumentOutOfRangeException`), Steamworks reports "Data is corrupted in Game
database", and the game quits two seconds after start. That happened on
2026-09-09; the fix was deleting `ModPublisher/C:`. Run from a scratch
directory and delete the `C:` tree it leaves there afterwards.

## Steps

1. Build the package: `CS2_BUILD_CONFIG=Release ./build.sh all && CS2_BUILD_CONFIG=Release ./build.sh package`.
   The package is `artifacts/BetterBuildingMenu/`; `build.sh` refuses any
   package that still carries a Find It identity.
2. Fill `BetterBuildingMenu/Properties/PublishConfiguration.xml`: version,
   `GameVersion` (`major.minor.*`, currently `1.6.*`), thumbnail (square PNG),
   screenshots, changelog. `AccessLevel` may be `Public`, `Unlisted` or
   `Private`.
   Build and package with the same configuration in one environment:
   `CS2_BUILD_CONFIG=Release ./build.sh all && CS2_BUILD_CONFIG=Release ./build.sh package`.
   `package` reads the variable too; without it, it copies the Debug dll
   (this shipped a stale embedded `Locale.json` once, on 2026-09-09, before
   the 0.1.3 package was redone).

3. Close the game. From a scratch directory:

   ```sh
   MP="$HOME/.local/share/Steam/steamapps/common/Cities Skylines II/Cities2_Data/Content/Game/.ModdingToolchain/ModPublisher"
   REPO=/path/to/cs2-better-building-menu
   cd "$(mktemp -d)"
   DOTNET_ROLL_FORWARD=Major dotnet "$MP/ModPublisher.dll" Publish \
       "$REPO/BetterBuildingMenu/Properties/PublishConfiguration.xml" \
       -c "$REPO/artifacts/BetterBuildingMenu" -v
   ```

   Relative `Thumbnail`/`Screenshot` paths in the XML resolve against the
   working directory, so either use absolute paths or run from
   `BetterBuildingMenu/`.

   `Publish` prints `Mod published with Id=<n>`. Put that number in
   `<ModId Value="…"/>`; it is required by the other two commands.
4. Later versions: bump `ModVersion`, mirror the `Changelog.json` entry into
   `<ChangeLog>`, then run `NewVersion` with the same arguments. Metadata-only
   changes (description, images, access level) go through `Update`.

## Verifying the login without publishing

`Update` with a nonexistent `ModId` signs in, then fails server-side with
"The mod ID provided (…) is invalid or does not exist" — nothing is written.
That is the probe used on 2026-09-09; it printed
`Auto logged in with account "…"` first.


## After every NewVersion, run Update

A `NewVersion` upload echoes the forum link in its log but the page came back
without it (seen after 0.1.5 and 0.1.6 on 2026-09-10). A metadata `Update` run
with the same configuration puts it back. Run one after each NewVersion.

The `Update` refuses for a minute or two after a publish ("User version already
exists for this mod"). Wait and retry; it went through on the first retry two
minutes later on both 0.1.7 and 0.1.8.
