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

## Every release

1. Bump the version in all five places it is stated: `<Version>` in
   `BetterBuildingMenu/BetterBuildingMenu.csproj`, `modinfo.json`,
   `BetterBuildingMenu/UI/mod.json`, `ModVersion` in
   `BetterBuildingMenu/Properties/PublishConfiguration.xml`, and a new first
   entry in `BetterBuildingMenu/Changelog.json`. Then REPLACE the body of
   `<ChangeLog>` with that entry's text. The element holds one version's notes,
   not a running history: the store shows it under the version, so an older
   section left in it is published as part of the new version's notes (0.1.12
   went out with 0.1.11's appended on 2026-09-22 and needed an `Update` to
   trim). `npm test` in `BetterBuildingMenu/UI` fails until all five agree
   and the `<ChangeLog>` opens with the new number. If the game's minor
   version has moved, update `GameVersion` too.
2. Build and package with the same configuration, in one environment:
   `CS2_BUILD_CONFIG=Release ./build.sh all && CS2_BUILD_CONFIG=Release ./build.sh package`.
   `package` reads the variable too; without it, it copies the Debug DLL
   (that shipped a stale embedded `Locale.json` once, on 2026-09-09, before
   the 0.1.3 package was redone). The package is `artifacts/BetterBuildingMenu/`,
   and `build.sh` refuses any package that still carries a Find It identity.
3. Close the game. From a scratch directory, run `NewVersion`:

   ```sh
   MP="$HOME/.local/share/Steam/steamapps/common/Cities Skylines II/Cities2_Data/Content/Game/.ModdingToolchain/ModPublisher"
   REPO=/path/to/cs2-better-building-menu
   cd "$(mktemp -d)"
   DOTNET_ROLL_FORWARD=Major dotnet "$MP/ModPublisher.dll" NewVersion \
       "$REPO/BetterBuildingMenu/Properties/PublishConfiguration.xml" \
       -c "$REPO/artifacts/BetterBuildingMenu" -v
   ```

   Relative `Thumbnail`/`Screenshot` paths in the XML resolve against the
   working directory, so either use absolute paths or run from
   `BetterBuildingMenu/`.
4. Run `Update` with the same arguments. A `NewVersion` upload echoes the
   forum link in its log, but the page came back without it after 0.1.5 and
   0.1.6 (2026-09-10); the metadata `Update` puts it back. It refuses for a
   minute or two after a publish ("User version already exists for this
   mod"): wait and retry. It went through on the first retry, two minutes
   later, for both 0.1.7 and 0.1.8.

Metadata-only changes (description, images, access level) go through
`Update` alone.

## The first publish (done 2026-09-09)

`Publish`, with the same arguments as step 3, created the listing. It needs
`GameVersion` (`major.minor.*`, currently `1.6.*`), a square PNG thumbnail,
the screenshots and an `AccessLevel` (`Public`, `Unlisted` or `Private`), and
it prints `Mod published with Id=<n>`. That number went into
`<ModId Value="…"/>`, which `NewVersion` and `Update` require: 158589.

## Verifying the login without publishing

`Update` with a nonexistent `ModId` signs in, then fails server-side with
"The mod ID provided (…) is invalid or does not exist" — nothing is written.
That is the probe used on 2026-09-09; it printed
`Auto logged in with account "…"` first.
