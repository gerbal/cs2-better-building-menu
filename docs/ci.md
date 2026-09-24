# Continuous integration

Two workflows, in `.github/workflows/`. Changing either needs a token with the `workflow`
scope (`gh auth refresh -s workflow`); GitHub refuses a push that touches them otherwise.

- **`ui.yml`** runs for every pull request and push, forks included: `npm test` (typecheck, lint,
  unit and render suites), the webpack build, and a parse of `build.sh`. The UI needs nothing
  from the game; the test harness stubs its `cs2/*` modules.
- **`csharp.yml`** builds the mod and runs every xUnit test (`./build.sh backend`,
  `./build.sh test`) against **the game's own assemblies**, checked out from a private
  repository. A pull request from a fork gets no secrets, so it skips this job rather than
  failing it.

## The game assemblies

The mod compiles against 18 of the game's assemblies from `Cities2_Data/Managed`. The private
repository `gerbal/cs2-game-refs` holds unmodified copies of them, so CI builds exactly as a
local build does and runs the whole suite, `Requires=Game` tests included.

The script that fills it, `tools/game-refs/refresh.sh`, lives in the CS2 modding workspace
(the private `gerbal/cs2-modding`, the folder this repository is checked out in), not here, so
this repository holds nothing that handles the game's code. The commands below run from the
workspace's root.

- **They are the game's code.** Treat this repository as public, since it may be opened: the
  copies may exist only in the private repository and inside a runner. See "Keeping them private" below.
- **What still cannot run anywhere outside the game:** Unity's native side. A test that reaches
  an internal call (a `LogManager` logger, `Application.persistentDataPath`, the static
  initializer of `Mod`) fails with a `SecurityException` (`ECall methods must be packaged into a
  system module`) locally and in CI alike. Such a test doesn't belong in the suite; the in-game
  checks cover that code.

Until 2026-09-24 CI used mock copies instead, and `refresh.sh --mock` still writes them, for a
setup that must not hold the game's code. Tests that call into the game fail against mocks, so
they carry `[Trait("Requires", "Game")]` and a mock run filters them out with
`CS2_TEST_FILTER=Requires!=Game`, which `build.sh test` passes to `dotnet test --filter`.

### Mock copies (`--mock`)

Mock copies have every method body replaced by `throw new NotImplementedException()`, made with
JetBrains Refasmer (`--all --mock`):

- Every type, member and signature is kept, private struct fields included, so the mod
  compiles exactly as against the real thing. The compiler reads those fields for the
  `unmanaged` constraint ECS code relies on.
- Unlike a reference assembly, a mock loads at run time, so a test can use the game's types.
  A test that calls into the game gets `NotImplementedException: … not implemented in mock
  library`.
- Refasmer also gives a body to the methods the runtime supplies itself: Unity's internal calls
  and every delegate's `Invoke`. The runtime refuses to load a type holding one
  (`TypeLoadException: Internal call method … with non-zero RVA`), which took out
  `UnityEngine.Object` and every prefab type with it. `refresh.sh` then runs
  the workspace's `tools/game-refs/FixNativeMethods.cs`, which clears the internal-call flag and drops the
  delegates' bodies in place. It needs no game install, so mocks made before it existed can be
  fixed where they are:

  ```sh
  dotnet run tools/game-refs/FixNativeMethods.cs -- ../cs2-game-refs/Cities2_Data/Managed
  ```
- None of the game's code is in them, but they still carry its API, names included. Keep the
  repository that holds them private.

Two ways a test breaks against mocks without calling a game method:

- **Reading a static field of a game type** runs its type initializer, which the mocks replace
  with a throw. `DlcId.Invalid` and `DlcId.BaseGame` are the ones the catalog needs; it compares
  against `Domain/GameDlcIds` instead, and `GameDlcIdsTests` (tagged `Requires=Game`) pins
  those constants to the game's values.
- **A game enum inside `[InlineData]`** cannot be decoded against the mocks, and xUnit drops the
  cases without reporting anything: the run passes with fewer tests. Pass the member's name
  (`nameof(AreaType.Residential)`) and parse it in the test. After a refresh, check that the
  mock run's total is the full run's total less the tagged tests.

## One-time setup

1. Create an empty **private** repository, `gerbal/cs2-game-refs`. If it is named otherwise,
   change `repository:` in `csharp.yml` to match.
2. Clone it somewhere outside the workspace (the script refuses a path inside it), and, from
   the workspace's root, copy the assemblies from your install:

   ```sh
   tools/game-refs/refresh.sh --refs ../cs2-game-refs --label <game version> --verify
   ```

   It reads the game from `$CS2_GAME_PATH`, or the Steam path `Directory.Build.props` defaults
   to. It takes the list of assemblies from this mod's two `.csproj` files (`--project` picks
   another checkout), copies them to
   `Cities2_Data/Managed` in the clone with a `MANIFEST.md` of their hashes, and `--verify`
   then builds from clean and runs every test against them, as CI will.
3. A test that fails under `--verify` fails in CI too. With `--mock`, a test that fails there but
   passes with a plain `./build.sh test` calls into the game: tag it
   `[Trait("Requires", "Game")]`.
4. Commit and push the clone; the script prints the command.
5. Give CI read access with a deploy key, which reaches that one repository and nothing else:

   ```sh
   ssh-keygen -t ed25519 -N "" -C cs2-game-refs-ci -f cs2-game-refs-ci
   ```

   - `cs2-game-refs-ci.pub` goes in **cs2-game-refs → Settings → Deploy keys**, with *Allow
     write access* left off.
   - `cs2-game-refs-ci` (the private half) goes in **this repository → Settings → Secrets and
     variables → Actions** as `CS2_REFS_DEPLOY_KEY`.
   - Then delete both files.
6. The workflows are already in `.github/workflows/`; the first run after the secret is set proves the setup.

## After a game update

A game update can add, remove or change what the mod compiles against. Rerun step 2 from the
workspace's root with the new version as the label, then push:

```sh
tools/game-refs/refresh.sh --refs ../cs2-game-refs --label <new version> --verify
```

Until then, CI builds against the previous version's assemblies and cannot see what changed.

## Keeping them private

- **Never upload `cs2-refs` as a workflow artifact.** Anyone who can see the repository can
  download its artifacts, everyone once it is public.
- **Never put it in the Actions cache.** A pull request, a fork's included, can restore caches
  made on the default branch.
- **Never run `csharp.yml` on `pull_request_target`.** That event gives a fork's code the
  repository's secrets.
- **The checkout does not keep the key** (`persist-credentials: false`), so later steps cannot
  reuse it.
- **Nothing in the job may print the assemblies' contents**, such as a step that decompiles or
  dumps them. Anyone who can see the repository can read the job's log.

## What CI does not cover

- The game itself: the assemblies load, but Unity's native side and the game's ECS world do not
  run outside it. The in-game checks in [release-checklist.md](release-checklist.md) still
  apply.
